import { useLang } from "../../i18n/index.js";
import { FormField } from "../common/FormField.js";
import { ActionButton } from "../common/ActionButton.js";
import { CodeBlock } from "../common/CodeBlock.js";
import { StatusLine } from "../common/StatusLine.js";
import type { ProxyStatus, ProviderConfig } from "../../types.js";

export function ProviderPage({
  configs,
  active,
  activeId,
  onSelect,
  onUpdate,
  onNew,
  onCopy,
  onDelete,
  status,
  loading,
  localBaseUrl,
  onStart,
  onStop,
  onHealth,
}: {
  configs: ProviderConfig[];
  active: ProviderConfig;
  activeId: string;
  onSelect: (id: string) => void;
  onUpdate: (patch: Partial<ProviderConfig>) => void;
  onNew: () => void;
  onCopy: () => void;
  onDelete: () => void;
  status: ProxyStatus | null;
  loading: boolean;
  localBaseUrl: string;
  onStart: () => void;
  onStop: () => void;
  onHealth: () => void;
}) {
  const { t } = useLang();

  return (
    <div>
      <h1 className="page-title">{t("provider.title")}</h1>

      {/* Config selector bar */}
      <div className="card">
        <div className="config-selector">
          <div className="config-tabs">
            {configs.map((c) => (
              <button
                key={c.id}
                className={`config-tab${c.id === activeId ? " active" : ""}`}
                onClick={() => onSelect(c.id)}
              >
                {c.name}
              </button>
            ))}
          </div>
          <div className="config-actions">
            <ActionButton variant="secondary" onClick={onNew}>
              {t("provider.new")}
            </ActionButton>
            <ActionButton variant="secondary" onClick={onCopy}>
              {t("provider.copy")}
            </ActionButton>
            <ActionButton
              variant="danger"
              onClick={onDelete}
              disabled={configs.length <= 1}
              title={configs.length <= 1 ? t("provider.keepOne") : undefined}
            >
              {t("provider.delete")}
            </ActionButton>
          </div>
        </div>
      </div>

      {/* Edit form */}
      <div className="card mt-16">
        <div className="card-header">
          <h2 className="card-title">
            {t("provider.config")} — {active.name}
          </h2>
        </div>
        <div className="form-grid">
          <FormField
            label={t("provider.configName")}
            value={active.name}
            onChange={(v) => onUpdate({ name: v })}
          />
          <FormField
            label={t("provider.providerId")}
            value={active.providerId}
            onChange={(v) => onUpdate({ providerId: v })}
          />
          <FormField
            label={t("provider.profileId")}
            value={active.profileId}
            onChange={(v) => onUpdate({ profileId: v })}
          />
          <FormField
            label={t("provider.responsesUrl")}
            value={active.responsesUrl}
            onChange={(v) => onUpdate({ responsesUrl: v })}
          />
          <FormField
            label={t("provider.apiKey")}
            type="password"
            value={active.apiKey}
            placeholder={t("provider.apiKey.placeholder")}
            onChange={(v) => onUpdate({ apiKey: v })}
          />
          <FormField
            label={t("provider.completionsUrl")}
            value={active.completionsUrl}
            placeholder={t("provider.completionsUrl.placeholder")}
            onChange={(v) => onUpdate({ completionsUrl: v })}
          />
          <FormField
            label={t("provider.completionsKey")}
            type="password"
            value={active.completionsKey}
            placeholder={t("provider.completionsKey.placeholder")}
            onChange={(v) => onUpdate({ completionsKey: v })}
          />
          <FormField
            label={t("provider.model")}
            value={active.model}
            onChange={(v) => onUpdate({ model: v })}
          />
          <FormField
            label={t("provider.host")}
            value={active.host}
            onChange={(v) => onUpdate({ host: v })}
          />
          <FormField
            label={t("provider.port")}
            value={active.port}
            onChange={(v) => onUpdate({ port: v })}
          />
        </div>

        {/* TOML extras */}
        <div className="form-grid mt-16">
          <div className="form-field full">
            <label className="form-label">{t("provider.skillsToml")}</label>
            <textarea
              value={active.skillsToml}
              onChange={(e) => onUpdate({ skillsToml: e.target.value })}
              placeholder='[skills]\nmy_skill = "enabled"'
              rows={4}
            />
          </div>
          <div className="form-field full">
            <label className="form-label">{t("provider.mcpToml")}</label>
            <textarea
              value={active.mcpToml}
              onChange={(e) => onUpdate({ mcpToml: e.target.value })}
              placeholder='[mcp]\nserver = "..."'
              rows={4}
            />
          </div>
          <div className="form-field full">
            <label className="form-label">{t("provider.pluginsToml")}</label>
            <textarea
              value={active.pluginsToml}
              onChange={(e) => onUpdate({ pluginsToml: e.target.value })}
              placeholder='[plugins]\nplugin = "..."'
              rows={4}
            />
          </div>
        </div>
      </div>

      {/* Proxy control */}
      <div className="card mt-16">
        <div className="card-header">
          <h2 className="card-title">{t("provider.proxyControl")}</h2>
          {status?.running && status?.healthy && (
            <span className="badge badge-pass">{t("provider.status.running")}</span>
          )}
          {status?.running && !status?.healthy && (
            <span className="badge badge-warn">{t("provider.status.starting")}</span>
          )}
          {status && !status.running && (
            <span className="badge badge-fail">{t("provider.status.stopped")}</span>
          )}
        </div>
        <div className="mb-8">
          <span className="text-sm text-secondary">
            {t("provider.localUrl")}
          </span>
          <CodeBlock>{localBaseUrl}</CodeBlock>
        </div>
        <div className="btn-group mb-16">
          <ActionButton variant="primary" loading={loading} onClick={onStart}>
            {t("provider.start")}
          </ActionButton>
          <ActionButton variant="danger" loading={loading} onClick={onStop}>
            {t("provider.stop")}
          </ActionButton>
          <ActionButton
            variant="secondary"
            loading={loading}
            onClick={onHealth}
          >
            {t("provider.health")}
          </ActionButton>
        </div>
        {status && (
          <div>
            <StatusLine
              label={t("provider.status.running")}
              value={status.running ? t("status.yes") : t("status.no")}
            />
            <StatusLine
              label={t("provider.status.healthy")}
              value={status.healthy ? t("status.yes") : t("status.no")}
            />
            <StatusLine
              label={t("provider.status.message")}
              value={status.message}
            />
          </div>
        )}
      </div>
    </div>
  );
}
