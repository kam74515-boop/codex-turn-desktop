import { useCallback, useState } from "react";
import { safeInvoke } from "../safeInvoke.js";
import type { TerminalCommandResult, TerminalEntry } from "../types.js";

const STORAGE_KEY = "codex-turn-terminal-cwd";

function fallbackResult(command: string, cwd: string): TerminalCommandResult {
  return {
    command,
    cwd,
    code: 0,
    stdout: `Browser preview only. Tauri terminal command was not executed.\n$ ${command}`,
    stderr: "",
  };
}

export function useTerminal() {
  const [cwd, setCwdState] = useState(
    () => localStorage.getItem(STORAGE_KEY) || "",
  );
  const [entries, setEntries] = useState<TerminalEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setCwd = useCallback((value: string) => {
    setCwdState(value);
    localStorage.setItem(STORAGE_KEY, value);
  }, []);

  const run = useCallback(
    async (command: string) => {
      const trimmed = command.trim();
      if (!trimmed) return null;
      setLoading(true);
      setError(null);
      try {
        const result = await safeInvoke<TerminalCommandResult>(
          "terminal_run",
          { input: { command: trimmed, cwd } },
          fallbackResult(trimmed, cwd),
        );
        const entry: TerminalEntry = {
          ...result,
          id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
          createdAt: new Date().toLocaleString(),
        };
        setEntries((prev) => [entry, ...prev].slice(0, 50));
        if (result.cwd && result.cwd !== cwd) setCwd(result.cwd);
        return result;
      } catch (e) {
        setError(String(e));
        return null;
      } finally {
        setLoading(false);
      }
    },
    [cwd, setCwd],
  );

  const clear = useCallback(() => setEntries([]), []);

  return {
    cwd,
    entries,
    loading,
    error,
    setCwd,
    run,
    clear,
  };
}
