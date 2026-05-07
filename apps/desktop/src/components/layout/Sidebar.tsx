import { useLang } from "../../i18n/index.js";
import type { PageId } from "../../types.js";

const navItems: { id: PageId; key: string }[] = [
  { id: "dashboard", key: "nav.dashboard" },
  { id: "provider", key: "nav.provider" },
  { id: "codex", key: "nav.codex" },
  { id: "omx", key: "nav.omx" },
  { id: "terminal", key: "nav.terminal" },
  { id: "history", key: "nav.history" },
];

export function Sidebar({
  active,
  onNavigate,
}: {
  active: PageId;
  onNavigate: (id: PageId) => void;
}) {
  const { t, lang, setLang } = useLang();

  return (
    <aside className="sidebar">
      <div className="brand">{t("app.title")}</div>
      <nav className="sidebar-nav">
        {navItems.map((item) => (
          <a
            key={item.id}
            className={`nav-item${active === item.id ? " active" : ""}`}
            onClick={() => onNavigate(item.id)}
          >
            {t(item.key)}
          </a>
        ))}
      </nav>
      <div className="sidebar-footer">
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => setLang(lang === "zh" ? "en" : "zh")}
          style={{ width: "100%", justifyContent: "center" }}
        >
          {t("lang.switch")}
        </button>
      </div>
    </aside>
  );
}
