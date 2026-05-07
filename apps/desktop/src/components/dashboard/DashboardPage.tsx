import { useEffect } from "react";
import { useLang } from "../../i18n/index.js";
import { StatusCard } from "../common/StatusCard.js";
import type { PageId } from "../../types.js";
import type { ProxyStatus, CodexConfigStatus, OmxStatus } from "../../types.js";

export function DashboardPage({
  proxyStatus,
  codexStatus,
  omxStatus,
  localBaseUrl,
  onNavigate,
  onRefresh,
}: {
  proxyStatus: ProxyStatus | null;
  codexStatus: CodexConfigStatus | null;
  omxStatus: OmxStatus | null;
  localBaseUrl: string;
  onNavigate: (id: PageId) => void;
  onRefresh: () => void;
}) {
  const { t } = useLang();

  useEffect(() => {
    onRefresh();
  }, []);

  const proxyReady = proxyStatus?.running && proxyStatus?.healthy;
  const proxyDot = proxyReady
    ? "active"
    : proxyStatus?.running
      ? "warning"
      : proxyStatus
        ? "inactive"
        : "inactive";
  const proxyValue = proxyReady
    ? t("dashboard.proxy.running")
    : proxyStatus?.running
      ? t("dashboard.proxy.starting")
      : t("dashboard.proxy.stopped");
  const proxyDetail = proxyReady
    ? t("dashboard.proxy.ready")
    : proxyStatus?.running
      ? t("dashboard.proxy.checking")
      : t("dashboard.proxy.clickToStart");

  const codexDot = codexStatus?.hasCodexTurn ? "active" : "inactive";
  const codexValue = codexStatus?.hasCodexTurn
    ? t("dashboard.codex.configured")
    : t("dashboard.codex.unconfigured");

  const omxDot = omxStatus?.ready
    ? "active"
    : omxStatus
      ? "warning"
      : "inactive";
  const omxValue = omxStatus?.ready
    ? t("dashboard.omx.ready")
    : t("dashboard.omx.pending");

  const apiDot = proxyStatus?.healthy ? "active" : "inactive";
  const apiValue = proxyStatus?.healthy
    ? t("dashboard.localApi.reachable")
    : t("dashboard.localApi.unreachable");

  return (
    <div>
      <h1 className="page-title">{t("dashboard.title")}</h1>
      <div className="status-grid">
        <StatusCard
          label={t("dashboard.proxy")}
          value={proxyValue}
          detail={proxyDetail}
          dot={proxyDot as "active" | "inactive" | "warning"}
          onClick={() => onNavigate("provider")}
        />
        <StatusCard
          label={t("dashboard.codex")}
          value={codexValue}
          detail={codexStatus?.model || undefined}
          dot={codexDot as "active" | "inactive" | "warning"}
          onClick={() => onNavigate("codex")}
        />
        <StatusCard
          label={t("dashboard.omx")}
          value={omxValue}
          detail={omxStatus?.commit?.slice(0, 8) || undefined}
          dot={omxDot as "active" | "inactive" | "warning"}
          onClick={() => onNavigate("omx")}
        />
        <StatusCard
          label={t("dashboard.localApi")}
          value={apiValue}
          detail={localBaseUrl}
          dot={apiDot as "active" | "inactive" | "warning"}
          onClick={() => onNavigate("provider")}
        />
      </div>
    </div>
  );
}
