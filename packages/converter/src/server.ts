import http, { type IncomingMessage, type ServerResponse } from "node:http";
import type { ConverterConfig } from "./config.js";
import type { ChatCompletionsRequest, ChatCompletionsResponse } from "./types/chat.js";
import type { ResponsesRequest, ResponsesResponse } from "./types/responses.js";
import { chatToResponsesRequest } from "./convert/chatToResponses.js";
import { chatCompletionToResponses } from "./convert/chatToResponsesResponse.js";
import { responsesToChatCompletion } from "./convert/responsesToChat.js";
import { responsesToChatCompletionRequest } from "./convert/responsesToChatRequest.js";
import { pipeChatToResponsesStream } from "./stream/chatToResponsesStream.js";
import { pipeResponsesToChatStream } from "./stream/responsesToChatStream.js";

async function readJson(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw.trim() ? JSON.parse(raw) : {};
}

function writeJson(res: ServerResponse, status: number, payload: unknown): void {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

function writeError(res: ServerResponse, status: number, message: string): void {
  writeJson(res, status, { error: { message, type: "proxy_error", code: status } });
}

function authHeader(req: IncomingMessage, fallback?: string): string | undefined {
  if (fallback) return `Bearer ${fallback}`;
  const incoming = req.headers.authorization;
  if (typeof incoming === "string" && incoming) return incoming;
  return undefined;
}

function upstreamUrl(baseUrl: string, path: `/v1/${string}`): string {
  const base = baseUrl.replace(/\/+$/, "");
  if (base.endsWith("/v1")) return `${base}${path.slice("/v1".length)}`;
  return `${base}${path}`;
}

async function proxyModels(req: IncomingMessage, res: ServerResponse, cfg: ConverterConfig): Promise<void> {
  const baseUrl = cfg.chatUpstream === "completions" ? cfg.completionsBaseUrl : cfg.responsesBaseUrl;
  const key = cfg.chatUpstream === "completions" ? cfg.completionsKey : cfg.responsesKey;
  const upstream = await fetch(upstreamUrl(baseUrl, "/v1/models"), {
    headers: {
      ...(authHeader(req, key) ? { authorization: authHeader(req, key)! } : {})
    }
  });
  const text = await upstream.text();
  res.writeHead(upstream.status, {
    "content-type": upstream.headers.get("content-type") ?? "application/json; charset=utf-8"
  });
  res.end(text);
}

async function pipeUpstream(upstream: Response, res: ServerResponse): Promise<void> {
  res.writeHead(upstream.status, {
    "content-type": upstream.headers.get("content-type") ?? "application/json; charset=utf-8",
    ...(upstream.headers.get("cache-control") ? { "cache-control": upstream.headers.get("cache-control")! } : {})
  });
  if (!upstream.body) {
    res.end();
    return;
  }
  for await (const chunk of upstream.body as AsyncIterable<Uint8Array>) {
    res.write(chunk);
  }
  res.end();
}

async function forwardChatToCompletions(req: IncomingMessage, res: ServerResponse, cfg: ConverterConfig): Promise<void> {
  let body: ChatCompletionsRequest;
  try {
    body = (await readJson(req)) as ChatCompletionsRequest;
  } catch (error) {
    writeError(res, 400, `invalid JSON: ${(error as Error).message}`);
    return;
  }

  const upstream = await fetch(upstreamUrl(cfg.completionsBaseUrl, "/v1/chat/completions"), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: body.stream ? "text/event-stream" : "application/json",
      ...(authHeader(req, cfg.completionsKey) ? { authorization: authHeader(req, cfg.completionsKey)! } : {})
    },
    body: JSON.stringify(body)
  });
  await pipeUpstream(upstream, res);
}

async function handleChat(req: IncomingMessage, res: ServerResponse, cfg: ConverterConfig): Promise<void> {
  if (cfg.chatUpstream === "completions") {
    await forwardChatToCompletions(req, res, cfg);
    return;
  }

  let body: ChatCompletionsRequest;
  try {
    body = (await readJson(req)) as ChatCompletionsRequest;
  } catch (error) {
    writeError(res, 400, `invalid JSON: ${(error as Error).message}`);
    return;
  }

  const responsesBody = chatToResponsesRequest(body);
  const upstream = await fetch(upstreamUrl(cfg.responsesBaseUrl, "/v1/responses"), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: body.stream ? "text/event-stream" : "application/json",
      ...(authHeader(req, cfg.responsesKey) ? { authorization: authHeader(req, cfg.responsesKey)! } : {})
    },
    body: JSON.stringify(responsesBody)
  });

  if (!upstream.ok) {
    const text = await upstream.text();
    res.writeHead(upstream.status, {
      "content-type": upstream.headers.get("content-type") ?? "application/json; charset=utf-8"
    });
    res.end(text);
    return;
  }

  if (body.stream) {
    res.writeHead(200, {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache",
      connection: "keep-alive",
      "x-accel-buffering": "no"
    });
    await pipeResponsesToChatStream(upstream, res, responsesBody.model);
    res.end();
    return;
  }

  const responseBody = (await upstream.json()) as ResponsesResponse;
  writeJson(res, 200, responsesToChatCompletion(responseBody, responsesBody.model ?? responsesBody.model ?? body.model));
}

async function handleResponses(req: IncomingMessage, res: ServerResponse, cfg: ConverterConfig): Promise<void> {
  let body: ResponsesRequest;
  try {
    body = (await readJson(req)) as ResponsesRequest;
  } catch (error) {
    writeError(res, 400, `invalid JSON: ${(error as Error).message}`);
    return;
  }
  const chatBody = responsesToChatCompletionRequest(body);
  const upstream = await fetch(upstreamUrl(cfg.completionsBaseUrl, "/v1/chat/completions"), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: body.stream ? "text/event-stream" : "application/json",
      ...(authHeader(req, cfg.completionsKey) ? { authorization: authHeader(req, cfg.completionsKey)! } : {})
    },
    body: JSON.stringify(chatBody)
  });

  if (!upstream.ok) {
    await pipeUpstream(upstream, res);
    return;
  }

  if (body.stream) {
    res.writeHead(200, {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache",
      connection: "keep-alive",
      "x-accel-buffering": "no"
    });
    await pipeChatToResponsesStream(upstream, res, body.model);
    res.end();
    return;
  }

  const responseBody = (await upstream.json()) as ChatCompletionsResponse;
  writeJson(res, 200, chatCompletionToResponses(responseBody, body.model));
}

export function createServer(cfg: ConverterConfig): http.Server {
  return http.createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
    res.setHeader("access-control-allow-origin", "*");
    res.setHeader("access-control-allow-methods", "GET, POST, OPTIONS");
    res.setHeader("access-control-allow-headers", "Content-Type, Authorization");
    if (req.method === "OPTIONS") {
      res.writeHead(200);
      res.end();
      return;
    }
    try {
      if (req.method === "GET" && url.pathname === "/health") {
        writeJson(res, 200, { status: "ok" });
        return;
      }
      if (req.method === "GET" && url.pathname === "/v1/models") {
        await proxyModels(req, res, cfg);
        return;
      }
      if (req.method === "POST" && url.pathname === "/v1/chat/completions") {
        await handleChat(req, res, cfg);
        return;
      }
      if (req.method === "POST" && url.pathname === "/v1/responses") {
        await handleResponses(req, res, cfg);
        return;
      }
      writeError(res, 404, `No route for ${req.method} ${url.pathname}`);
    } catch (error) {
      writeError(res, 500, (error as Error).message);
    }
  });
}
