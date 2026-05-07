import { useState } from "react";
import { safeInvoke } from "../safeInvoke.js";
import type { ProxyStatus, ProviderConfig } from "../types.js";

export function useProxy(config: ProviderConfig, localBaseUrl: string) {
  const [status, setStatus] = useState<ProxyStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function failureStatus(message: string): ProxyStatus {
    return {
      running: false,
      healthy: false,
      url: localBaseUrl,
      message,
    };
  }

  async function start(): Promise<ProxyStatus | null> {
    setLoading(true);
    setError(null);
    try {
      const result = await safeInvoke<ProxyStatus>(
        "start_proxy",
        {
          settings: {
            responsesUrl: config.responsesUrl,
            apiKey: config.apiKey,
            completionsUrl: config.completionsUrl,
            completionsKey: config.completionsKey,
            host: config.host,
            port: Number(config.port),
          },
        },
        {
          running: false,
          healthy: false,
          url: localBaseUrl,
          message: "Browser preview: proxy start simulated",
        },
      );
      setStatus(result);
      return result;
    } catch (e) {
      const result = failureStatus(String(e));
      setError(result.message);
      setStatus(result);
      return result;
    } finally {
      setLoading(false);
    }
  }

  async function stop(): Promise<ProxyStatus | null> {
    setLoading(true);
    setError(null);
    try {
      const result = await safeInvoke<ProxyStatus>(
        "stop_proxy",
        undefined,
        {
          running: false,
          healthy: false,
          url: localBaseUrl,
          message: "Browser preview: proxy stop simulated",
        },
      );
      setStatus(result);
      return result;
    } catch (e) {
      const result = failureStatus(String(e));
      setError(result.message);
      setStatus(result);
      return result;
    } finally {
      setLoading(false);
    }
  }

  async function checkHealth(): Promise<ProxyStatus | null> {
    setLoading(true);
    setError(null);
    try {
      const result = await safeInvoke<ProxyStatus>(
        "proxy_status",
        { url: localBaseUrl.replace(/\/v1$/, "") },
        {
          running: false,
          healthy: false,
          url: localBaseUrl,
          message: "Browser preview: health check simulated",
        },
      );
      setStatus(result);
      return result;
    } catch (e) {
      const result = failureStatus(String(e));
      setError(result.message);
      setStatus(result);
      return result;
    } finally {
      setLoading(false);
    }
  }

  return {
    status,
    loading,
    error,
    start,
    stop,
    checkHealth,
  };
}
