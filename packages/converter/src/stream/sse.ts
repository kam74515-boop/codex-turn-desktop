export interface SseEvent {
  event?: string;
  data: string;
}

export async function* readSseEvents(body: ReadableStream<Uint8Array> | NodeJS.ReadableStream): AsyncGenerator<SseEvent> {
  const decoder = new TextDecoder();
  let buffer = "";

  for await (const chunk of body as AsyncIterable<Uint8Array | Buffer>) {
    buffer += decoder.decode(chunk, { stream: true });
    let match: RegExpExecArray | null;
    const boundary = /\r?\n\r?\n/g;
    while ((match = boundary.exec(buffer)) !== null) {
      const raw = buffer.slice(0, match.index);
      buffer = buffer.slice(match.index + match[0].length);
      boundary.lastIndex = 0;
      const event = parseSseBlock(raw);
      if (event) yield event;
    }
  }

  if (buffer.trim()) {
    const event = parseSseBlock(buffer.trim());
    if (event) yield event;
  }
}

export function parseSseBlock(block: string): SseEvent | undefined {
  const data: string[] = [];
  let event: string | undefined;
  for (const line of block.split(/\r?\n/)) {
    if (!line || line.startsWith(":")) continue;
    const [field, ...rest] = line.split(":");
    let value = rest.join(":");
    if (value.startsWith(" ")) value = value.slice(1);
    if (field === "event") event = value;
    if (field === "data") data.push(value);
  }
  if (data.length === 0) return undefined;
  return { event, data: data.join("\n") };
}

export function encodeSseData(data: unknown): string {
  return `data: ${JSON.stringify(data)}\n\n`;
}

export function encodeSseEvent(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export const sseDone = "data: [DONE]\n\n";
