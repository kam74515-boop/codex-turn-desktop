import { useLang } from "../../i18n/index.js";
import { ActionButton } from "../common/ActionButton.js";
import { CodeBlock } from "../common/CodeBlock.js";
import { StatusLine } from "../common/StatusLine.js";
import type { CodexPreview, CodexConfigStatus, ProviderConfig } from "../../types.js";

export function CodexPage({
  config,
  preview,
  configStatus,
  loading,
  onPreview,
  onApply,
  onRestore,
}: {
  config: ProviderConfig;
  preview: CodexPreview | null;
  configStatus: CodexConfigStatus | null;
  loading: boolean;
  onPreview: () => void;
  onApply: () => void;
  onRestore: () => void;
}) {
  const { t } = useLang();

  return (
    <div>
      <h1 className="page-title">{t("codex.title")}</h1>

      <div className="card">
        <div className="card-header">
          <h2 className="card-title">{t("codex.title")}</h2>
        </div>
        <StatusLine
          label={t("codex.configName")}
          value={config.name}
        />
        <StatusLine
          label={t("codex.profileId")}
          value={config.profileId}
        />
        <StatusLine
          label={t("codex.providerId")}
          value={config.providerId}
        />
        <StatusLine
          label={t("codex.configPath")}
          value={configStatus?.configPath || "~/.codex/config.toml"}
        />
        <StatusLine
          label={t("codex.command")}
          value={`codex -p ${config.profileId}`}
        />
        {configStatus?.hasCodexTurn && configStatus.model && (
          <StatusLine
            label={t("dashboard.codex.model")}
            value={configStatus.model}
          />
        )}
        <div className="btn-group mt-16">
          <ActionButton variant="secondary" loading={loading} onClick={onPreview}>
            {t("codex.preview")}
          </ActionButton>
          <ActionButton variant="primary" loading={loading} onClick={onApply}>
            {t("codex.apply")}
          </ActionButton>
          <ActionButton variant="danger" loading={loading} onClick={onRestore}>
            {t("codex.restoreDefault")}
          </ActionButton>
        </div>
      </div>

      {preview && (
        <div className="card mt-16">
          <div className="card-header">
            <h2 className="card-title">{t("codex.previewTitle")}</h2>
          </div>
          <CodeBlock>{preview.after}</CodeBlock>
        </div>
      )}
    </div>
  );
}
