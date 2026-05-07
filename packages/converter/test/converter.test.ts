import assert from "node:assert/strict";
import http from "node:http";
import test from "node:test";
import { chatToResponsesRequest, configFromEnv, createServer, responsesToChatCompletion } from "../src/index.js";
import { readSseEvents } from "../src/stream/sse.js";

function listen(server: http.Server): Promise<string> {
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") throw new Error("bad address");
      resolve(`http://${address.address}:${address.port}`);
    });
  });
}

function close(server: http.Server): Promise<void> {
  return new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
}

async function readRequestBody(req: http.IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString("utf8");
}

test("chatToResponsesRequest keeps all system and developer instructions", () => {
  const converted = chatToResponsesRequest({
    model: "gpt-test",
    messages: [
      { role: "system", content: "be concise" },
      { role: "developer", content: "prefer JSON" },
      { role: "user", content: "hello" }
    ]
  });

  assert.equal(converted.instructions, "be concise\n\nprefer JSON");
  assert.deepEqual(converted.input, [{ role: "user", content: "hello" }]);
});

test("chatToResponsesRequest converts tools and response_format", () => {
  const converted = chatToResponsesRequest({
    model: "gpt-test",
    max_completion_tokens: 42,
    reasoning_effort: "high",
    response_format: {
      type: "json_schema",
      json_schema: { name: "Result", schema: { type: "object" }, strict: true }
    },
    tools: [
      {
        type: "function",
        function: { name: "run", parameters: { type: "object" }, strict: true }
      }
    ],
    messages: [{ role: "user", content: "go" }]
  });

  assert.equal(converted.max_output_tokens, 42);
  assert.deepEqual(converted.reasoning, { effort: "high" });
  assert.deepEqual(converted.tools, [
    { type: "function", name: "run", parameters: { type: "object" }, strict: true }
  ]);
  assert.deepEqual(converted.text, {
    format: { type: "json_schema", name: "Result", schema: { type: "object" }, strict: true }
  });
});

test("responsesToChatCompletion falls back to function item id", () => {
  const converted = responsesToChatCompletion({
    id: "resp_123",
    created_at: 123,
    model: "gpt-test",
    status: "completed",
    output: [
      { id: "fc_123", type: "function_call", name: "run", arguments: "{\"cmd\":\"pwd\"}" }
    ]
  });

  assert.equal(converted.choices[0]?.finish_reason, "tool_calls");
  assert.equal(converted.choices[0]?.message?.tool_calls?.[0]?.id, "fc_123");
});

test("readSseEvents supports long and multiline data", async () => {
  const longPayload = "x".repeat(128 * 1024);
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(`event: response.output_text.delta\ndata: ${longPayload}\ndata: tail\n\n`));
      controller.close();
    }
  });

  const events = [];
  for await (const event of readSseEvents(stream)) events.push(event);

  assert.equal(events.length, 1);
  assert.equal(events[0]?.event, "response.output_text.delta");
  assert.equal(events[0]?.data, `${longPayload}\ntail`);
});

test("configFromEnv uses Responses settings as Completions fallback", () => {
  const cfg = configFromEnv(["--responses-url", "https://api.deepseek.com/", "--responses-key", "provider-key"], {});

  assert.equal(cfg.responsesBaseUrl, "https://api.deepseek.com");
  assert.equal(cfg.responsesKey, "provider-key");
  assert.equal(cfg.completionsBaseUrl, "https://api.deepseek.com");
  assert.equal(cfg.completionsKey, "provider-key");
});

test("server forwards Chat requests to Completions upstream when configured", async () => {
  const upstream = http.createServer(async (req, res) => {
    assert.equal(req.url, "/v1/chat/completions");
    assert.equal(req.headers.authorization, "Bearer provider-key");
    const body = JSON.parse(await readRequestBody(req)) as { model: string; messages: unknown[] };
    assert.equal(body.model, "deepseek-chat");
    assert.equal(body.messages.length, 1);
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({
      id: "chatcmpl_test",
      object: "chat.completion",
      created: 1,
      model: body.model,
      choices: [{ index: 0, message: { role: "assistant", content: "ok" }, finish_reason: "stop" }]
    }));
  });
  const upstreamBase = await listen(upstream);
  const proxy = createServer({
    host: "127.0.0.1",
    port: 0,
    responsesBaseUrl: "http://127.0.0.1:1",
    completionsBaseUrl: `${upstreamBase}/v1`,
    completionsKey: "provider-key",
    chatUpstream: "completions"
  });
  const proxyBase = await listen(proxy);

  try {
    const response = await fetch(`${proxyBase}/v1/chat/completions`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: "Bearer local-key" },
      body: JSON.stringify({ model: "deepseek-chat", messages: [{ role: "user", content: "hi" }] })
    });
    const body = await response.json() as { choices: Array<{ message: { content: string } }> };
    assert.equal(response.status, 200);
    assert.equal(body.choices[0]?.message.content, "ok");
  } finally {
    await close(proxy);
    await close(upstream);
  }
});

test("server converts Responses requests to Chat upstream and back", async () => {
  const upstream = http.createServer(async (req, res) => {
    assert.equal(req.url, "/v1/chat/completions");
    const body = JSON.parse(await readRequestBody(req)) as {
      model: string;
      messages: Array<{ role: string; content: string }>;
      max_completion_tokens?: number;
      tool_choice?: { type?: string; function?: { name?: string } };
      tools?: Array<{ type: string; function?: { name?: string } }>;
    };
    assert.equal(body.model, "kimi-k2");
    assert.equal(body.messages[0]?.role, "system");
    assert.equal(body.messages[1]?.role, "user");
    assert.equal(body.messages[1]?.content, "hi");
    assert.equal(body.max_completion_tokens, 64);
    assert.equal(body.tools?.[0]?.function?.name, "search");
    assert.equal(body.tool_choice?.function?.name, "search");
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({
      id: "chatcmpl_rsp",
      object: "chat.completion",
      created: 2,
      model: body.model,
      choices: [{ index: 0, message: { role: "assistant", content: "hello" }, finish_reason: "stop" }],
      usage: { prompt_tokens: 3, completion_tokens: 4, total_tokens: 7 }
    }));
  });
  const upstreamBase = await listen(upstream);
  const proxy = createServer({
    host: "127.0.0.1",
    port: 0,
    responsesBaseUrl: "http://127.0.0.1:1",
    completionsBaseUrl: upstreamBase,
    completionsKey: "provider-key"
  });
  const proxyBase = await listen(proxy);

  try {
    const response = await fetch(`${proxyBase}/v1/responses`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model: "kimi-k2",
        instructions: "be brief",
        input: "hi",
        max_output_tokens: 64,
        tools: [{ type: "function", name: "search", parameters: { type: "object" } }],
        tool_choice: { type: "function", name: "search" }
      })
    });
    const body = await response.json() as {
      status: string;
      output_text: string;
      output: Array<{ type: string; content?: Array<{ text?: string }> }>;
      usage: { input_tokens: number; output_tokens: number; total_tokens: number };
    };
    assert.equal(response.status, 200);
    assert.equal(body.status, "completed");
    assert.equal(body.output_text, "hello");
    assert.equal(body.output[0]?.type, "message");
    assert.equal(body.output[0]?.content?.[0]?.text, "hello");
    assert.deepEqual(body.usage, { input_tokens: 3, output_tokens: 4, total_tokens: 7 });
  } finally {
    await close(proxy);
    await close(upstream);
  }
});

test("server converts Chat streams to Responses streams", async () => {
  const upstream = http.createServer((_req, res) => {
    res.writeHead(200, { "content-type": "text/event-stream" });
    res.write('data: {"id":"chatcmpl_stream","object":"chat.completion.chunk","created":3,"model":"deepseek-chat","choices":[{"index":0,"delta":{"role":"assistant"},"finish_reason":null}]}\n\n');
    res.write('data: {"id":"chatcmpl_stream","object":"chat.completion.chunk","created":3,"model":"deepseek-chat","choices":[{"index":0,"delta":{"content":"hel"},"finish_reason":null}]}\n\n');
    res.write('data: {"id":"chatcmpl_stream","object":"chat.completion.chunk","created":3,"model":"deepseek-chat","choices":[{"index":0,"delta":{"content":"lo"},"finish_reason":"stop"}],"usage":{"prompt_tokens":1,"completion_tokens":1,"total_tokens":2}}\n\n');
    res.write("data: [DONE]\n\n");
    res.end();
  });
  const upstreamBase = await listen(upstream);
  const proxy = createServer({
    host: "127.0.0.1",
    port: 0,
    responsesBaseUrl: "http://127.0.0.1:1",
    completionsBaseUrl: upstreamBase
  });
  const proxyBase = await listen(proxy);

  try {
    const response = await fetch(`${proxyBase}/v1/responses`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ model: "deepseek-chat", stream: true, input: "hi" })
    });
    const events = [];
    for await (const event of readSseEvents(response.body!)) {
      events.push({ event: event.event, data: JSON.parse(event.data) as { type: string; delta?: string; response?: { output_text?: string } } });
    }
    assert.equal(response.status, 200);
    assert.ok(events.some((event) => event.event === "response.created"));
    assert.deepEqual(
      events.filter((event) => event.event === "response.output_text.delta").map((event) => event.data.delta),
      ["hel", "lo"]
    );
    assert.equal(events.at(-1)?.event, "response.completed");
    assert.equal(events.at(-1)?.data.response?.output_text, "hello");
  } finally {
    await close(proxy);
    await close(upstream);
  }
});

test("server converts Responses stream empty tool call into Chat stream", async () => {
  const upstream = http.createServer((_req, res) => {
    res.writeHead(200, { "content-type": "text/event-stream" });
    res.write("event: response.output_item.added\n");
    res.write('data: {"type":"response.output_item.added","output_index":0,"item":{"id":"fc_123","type":"function_call","call_id":"call_123","name":"get_time","arguments":""}}\n\n');
    res.write("event: response.output_item.done\n");
    res.write('data: {"type":"response.output_item.done","output_index":0,"item":{"id":"fc_123","type":"function_call","call_id":"call_123","name":"get_time","arguments":""}}\n\n');
    res.write("event: response.completed\n");
    res.write('data: {"type":"response.completed","response":{"model":"gpt-test","status":"completed","usage":{"input_tokens":1,"output_tokens":1,"total_tokens":2}}}\n\n');
    res.end();
  });
  const upstreamBase = await listen(upstream);
  const proxy = createServer({
    host: "127.0.0.1",
    port: 0,
    responsesBaseUrl: upstreamBase,
    completionsBaseUrl: upstreamBase
  });
  const proxyBase = await listen(proxy);

  try {
    const response = await fetch(`${proxyBase}/v1/chat/completions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ model: "gpt-test", stream: true, messages: [{ role: "user", content: "x" }] })
    });
    const text = await response.text();
    assert.equal(response.status, 200);
    assert.match(text, /"tool_calls":\[\{"id":"call_123","type":"function","index":0,"function":\{"name":"get_time","arguments":""\}\}\]/);
    assert.match(text, /"finish_reason":"tool_calls"/);
    assert.equal((text.match(/data: \[DONE\]/g) ?? []).length, 1);
  } finally {
    await close(proxy);
    await close(upstream);
  }
});
