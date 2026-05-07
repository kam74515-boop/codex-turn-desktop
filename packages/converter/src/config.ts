export type ChatUpstream = "responses" | "completions";

export interface ConverterConfig {
  host: string;
  port: number;
  responsesBaseUrl: string;
  responsesKey?: string;
  completionsBaseUrl: string;
  completionsKey?: string;
  chatUpstream?: ChatUpstream;
}

export function normalizeBaseUrl(value: string): string {
  return value.replace(/\/+$/, "");
}

export function configFromEnv(argv = process.argv.slice(2), env = process.env): ConverterConfig {
  const args = parseArgs(argv);
  const responsesBaseUrl = normalizeBaseUrl(args["responses-url"] ?? env.RESPONSES_API_BASE_URL ?? "https://api.openai.com");
  const responsesKey = args["responses-key"] ?? env.RESPONSES_API_KEY;
  return {
    host: args.host ?? env.HOST ?? "127.0.0.1",
    port: Number(args.port ?? env.PORT ?? 9090),
    responsesBaseUrl,
    responsesKey,
    completionsBaseUrl: normalizeBaseUrl(args["completions-url"] ?? env.COMPLETIONS_API_BASE_URL ?? responsesBaseUrl),
    completionsKey: args["completions-key"] ?? env.COMPLETIONS_API_KEY ?? responsesKey,
    chatUpstream: parseChatUpstream(args["chat-upstream"] ?? env.CHAT_UPSTREAM ?? "responses")
  };
}

function parseChatUpstream(value: string): ChatUpstream {
  if (value === "responses" || value === "completions") return value;
  throw new Error(`invalid chat-upstream: ${value}`);
}

function parseArgs(argv: string[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg?.startsWith("--")) continue;
    const raw = arg.slice(2);
    const eq = raw.indexOf("=");
    if (eq !== -1) {
      result[raw.slice(0, eq)] = raw.slice(eq + 1);
      continue;
    }
    const next = argv[index + 1];
    if (next && !next.startsWith("--")) {
      result[raw] = next;
      index += 1;
    } else {
      result[raw] = "true";
    }
  }
  return result;
}
