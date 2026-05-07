type DotStatus = "active" | "inactive" | "warning";

export function StatusCard({
  label,
  value,
  detail,
  dot = "inactive",
  onClick,
}: {
  label: string;
  value: string;
  detail?: string;
  dot?: DotStatus;
  onClick?: () => void;
}) {
  return (
    <div className="status-card" onClick={onClick}>
      <div className="status-card-header">
        <span className={`status-dot ${dot}`} />
        <span className="status-card-label">{label}</span>
      </div>
      <div className="status-card-value">{value}</div>
      {detail && <div className="status-card-detail">{detail}</div>}
    </div>
  );
}
