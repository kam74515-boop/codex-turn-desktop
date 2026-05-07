import { useState } from "react";
import { useLang } from "../../i18n/index.js";
import { Badge } from "../common/Badge.js";
import { EmptyState } from "../common/EmptyState.js";
import type { OmxCatalog, OmxCatalogSkill } from "../../types.js";

const categories = ["execution", "planning", "shortcut", "utility"] as const;

export function OmxSkillsGrid({ catalog }: { catalog: OmxCatalog | null }) {
  const { t } = useLang();
  const [activeTab, setActiveTab] = useState<string>("all");

  if (!catalog) {
    return (
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">{t("omx.skills")}</h2>
        </div>
        <EmptyState text={t("status.loading")} />
      </div>
    );
  }

  const activeSkills = catalog.skills.filter((s) => s.status === "active");
  const filteredSkills =
    activeTab === "all"
      ? activeSkills
      : activeSkills.filter((s) => s.category === activeTab);

  return (
    <div className="card">
      <div className="card-header">
        <h2 className="card-title">{t("omx.skills")}</h2>
        <div className="flex gap-8 items-center">
          <span className="text-sm text-secondary">
            {t("omx.skills.total")}: {catalog.counts.skillCount}
          </span>
          <span className="text-sm text-secondary">
            {t("omx.skills.active")}: {catalog.counts.activeSkillCount}
          </span>
        </div>
      </div>

      <div className="tab-group mb-16">
        <button
          className={`tab-item${activeTab === "all" ? " active" : ""}`}
          onClick={() => setActiveTab("all")}
        >
          All
        </button>
        {categories.map((cat) => (
          <button
            key={cat}
            className={`tab-item${activeTab === cat ? " active" : ""}`}
            onClick={() => setActiveTab(cat)}
          >
            {t(`omx.skills.category.${cat}`)}
          </button>
        ))}
      </div>

      {filteredSkills.length === 0 ? (
        <EmptyState text={t("status.none")} />
      ) : (
        <div>
          {filteredSkills.map((skill) => (
            <SkillItem key={skill.name} skill={skill} coreSkills={catalog.coreSkills} />
          ))}
        </div>
      )}
    </div>
  );
}

function SkillItem({
  skill,
  coreSkills,
}: {
  skill: OmxCatalogSkill;
  coreSkills: string[];
}) {
  const isCore = coreSkills.includes(skill.name);
  return (
    <div className="list-item">
      <div>
        <div className="list-item-name">
          {skill.name}
          {isCore && (
            <Badge status="core">core</Badge>
          )}
        </div>
        {skill.description && (
          <div className="list-item-desc">{skill.description}</div>
        )}
      </div>
      <div className="list-item-meta">
        <Badge status={skill.status === "active" ? "active" : "deprecated"}>
          {skill.status}
        </Badge>
      </div>
    </div>
  );
}
