import { useState, useEffect, useCallback } from "react";
import type { ProviderConfig } from "../types.js";

const STORAGE_KEY = "codex-turn-provider-configs";
const STORAGE_ACTIVE_KEY = "codex-turn-active-config-id";

function newId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function uniqueValue(base: string, used: string[]): string {
  const clean = base.trim() || "config";
  if (!used.includes(clean)) return clean;
  let index = 2;
  while (used.includes(`${clean}-${index}`)) index += 1;
  return `${clean}-${index}`;
}

function uniqueName(base: string, used: string[]): string {
  const clean = base.trim() || "New Config";
  if (!used.includes(clean)) return clean;
  let index = 2;
  while (used.includes(`${clean} ${index}`)) index += 1;
  return `${clean} ${index}`;
}

function defaultConfig(): ProviderConfig {
  return {
    id: newId(),
    name: "Default OpenAI",
    providerId: "codex-turn",
    profileId: "codex-turn",
    responsesUrl: "https://api.openai.com",
    apiKey: "",
    completionsUrl: "",
    completionsKey: "",
    model: "gpt-4o",
    host: "127.0.0.1",
    port: "9090",
    skillsToml: "",
    mcpToml: "",
    pluginsToml: "",
  };
}

function loadConfigs(): ProviderConfig[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as ProviderConfig[];
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {}
  return [defaultConfig()];
}

function loadActiveId(configs: ProviderConfig[]): string {
  const stored = localStorage.getItem(STORAGE_ACTIVE_KEY);
  if (stored && configs.some((c) => c.id === stored)) return stored;
  return configs[0]!.id;
}

export function useProviderConfigs() {
  const [configs, setConfigs] = useState<ProviderConfig[]>(loadConfigs);
  const [activeId, setActiveId] = useState<string>(() =>
    loadActiveId(configs),
  );

  // 自动保存
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(configs));
  }, [configs]);

  useEffect(() => {
    localStorage.setItem(STORAGE_ACTIVE_KEY, activeId);
  }, [activeId]);

  const active: ProviderConfig = configs.find((c) => c.id === activeId) ?? configs[0]!;

  const setActive = useCallback(
    (id: string) => {
      if (configs.some((c) => c.id === id)) setActiveId(id);
    },
    [configs],
  );

  const updateActive = useCallback(
    (patch: Partial<ProviderConfig>) => {
      setConfigs((prev) =>
        prev.map((c) => (c.id === activeId ? { ...c, ...patch } : c)),
      );
    },
    [activeId],
  );

  const addNew = useCallback(() => {
    let cfg = defaultConfig();
    cfg = {
      ...cfg,
      name: uniqueName("New Config", configs.map((c) => c.name)),
      providerId: uniqueValue("codex-turn", configs.map((c) => c.providerId)),
      profileId: uniqueValue("codex-turn", configs.map((c) => c.profileId)),
    };
    setConfigs((prev) => [...prev, cfg]);
    setActiveId(cfg.id);
  }, [configs]);

  const duplicate = useCallback(() => {
    const src = configs.find((c) => c.id === activeId);
    if (!src) return;
    const dup: ProviderConfig = {
      ...src,
      id: newId(),
      name: uniqueName(`${src.name} copy`, configs.map((c) => c.name)),
      providerId: uniqueValue(`${src.providerId}-copy`, configs.map((c) => c.providerId)),
      profileId: uniqueValue(`${src.profileId}-copy`, configs.map((c) => c.profileId)),
    };
    setConfigs((prev) => [...prev, dup]);
    setActiveId(dup.id);
  }, [configs, activeId]);

  const remove = useCallback(() => {
    if (configs.length <= 1) return;
    setConfigs((prev) => {
      const filtered = prev.filter((c) => c.id !== activeId);
      setActiveId(filtered[0]!.id);
      return filtered;
    });
  }, [configs, activeId]);

  const localBaseUrl = `http://${active.host}:${active.port}/v1`;

  return {
    configs,
    active,
    activeId,
    localBaseUrl,
    setActive,
    updateActive,
    addNew,
    duplicate,
    remove,
  };
}
