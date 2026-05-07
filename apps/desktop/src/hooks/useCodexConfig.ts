import { useState } from "react";
import { safeInvoke } from "../safeInvoke.js";
import type { CodexPreview, CodexConfigStatus, ProviderConfig } from "../types.js";

function previewFallback(config: ProviderConfig, localBaseUrl: string): CodexPreview {
  return {
    command: `codex -p ${config.profileId}`,
    configPath: "~/.codex/config.toml",
    after: `[model_providers.${config.providerId}]
name = "${config.name}"
base_url = "${localBaseUrl}"
wire_api = "responses"

[profiles.${config.profileId}]
model_provider = "${config.providerId}"
model = "${config.model}"
`,
  };
}

function toInput(config: ProviderConfig, localBaseUrl: string) {
  return {
    baseUrl: localBaseUrl,
    model: config.model,
    providerId: config.providerId,
    profileId: config.profileId,
    name: config.name,
    skillsToml: config.skillsToml,
    mcpToml: config.mcpToml,
    pluginsToml: config.pluginsToml,
  };
}

export function useCodexConfig() {
  const [preview, setPreview] = useState<CodexPreview | null>(null);
  const [configStatus, setConfigStatus] = useState<CodexConfigStatus | null>(
    null,
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadStatus(config: ProviderConfig) {
    try {
      const result = await safeInvoke<CodexConfigStatus>(
        "codex_config_status",
        { input: { providerId: config.providerId, profileId: config.profileId } },
        {
          configPath: "~/.codex/config.toml",
          exists: false,
          hasCodexTurn: false,
        },
      );
      setConfigStatus(result);
    } catch (e) {
      setError(String(e));
    }
  }

  async function previewConfig(config: ProviderConfig, localBaseUrl: string) {
    setLoading(true);
    setError(null);
    try {
      const result = await safeInvoke<CodexPreview>(
        "preview_codex_config",
        { input: toInput(config, localBaseUrl) },
        previewFallback(config, localBaseUrl),
      );
      setPreview(result);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  async function applyConfig(config: ProviderConfig, localBaseUrl: string) {
    setLoading(true);
    setError(null);
    try {
      const result = await safeInvoke<CodexPreview>(
        "apply_codex_config",
        { input: toInput(config, localBaseUrl) },
        {
          ...previewFallback(config, localBaseUrl),
          command: `codex -p ${config.profileId} (browser preview)`,
        },
      );
      setPreview(result);
      await loadStatus(config);
      return result;
    } catch (e) {
      setError(String(e));
      return null;
    } finally {
      setLoading(false);
    }
  }

  async function restoreDefault() {
    setLoading(true);
    setError(null);
    try {
      const result = await safeInvoke<CodexPreview>(
        "restore_codex_default",
        undefined,
        {
          command: "codex (default config)",
          configPath: "~/.codex/config.toml",
          after: "",
        },
      );
      setPreview(result);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  return {
    preview,
    configStatus,
    loading,
    error,
    loadStatus,
    previewConfig,
    applyConfig,
    restoreDefault,
  };
}
