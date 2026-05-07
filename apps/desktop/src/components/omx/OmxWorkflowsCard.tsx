import { useLang } from "../../i18n/index.js";
import { StatusLine } from "../common/StatusLine.js";
import { Badge } from "../common/Badge.js";
import { EmptyState } from "../common/EmptyState.js";
import type { OmxHud, OmxWorkflowMode } from "../../types.js";

const workflowKeys = [
  "ralph",
  "ultrawork",
  "autopilot",
  "ralplan",
  "deepInterview",
  "autoresearch",
  "ultraqa",
  "team",
] as const;

export function OmxWorkflowsCard({ hud }: { hud: OmxHud | null }) {
  const { t } = useLang();

  const activeWorkflows = hud
    ? workflowKeys.filter((k) => {
        const mode = hud[k] as OmxWorkflowMode | undefined;
        return mode?.active;
      })
    : [];

  return (
    <div className="card">
      <div className="card-header">
        <h2 className="card-title">{t("omx.workflows")}</h2>
        {hud?.session?.sessionId && (
          <span className="text-xs text-tertiary mono">
            {hud.session.sessionId.slice(0, 12)}
          </span>
        )}
      </div>

      {activeWorkflows.length === 0 ? (
        <EmptyState text={t("omx.workflows.none")} />
      ) : (
        <div>
          {activeWorkflows.map((key) => {
            const mode = hud![key] as OmxWorkflowMode;
            return (
              <div className="list-item" key={key}>
                <div>
                  <div className="list-item-name">
                    {key}
                    <Badge status="active">active</Badge>
                  </div>
                </div>
                <div className="list-item-meta">
                  {mode.currentPhase && (
                    <span className="text-xs text-secondary">
                      {t("omx.workflows.phase")}: {mode.currentPhase}
                    </span>
                  )}
                  {mode.iteration !== undefined && (
                    <span className="text-xs text-secondary">
                      {t("omx.workflows.iteration")}: {mode.iteration}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {hud?.metrics && (
        <div className="mt-16">
          <h3 className="card-title text-sm mb-8">{t("omx.workflows.metrics")}</h3>
          <StatusLine
            label={t("omx.workflows.turns")}
            value={String(hud.metrics.totalTurns ?? 0)}
          />
          {hud.metrics.sessionTotalTokens !== undefined && (
            <StatusLine
              label={t("omx.workflows.tokens")}
              value={String(hud.metrics.sessionTotalTokens)}
            />
          )}
          {hud.metrics.fiveHourLimitPct !== undefined && (
            <StatusLine
              label="5h limit"
              value={`${hud.metrics.fiveHourLimitPct}%`}
            />
          )}
        </div>
      )}
    </div>
  );
}
