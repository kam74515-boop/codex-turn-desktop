import { useState, useCallback, useEffect } from "react";
import { Sidebar } from "./components/layout/Sidebar.js";
import { StatusBar } from "./components/layout/StatusBar.js";
import { DashboardPage } from "./components/dashboard/DashboardPage.js";
import { ProviderPage } from "./components/provider/ProviderPage.js";
import { CodexPage } from "./components/codex/CodexPage.js";
import { OmxPage } from "./components/omx/OmxPage.js";
import { TerminalPage } from "./components/terminal/TerminalPage.js";
import { HistoryPage } from "./components/history/HistoryPage.js";
import { useProxy } from "./hooks/useProxy.js";
import { useCodexConfig } from "./hooks/useCodexConfig.js";
import { useOmx } from "./hooks/useOmx.js";
import { useProviderConfigs } from "./hooks/useProviderConfigs.js";
import { useTerminal } from "./hooks/useTerminal.js";
import { useConversationHistory } from "./hooks/useConversationHistory.js";
import type { PageId } from "./types.js";

export function App() {
  const [page, setPage] = useState<PageId>("dashboard");
  const [log, setLog] = useState<string>("");
  const [historyLoaded, setHistoryLoaded] = useState(false);

  const providerConfigs = useProviderConfigs();
  const proxy = useProxy(providerConfigs.active, providerConfigs.localBaseUrl);
  const codex = useCodexConfig();
  const omx = useOmx();
  const terminal = useTerminal();
  const history = useConversationHistory();

  const proxyStatus = proxy.status;
  const codexStatus = codex.configStatus;
  const omxStatus = omx.status;

  // 仪表台刷新：并行加载所有状态
  const refreshDashboard = useCallback(async () => {
    await Promise.all([
      proxy.checkHealth().catch(() => {}),
      codex.loadStatus(providerConfigs.active).catch(() => {}),
      omx.loadStatus().catch(() => {}),
    ]);
  }, [proxy, codex, omx, providerConfigs.active]);

  // 代理操作 — 先写入 codex 配置，再启动代理
  const handleProxyStart = useCallback(async () => {
    const applied = await codex.applyConfig(providerConfigs.active, providerConfigs.localBaseUrl);
    if (!applied) {
      setLog("Codex config failed to apply; proxy not started");
      return;
    }

    const result = await proxy.start();
    if (result?.running) {
      setLog(`Codex config applied + proxy started. Run: codex -p ${providerConfigs.active.profileId}`);
    } else {
      setLog(`Codex config applied. Proxy failed: ${result?.message || "Proxy failed to start"}`);
    }
  }, [proxy, codex, providerConfigs.active, providerConfigs.localBaseUrl]);

  const handleProxyStop = useCallback(async () => {
    const result = await proxy.stop();
    setLog(result?.message || "Proxy stopped");
  }, [proxy]);

  const handleProxyHealth = useCallback(async () => {
    const result = await proxy.checkHealth();
    setLog(result?.message || "Health check done");
  }, [proxy]);

  // Codex 操作
  const handleCodexPreview = useCallback(async () => {
    await codex.previewConfig(providerConfigs.active, providerConfigs.localBaseUrl);
    setLog("Codex config preview generated");
  }, [codex, providerConfigs.active, providerConfigs.localBaseUrl]);

  const handleCodexApply = useCallback(async () => {
    await codex.applyConfig(providerConfigs.active, providerConfigs.localBaseUrl);
    setLog(`Codex config applied. Run: codex -p ${providerConfigs.active.profileId}`);
  }, [codex, providerConfigs.active, providerConfigs.localBaseUrl]);

  const handleCodexRestore = useCallback(async () => {
    await codex.restoreDefault();
    setLog("Codex config restored to default");
  }, [codex]);

  // OMX 操作
  const handleOmxCheckPrerequisites = useCallback(async () => {
    await omx.checkPrerequisites();
  }, [omx]);

  const handleOmxInstall = useCallback(async () => {
    const result = await omx.install();
    setLog(result?.stdout?.slice(0, 100) || "Install complete");
  }, [omx]);

  const handleOmxCheckUpdate = useCallback(async () => {
    await omx.checkUpdate();
    setLog("Update check complete");
  }, [omx]);

  const handleOmxApplyUpdate = useCallback(async () => {
    await omx.applyUpdate();
    setLog(omx.lastResult?.stdout?.slice(0, 100) || "Update complete");
  }, [omx]);

  const handleOmxDoctor = useCallback(async () => {
    await omx.runDoctor();
    setLog(`Doctor check: ${omx.doctorItems.length} items`);
  }, [omx]);

  const handleOmxCommand = useCallback(
    async (args: string[]) => {
      const result = await omx.runCommand(args);
      setLog(
        result.stdout
          ? result.stdout.slice(0, 120)
          : result.stderr
            ? `Error: ${result.stderr.slice(0, 120)}`
            : "Command executed",
      );
    },
    [omx],
  );

  // OMX 命令执行后的日志更新
  const wrappedOmxRunDoctor = useCallback(async () => {
    await handleOmxDoctor();
    setLog(`Doctor check: ${omx.doctorItems.length} items`);
  }, [handleOmxDoctor, omx.doctorItems.length]);

  const handleTerminalRun = useCallback(
    async (command: string) => {
      const result = await terminal.run(command);
      if (result) {
        setLog(`Terminal: ${result.code === 0 ? "ok" : "exit " + (result.code ?? "signal")}`);
      }
    },
    [terminal],
  );

  const handleHistoryRefresh = useCallback(async () => {
    const sessions = await history.loadSessions();
    setHistoryLoaded(true);
    if (sessions[0]) {
      await history.openConversation(history.selectedPath || sessions[0].path);
    }
    setLog(`History: ${sessions.length} sessions`);
  }, [history]);

  useEffect(() => {
    if (page === "history" && !historyLoaded && !history.loading) {
      void handleHistoryRefresh();
    }
  }, [page, historyLoaded, history.loading, handleHistoryRefresh]);

  return (
    <main className="shell">
      <Sidebar active={page} onNavigate={setPage} />
      <div className="content">
        {page === "dashboard" && (
          <DashboardPage
            proxyStatus={proxyStatus}
            codexStatus={codexStatus}
            omxStatus={omxStatus}
            localBaseUrl={providerConfigs.localBaseUrl}
            onNavigate={setPage}
            onRefresh={refreshDashboard}
          />
        )}

        {page === "provider" && (
          <ProviderPage
            configs={providerConfigs.configs}
            active={providerConfigs.active}
            activeId={providerConfigs.activeId}
            onSelect={providerConfigs.setActive}
            onUpdate={providerConfigs.updateActive}
            onNew={providerConfigs.addNew}
            onCopy={providerConfigs.duplicate}
            onDelete={providerConfigs.remove}
            status={proxyStatus}
            loading={proxy.loading}
            localBaseUrl={providerConfigs.localBaseUrl}
            onStart={handleProxyStart}
            onStop={handleProxyStop}
            onHealth={handleProxyHealth}
          />
        )}

        {page === "codex" && (
          <CodexPage
            config={providerConfigs.active}
            preview={codex.preview}
            configStatus={codexStatus}
            loading={codex.loading}
            onPreview={handleCodexPreview}
            onApply={handleCodexApply}
            onRestore={handleCodexRestore}
          />
        )}

        {page === "omx" && (
          <OmxPage
            status={omx.status}
            updateInfo={omx.updateInfo}
            doctorItems={omx.doctorItems}
            catalog={omx.catalog}
            hud={omx.hud}
            lastResult={omx.lastResult}
            prerequisites={omx.prerequisites}
            loading={omx.loading}
            onLoadAll={omx.loadAll}
            onCheckPrerequisites={handleOmxCheckPrerequisites}
            onInstall={handleOmxInstall}
            onCheckUpdate={handleOmxCheckUpdate}
            onApplyUpdate={handleOmxApplyUpdate}
            onRunDoctor={wrappedOmxRunDoctor}
            onRunCommand={handleOmxCommand}
          />
        )}

        {page === "terminal" && (
          <TerminalPage
            cwd={terminal.cwd}
            entries={terminal.entries}
            loading={terminal.loading}
            onCwdChange={terminal.setCwd}
            onRun={(command) => void handleTerminalRun(command)}
            onClear={terminal.clear}
          />
        )}

        {page === "history" && (
          <HistoryPage
            sessions={history.sessions}
            selectedPath={history.selectedPath}
            detail={history.detail}
            loading={history.loading}
            onRefresh={() => void handleHistoryRefresh()}
            onOpen={(path) => void history.openConversation(path)}
          />
        )}

        <StatusBar
          log={log}
          error={proxy.error || codex.error || omx.error || terminal.error || history.error}
        />
      </div>
    </main>
  );
}
