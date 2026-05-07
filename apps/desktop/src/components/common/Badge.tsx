type BadgeStatus = "pass" | "warn" | "fail" | "active" | "deprecated" | "core";

export function Badge({
  status,
  children,
}: {
  status: BadgeStatus;
  children: React.ReactNode;
}) {
  return <span className={`badge badge-${status}`}>{children}</span>;
}
