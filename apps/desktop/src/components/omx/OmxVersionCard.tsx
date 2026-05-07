import { useLang } from "../../i18n/index.js";
import { ActionButton } from "../common/ActionButton.js";
import { Badge } from "../common/Badge.js";
import { StatusLine } from "../common/StatusLine.js";
import type { OmxStatus, OmxUpdateInfo, OmxPrerequisites } from "../../types.js";

export function OmxVersionCard({
  status,
  updateInfo,
  prerequisites,
  loading,
  onInstall,
  onCheckUpdate,
  onApplyUpdate,
}: {
  status: OmxStatus | null;
  updateInfo: OmxUpdateInfo | null;
  prerequisites: OmxPrerequisites | null;
  loading: boolean;
  onInstall: () => void;
  onCheckUpdate: () => void;
  onApplyUpdate: () => void;
}) {
  const { t } = useLang();
  const installed = status?.ready ?? false;

  return (
    <div className="card">
      <div className="card-header">
        <h2 className="card-title">{t("omx.version")}</h2>
        {installed ? (
          <Badge status="pass">{t("omx.installed")}</Badge>
        ) : (
          <Badge status="fail">{t("omx.notInstalled")}</Badge>
        )}
      </div>

      {prerequisites && !prerequisites.allMet && (
        <div className="mt-8 mb-8">
          <Badge status="warn">{t("omx.prerequisitesMissing")}</Badge>
          <div className="mt-4 text-sm text-secondary">
            {!prerequisites.git && "git "}
            {!prerequisites.node && "node "}
            {!prerequisites.npm && "npm "}
          </div>
        </div>
      )}

      {installed && (
        <>
          <StatusLine
            label={t("omx.installDir")}
            value={status?.vendorRoot || "—"}
          />
          <StatusLine
            label={t("omx.currentCommit")}
            value={status?.commit?.slice(0, 8) || "—"}
          />
        </>
      )}

      {updateInfo && installed && (
        <>
          <div className="mt-12 mb-8">
            {updateInfo.updateAvailable ? (
              <Badge status="warn">
                {t("omx.updateAvailable")} — {t("omx.behindCount")} {updateInfo.behind} {t("omx.commits")}
              </Badge>
            ) : (
              <Badge status="pass">{t("omx.upToDate")}</Badge>
            )}
          </div>
          <StatusLine
            label={t("omx.latestCommit")}
            value={updateInfo.latestCommit.slice(0, 8)}
          />
          {updateInfo.latestMessage && (
            <StatusLine label="" value={updateInfo.latestMessage} />
          )}
          {updateInfo.latestDate && (
            <StatusLine label="" value={updateInfo.latestDate} />
          )}
        </>
      )}

      <div className="btn-group mt-16">
        {!installed && (
          <ActionButton
            variant="primary"
            loading={loading}
            disabled={prerequisites !== null && !prerequisites.allMet}
            onClick={onInstall}
          >
            {t("omx.install")}
          </ActionButton>
        )}
        {installed && (
          <ActionButton variant="secondary" loading={loading} onClick={onCheckUpdate}>
            {t("omx.checkUpdate")}
          </ActionButton>
        )}
        {installed && updateInfo?.updateAvailable && (
          <ActionButton variant="primary" loading={loading} onClick={onApplyUpdate}>
            {t("omx.applyUpdate")}
          </ActionButton>
        )}
      </div>
    </div>
  );
}
