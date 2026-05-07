import type { ChatContentPart } from "../types/chat.js";

export function contentToString(content: unknown): string {
  if (content == null) return "";
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (part && typeof part === "object" && "text" in part) {
          const type = "type" in part ? String(part.type) : "";
          if (["text", "input_text", "output_text"].includes(type)) {
            return String(part.text ?? "");
          }
        }
        return "";
      })
      .join("");
  }
  return JSON.stringify(content);
}

export function chatContentToResponses(content: unknown): unknown {
  if (content == null || typeof content === "string") return content;
  if (!Array.isArray(content)) return content;

  return (content as ChatContentPart[]).map((part) => {
    if (part.type === "text") {
      return { type: "input_text", text: part.text ?? "" };
    }
    if (part.type === "image_url") {
      const imageUrl = typeof part.image_url === "string" ? part.image_url : part.image_url?.url;
      const converted: Record<string, unknown> = { type: "input_image", image_url: imageUrl };
      const detail = typeof part.image_url === "object" ? part.image_url?.detail : undefined;
      if (detail) converted.detail = detail;
      return converted;
    }
    return part;
  });
}

export function responsesContentToChat(content: unknown): unknown {
  if (content == null || typeof content === "string") return content;
  if (!Array.isArray(content)) return content;

  return content.map((part) => {
    if (!part || typeof part !== "object") return part;
    const item = part as Record<string, unknown>;
    if (item.type === "input_text" || item.type === "output_text" || item.type === "text") {
      return { type: "text", text: item.text ?? "" };
    }
    if (item.type === "input_image") {
      const imageUrl: Record<string, unknown> = { url: item.image_url };
      if (item.detail) imageUrl.detail = item.detail;
      return { type: "image_url", image_url: imageUrl };
    }
    return part;
  });
}
