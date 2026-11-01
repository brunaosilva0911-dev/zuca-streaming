"use client";

import { useEffect, useState } from "react";

import type { ConnectionState } from "@/lib/types";

interface NetworkSnapshot {
  state: ConnectionState;
  /** Latência aproximada da última sondagem, em ms. */
  latencyMs: number | null;
  effectiveType: string | null;
  downlinkMbps: number | null;
  lastCheckedAt: number;
}

const INITIAL: NetworkSnapshot = {
  state: "online",
  latencyMs: null,
  effectiveType: null,
  downlinkMbps: null,
  lastCheckedAt: Date.now(),
};

function readNetworkInformation(): {
  effectiveType: string | null;
  downlinkMbps: number | null;
} {
  if (typeof navigator === "undefined") {
    return { effectiveType: null, downlinkMbps: null };
  }
  const connection = (
    navigator as Navigator & {
      connection?: { effectiveType?: string; downlink?: number };
    }
  ).connection;
  return {
    effectiveType: connection?.effectiveType ?? null,
    downlinkMbps: connection?.downlink ?? null,
  };
}

/**
 * Monitora conectividade real: eventos online/offline, Network Information API
 * e uma sondagem HEAD periódica em `/api/health` para detectar rede degradada.
 */
export function useNetworkStatus(probeIntervalMs = 20_000): NetworkSnapshot {
  const [snapshot, setSnapshot] = useState<NetworkSnapshot>(INITIAL);

  useEffect(() => {
    let cancelled = false;

    async function probe() {
      if (cancelled) return;
      if (typeof navigator !== "undefined" && navigator.onLine === false) {
        setSnapshot((current) => ({
          ...current,
          state: "offline",
          lastCheckedAt: Date.now(),
        }));
        return;
      }

      const startedAt = performance.now();
      try {
        const response = await fetch("/api/health", {
          method: "GET",
          cache: "no-store",
          headers: { "x-zuca-probe": "1" },
        });
        const latencyMs = Math.round(performance.now() - startedAt);
        if (cancelled) return;
        const info = readNetworkInformation();
        const degraded =
          !response.ok ||
          latencyMs > 2500 ||
          (info.effectiveType != null && info.effectiveType === "2g");
        setSnapshot({
          state: degraded ? "slow" : "online",
          latencyMs,
          effectiveType: info.effectiveType,
          downlinkMbps: info.downlinkMbps,
          lastCheckedAt: Date.now(),
        });
      } catch {
        if (cancelled) return;
        setSnapshot((current) => ({
          ...current,
          state: "offline",
          latencyMs: null,
          lastCheckedAt: Date.now(),
        }));
      }
    }

    function handleOnline() {
      void probe();
    }
    function handleOffline() {
      setSnapshot((current) => ({ ...current, state: "offline", lastCheckedAt: Date.now() }));
    }

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    void probe();
    const timer = setInterval(() => void probe(), probeIntervalMs);

    return () => {
      cancelled = true;
      clearInterval(timer);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [probeIntervalMs]);

  return snapshot;
}
