import { useState } from "react";
import { useLang } from "../../i18n/index.js";
import { ActionButton } from "../common/ActionButton.js";
import { CodeBlock } from "../common/CodeBlock.js";
import type { OmxCommandResult } from "../../types.js";

export function OmxCommandRunner({
  lastResult,
  loading,
  onRun,
}: {
  lastResult: OmxCommandResult | null;
  loading: boolean;
  onRun: (args: string[]) => void;
}) {
  const { t } = useLang();
  const [input, setInput] = useState("");

  const handleRun = () => {
    const trimmed = input.trim();
    if (!trimmed) return;
    onRun(trimmed.split(/\s+/));
  };

  const output = lastResult
    ? lastResult.stdout
      ? lastResult.stdout
      : lastResult.stderr
        ? `Error:\n${lastResult.stderr}`
        : ""
    : "";

  return (
    <div className="card">
      <div className="card-header">
        <h2 className="card-title">{t("omx.commands")}</h2>
      </div>

      <div className="btn-group mb-8">
        <ActionButton
          variant="primary"
          size="sm"
          loading={loading}
          onClick={() => onRun(["setup"])}
        >
          {t("omx.commands.setup")}
        </ActionButton>
        <ActionButton
          variant="secondary"
          size="sm"
          loading={loading}
          onClick={() => onRun(["cleanup"])}
        >
          {t("omx.commands.cleanup")}
        </ActionButton>
        <ActionButton
          variant="danger"
          size="sm"
          loading={loading}
          onClick={() => onRun(["cancel"])}
        >
          {t("omx.commands.cancel")}
        </ActionButton>
      </div>

      <div className="flex gap-8 mt-12">
        <input
          value={input}
          placeholder={t("omx.commands.placeholder")}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleRun()}
          style={{ flex: 1 }}
        />
        <ActionButton
          variant="secondary"
          loading={loading}
          onClick={handleRun}
        >
          {t("omx.commands.run")}
        </ActionButton>
      </div>

      {output && (
        <div className="mt-12">
          <h3 className="card-title text-sm mb-8">{t("omx.commands.output")}</h3>
          <CodeBlock maxHeight={240}>{output}</CodeBlock>
        </div>
      )}
    </div>
  );
}
