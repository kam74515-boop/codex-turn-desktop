import { useLang } from "../../i18n/index.js";

interface StatusBarProps {
  log: string;
  error?: string | null;
}

export function StatusBar({ log, error }: StatusBarProps) {
  const { t } = useLang();
  return (
    <div className={`status-bar${error ? " status-bar--error" : ""}`}>
      <span className="status-bar-log">
        {error || log || t("statusbar.ready")}
      </span>
    </div>
  );
}
