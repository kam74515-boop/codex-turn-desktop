import type { ReactNode, MouseEventHandler } from "react";

type Variant = "primary" | "secondary" | "danger" | "ghost";
type Size = "sm" | "md";

export function ActionButton({
  variant = "primary",
  size = "md",
  loading = false,
  disabled = false,
  title,
  onClick,
  children,
}: {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  disabled?: boolean;
  title?: string;
  onClick?: MouseEventHandler<HTMLButtonElement>;
  children: ReactNode;
}) {
  const cls = [
    "btn",
    `btn-${variant}`,
    size === "sm" ? "btn-sm" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button className={cls} disabled={disabled || loading} title={title} onClick={onClick}>
      {loading && <span className="spinner" />}
      {children}
    </button>
  );
}
