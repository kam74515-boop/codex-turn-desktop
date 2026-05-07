import { randomBytes } from "node:crypto";

export function nowUnix(): number {
  return Math.floor(Date.now() / 1000);
}

export function generateId(prefix: string): string {
  return `${prefix}${randomBytes(12).toString("hex")}`;
}

export function convertId(id: string | undefined, prefix: string): string {
  if (!id) return generateId(prefix);
  if (id.startsWith(prefix)) return id;
  for (const oldPrefix of ["chatcmpl-", "resp_", "cmpl-"]) {
    if (id.startsWith(oldPrefix)) {
      return `${prefix}${id.slice(oldPrefix.length)}`;
    }
  }
  return `${prefix}${id}`;
}
