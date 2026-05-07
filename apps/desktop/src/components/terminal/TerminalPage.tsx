import { useState, type FormEvent } from "react";
import { useLang } from "../../i18n/index.js";
import { ActionButton } from "../common/ActionButton.js";
import { CodeBlock } from "../common/CodeBlock.js";
import { EmptyState } from "../common/EmptyState.js";
import { FormField } from "../common/FormField.js";
import type { TerminalEntry } from "../../types.js";

function terminalOutput(entry: TerminalEntry): string {
  const parts = [
    `$ ${entry.command}`,
    `cwd: ${entry.cwd}`,
    `exit: ${entry.code ?? "signal"}`,
  ];
  if (entry.stdout.trim()) parts.push("\nstdout\n" + entry.stdout.trimEnd());
  if (entry.stderr.trim()) parts.push("\nstderr\n" + entry.stderr.trimEnd());
  return parts.join("\n");
}

export function TerminalPage({
  cwd,
  entries,
  loading,
  onCwdChange,
  onRun,
  onClear,
}: {
  cwd: string;
  entries: TerminalEntry[];
  loading: boolean;
  onCwdChange: (value: string) => void;
  onRun: (command: string) => void;
  onClear: () => void;
}) {
  const { t } = useLang();
  const [command, setCommand] = useState("");

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const value = command.trim();
    if (!value) return;
    onRun(value);
    setCommand("");
  };

  return (
    <div>
      <h1 className="page-title">{t("terminal.title")}</h1>

      <div className="card">
        <form className="terminal-form" onSubmit={submit}>
          <FormField
            label={t("terminal.cwd")}
            value={cwd}
            placeholder={t("terminal.cwd.placeholder")}
            onChange={onCwdChange}
            full
          />
          <div className="terminal-command-row">
            <label className="form-label" htmlFor="terminal-command">
              {t("terminal.command")}
            </label>
            <div className="terminal-command-input">
              <input
                id="terminal-command"
                value={command}
                placeholder={t("terminal.command.placeholder")}
                onChange={(event) => setCommand(event.target.value)}
              />
              <ActionButton loading={loading} disabled={!command.trim()}>
                {t("terminal.run")}
              </ActionButton>
            </div>
          </div>
        </form>
      </div>

      <div className="card mt-16">
        <div className="card-header">
          <h2 className="card-title">{t("terminal.output")}</h2>
          <ActionButton
            variant="ghost"
            size="sm"
            disabled={entries.length === 0}
            onClick={onClear}
          >
            {t("terminal.clear")}
          </ActionButton>
        </div>
        {entries.length === 0 ? (
          <EmptyState text={t("terminal.empty")} />
        ) : (
          <div className="terminal-output-list">
            {entries.map((entry) => (
              <div key={entry.id} className="terminal-entry">
                <div className="terminal-entry-meta">
                  <span>{entry.createdAt}</span>
                  <span className={entry.code === 0 ? "text-ok" : "text-danger"}>
                    {entry.code === 0 ? t("terminal.success") : t("terminal.failed")}
                  </span>
                </div>
                <CodeBlock maxHeight={360}>{terminalOutput(entry)}</CodeBlock>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
