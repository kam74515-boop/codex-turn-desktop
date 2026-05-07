import { useEffect } from "react";
import { useLang } from "../../i18n/index.js";
import { OmxVersionCard } from "./OmxVersionCard.js";
import { OmxDoctorCard } from "./OmxDoctorCard.js";
import { OmxSkillsGrid } from "./OmxSkillsGrid.js";
import { OmxWorkflowsCard } from "./OmxWorkflowsCard.js";
import { OmxCommandRunner } from "./OmxCommandRunner.js";
import type {
  OmxStatus,
  OmxUpdateInfo,
  OmxDoctorItem,
  OmxCatalog,
  OmxHud,
  OmxCommandResult,
  OmxPrerequisites,
} from "../../types.js";

export function OmxPage({
  status,
  updateInfo,
  doctorItems,
  catalog,
  hud,
  lastResult,
  prerequisites,
  loading,
  onLoadAll,
  onCheckPrerequisites,
  onInstall,
  onCheckUpdate,
  onApplyUpdate,
  onRunDoctor,
  onRunCommand,
}: {
  status: OmxStatus | null;
  updateInfo: OmxUpdateInfo | null;
  doctorItems: OmxDoctorItem[];
  catalog: OmxCatalog | null;
  hud: OmxHud | null;
  lastResult: OmxCommandResult | null;
  prerequisites: OmxPrerequisites | null;
  loading: boolean;
  onLoadAll: () => void;
  onCheckPrerequisites: () => void;
  onInstall: () => void;
  onCheckUpdate: () => void;
  onApplyUpdate: () => void;
  onRunDoctor: () => void;
  onRunCommand: (args: string[]) => void;
}) {
  const { t } = useLang();

  useEffect(() => {
    onCheckPrerequisites();
    onLoadAll();
  }, []);

  return (
    <div>
      <h1 className="page-title">{t("omx.title")}</h1>

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <OmxVersionCard
          status={status}
          updateInfo={updateInfo}
          prerequisites={prerequisites}
          loading={loading}
          onInstall={onInstall}
          onCheckUpdate={onCheckUpdate}
          onApplyUpdate={onApplyUpdate}
        />

        <OmxDoctorCard
          items={doctorItems}
          loading={loading}
          onRun={onRunDoctor}
        />

        <OmxWorkflowsCard hud={hud} />

        <OmxSkillsGrid catalog={catalog} />

        <OmxCommandRunner
          lastResult={lastResult}
          loading={loading}
          onRun={onRunCommand}
        />
      </div>
    </div>
  );
}
