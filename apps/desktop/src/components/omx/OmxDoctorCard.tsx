import { useLang } from "../../i18n/index.js";
import { ActionButton } from "../common/ActionButton.js";
import { Badge } from "../common/Badge.js";
import { EmptyState } from "../common/EmptyState.js";
import type { OmxDoctorItem } from "../../types.js";

export function OmxDoctorCard({
  items,
  loading,
  onRun,
}: {
  items: OmxDoctorItem[];
  loading: boolean;
  onRun: () => void;
}) {
  const { t } = useLang();

  const statusLabel = (s: string) => {
    if (s === "pass") return t("omx.skills.status.active");
    if (s === "warn") return "Warning";
    return "Fail";
  };

  return (
    <div className="card">
      <div className="card-header">
        <h2 className="card-title">{t("omx.doctor")}</h2>
        <ActionButton variant="secondary" size="sm" loading={loading} onClick={onRun}>
          {t("omx.runDoctor")}
        </ActionButton>
      </div>

      {items.length === 0 ? (
        <EmptyState text={t("omx.runDoctor")} />
      ) : (
        <div>
          {items.map((item, i) => (
            <div className="list-item" key={i}>
              <div>
                <div className="list-item-name">{item.name}</div>
                {item.message && (
                  <div className="list-item-desc">{item.message}</div>
                )}
              </div>
              <Badge status={item.status as "pass" | "warn" | "fail"}>
                {statusLabel(item.status)}
              </Badge>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
