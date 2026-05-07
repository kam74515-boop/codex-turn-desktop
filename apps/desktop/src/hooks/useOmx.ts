import { useState } from "react";
import { safeInvoke } from "../safeInvoke.js";
import type {
  OmxStatus,
  OmxUpdateInfo,
  OmxDoctorItem,
  OmxCatalog,
  OmxHud,
  OmxCommandResult,
  OmxPrerequisites,
} from "../types.js";

export function useOmx() {
  const [status, setStatus] = useState<OmxStatus | null>(null);
  const [updateInfo, setUpdateInfo] = useState<OmxUpdateInfo | null>(null);
  const [doctorItems, setDoctorItems] = useState<OmxDoctorItem[]>([]);
  const [catalog, setCatalog] = useState<OmxCatalog | null>(null);
  const [hud, setHud] = useState<OmxHud | null>(null);
  const [lastResult, setLastResult] = useState<OmxCommandResult | null>(null);
  const [prerequisites, setPrerequisites] = useState<OmxPrerequisites | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadStatus() {
    try {
      const result = await safeInvoke<OmxStatus>(
        "omx_status",
        undefined,
        {
          vendorRoot: "vendor/oh-my-codex",
          commit: "cc967566",
          ready: false,
        },
      );
      setStatus(result);
    } catch (e) {
      setError(String(e));
    }
  }

  async function loadCatalog() {
    try {
      const result = await safeInvoke<OmxCatalog | null>(
        "omx_read_catalog",
        undefined,
        null,
      );
      if (result) setCatalog(result);
    } catch {
      // catalog 不可用时静默失败
    }
  }

  async function loadHud() {
    try {
      const result = await safeInvoke<OmxCommandResult>(
        "omx_run_command",
        { args: ["hud", "--json"] },
        { command: "omx hud --json", code: 0, stdout: "{}", stderr: "" },
      );
      if (result.code === 0 && result.stdout.trim()) {
        const parsed = JSON.parse(result.stdout.trim());
        setHud(parsed);
      }
    } catch {
      // hud 不可用时静默失败
    }
  }

  async function loadAll() {
    setLoading(true);
    setError(null);
    try {
      await Promise.all([loadStatus(), loadCatalog(), loadHud()]);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  async function checkPrerequisites() {
    try {
      const result = await safeInvoke<OmxPrerequisites>(
        "omx_check_prerequisites",
        undefined,
        { git: true, node: true, npm: true, allMet: true },
      );
      setPrerequisites(result);
      return result;
    } catch (e) {
      setError(String(e));
      return null;
    }
  }

  async function install() {
    setLoading(true);
    setError(null);
    try {
      const result = await safeInvoke<OmxCommandResult>(
        "omx_install",
        undefined,
        {
          command: "omx_install",
          code: 0,
          stdout: "Browser preview: install simulated",
          stderr: "",
        },
      );
      setLastResult(result);
      await loadStatus();
      return result;
    } catch (e) {
      setError(String(e));
      const errResult: OmxCommandResult = {
        command: "omx_install",
        code: 1,
        stdout: "",
        stderr: String(e),
      };
      setLastResult(errResult);
      return errResult;
    } finally {
      setLoading(false);
    }
  }

  async function checkUpdate() {
    setLoading(true);
    setError(null);
    try {
      const result = await safeInvoke<OmxUpdateInfo>(
        "omx_check_update",
        undefined,
        {
          currentCommit: "local-dev",
          latestCommit: "local-dev",
          behind: 0,
          updateAvailable: false,
          latestDate: new Date().toISOString(),
          latestMessage: "Browser preview: update check simulated",
        },
      );
      setUpdateInfo(result);
    } catch (e) {
      setError(String(e));
      setLastResult({
        command: "omx_check_update",
        code: 1,
        stdout: "",
        stderr: String(e),
      });
    } finally {
      setLoading(false);
    }
  }

  async function applyUpdate() {
    setLoading(true);
    setError(null);
    try {
      const result = await safeInvoke<OmxCommandResult>(
        "omx_apply_update",
        undefined,
        {
          command: "omx_apply_update",
          code: 0,
          stdout: "Browser preview: update simulated",
          stderr: "",
        },
      );
      setLastResult(result);
      await loadStatus();
    } catch (e) {
      setError(String(e));
      setLastResult({
        command: "omx_apply_update",
        code: 1,
        stdout: "",
        stderr: String(e),
      });
    } finally {
      setLoading(false);
    }
  }

  async function runDoctor() {
    setLoading(true);
    setError(null);
    try {
      const result = await safeInvoke<OmxDoctorItem[]>(
        "omx_doctor_parse",
        undefined,
        [],
      );
      setDoctorItems(result);
    } catch (e) {
      setError(String(e));
      setLastResult({
        command: "omx doctor",
        code: 1,
        stdout: "",
        stderr: String(e),
      });
    } finally {
      setLoading(false);
    }
  }

  async function runCommand(args: string[]) {
    setLoading(true);
    setError(null);
    try {
      const result = await safeInvoke<OmxCommandResult>(
        "omx_run_command",
        { args },
        {
          command: `omx ${args.join(" ")}`,
          code: 0,
          stdout: "Browser preview: command simulated",
          stderr: "",
        },
      );
      setLastResult(result);
      return result;
    } catch (e) {
      setError(String(e));
      const errResult: OmxCommandResult = {
        command: `omx ${args.join(" ")}`,
        code: 1,
        stdout: "",
        stderr: String(e),
      };
      setLastResult(errResult);
      return errResult;
    } finally {
      setLoading(false);
    }
  }

  return {
    status,
    updateInfo,
    doctorItems,
    catalog,
    hud,
    lastResult,
    prerequisites,
    loading,
    error,
    loadAll,
    loadStatus,
    checkPrerequisites,
    install,
    checkUpdate,
    applyUpdate,
    runDoctor,
    runCommand,
  };
}
