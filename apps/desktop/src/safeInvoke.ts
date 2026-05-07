import { invoke, isTauri as tauriIsTauri } from "@tauri-apps/api/core";

/**
 * 检测当前是否运行在 Tauri 环境中。
 */
export function isTauri(): boolean {
  return (
    tauriIsTauri() ||
    (typeof window !== "undefined" &&
      ("__TAURI_INTERNALS__" in window || "__TAURI__" in window))
  );
}

/**
 * 调用 Tauri 命令。
 * - Tauri 环境：直接调用 invoke，失败时抛出真实错误。
 * - 浏览器预览：使用 fallback 值，保证 UI 可用。
 */
export async function safeInvoke<T>(
  command: string,
  args?: Record<string, unknown>,
  fallback?: T,
): Promise<T> {
  if (!isTauri()) {
    // 浏览器预览模式：使用 fallback
    if (fallback !== undefined) return fallback;
    throw new Error(
      `Browser preview: Tauri command "${command}" unavailable and no fallback provided`,
    );
  }
  // Tauri 环境：真实调用，错误直接抛出让调用方处理
  return invoke<T>(command, args);
}
