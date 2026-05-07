import { useCallback, useState } from "react";
import { safeInvoke } from "../safeInvoke.js";
import type { ConversationDetail, ConversationSummary } from "../types.js";

export function useConversationHistory() {
  const [sessions, setSessions] = useState<ConversationSummary[]>([]);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [detail, setDetail] = useState<ConversationDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadSessions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await safeInvoke<ConversationSummary[]>(
        "list_conversations",
        undefined,
        [],
      );
      setSessions(result);
      if (!selectedPath && result[0]) setSelectedPath(result[0].path);
      return result;
    } catch (e) {
      setError(String(e));
      return [];
    } finally {
      setLoading(false);
    }
  }, [selectedPath]);

  const openConversation = useCallback(async (path: string) => {
    setLoading(true);
    setError(null);
    setSelectedPath(path);
    try {
      const result = await safeInvoke<ConversationDetail>(
        "read_conversation",
        { path },
        { path, content: "Browser preview only. Conversation history is available in the Tauri app." },
      );
      setDetail(result);
      return result;
    } catch (e) {
      setError(String(e));
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    sessions,
    selectedPath,
    detail,
    loading,
    error,
    loadSessions,
    openConversation,
  };
}
