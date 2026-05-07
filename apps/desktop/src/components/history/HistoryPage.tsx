import { useLang } from "../../i18n/index.js";
import { ActionButton } from "../common/ActionButton.js";
import { CodeBlock } from "../common/CodeBlock.js";
import { EmptyState } from "../common/EmptyState.js";
import type { ConversationDetail, ConversationSummary } from "../../types.js";

export function HistoryPage({
  sessions,
  selectedPath,
  detail,
  loading,
  onRefresh,
  onOpen,
}: {
  sessions: ConversationSummary[];
  selectedPath: string | null;
  detail: ConversationDetail | null;
  loading: boolean;
  onRefresh: () => void;
  onOpen: (path: string) => void;
}) {
  const { t } = useLang();

  return (
    <div>
      <h1 className="page-title">{t("history.title")}</h1>

      <div className="history-layout">
        <div className="card history-list-panel">
          <div className="card-header">
            <h2 className="card-title">{t("history.sessions")}</h2>
            <ActionButton variant="secondary" size="sm" loading={loading} onClick={onRefresh}>
              {t("history.refresh")}
            </ActionButton>
          </div>
          {sessions.length === 0 ? (
            <EmptyState text={t("history.empty")} />
          ) : (
            <div className="history-list">
              {sessions.map((session) => (
                <button
                  key={session.path}
                  className={`history-item${session.path === selectedPath ? " active" : ""}`}
                  onClick={() => onOpen(session.path)}
                >
                  <span className="history-item-title">{session.title}</span>
                  <span className="history-item-meta">
                    {session.updatedAt || t("status.none")} · {session.messageCount}
                  </span>
                  {session.preview && (
                    <span className="history-item-preview">{session.preview}</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="card history-detail-panel">
          <div className="card-header">
            <h2 className="card-title">{t("history.detail")}</h2>
          </div>
          {detail ? (
            <>
              <div className="history-detail-path">{detail.path}</div>
              <CodeBlock maxHeight={620}>{detail.content}</CodeBlock>
            </>
          ) : (
            <EmptyState text={t("history.select")} />
          )}
        </div>
      </div>
    </div>
  );
}
