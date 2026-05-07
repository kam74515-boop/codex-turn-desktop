export function StatusLine({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="status-line">
      <span className="status-line-label">{label}</span>
      <strong className="status-line-value">{value}</strong>
    </div>
  );
}
