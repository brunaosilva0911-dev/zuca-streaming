"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { SpatialNavigationProvider } from "@/hooks/use-spatial-navigation";
import { OfflineBanner } from "@/components/ui/primitives";
import { useNetworkStatus } from "@/hooks/use-network-status";
import { useAppStore } from "@/stores/app-store";
import { FloatingPip } from "@/components/player/FloatingPip";

function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 45_000,
        gcTime: 10 * 60_000,
        retry: 2,
        refetchOnWindowFocus: false,
        refetchOnReconnect: "always",
      },
      mutations: { retry: 1 },
    },
  });
}

function NetworkWatcher(): React.JSX.Element {
  const { state } = useNetworkStatus(25_000);
  const setDataSaver = useAppStore((store) => store.setDataSaver);

  useEffect(() => {
    // Em rede degradada reduzimos automaticamente a agressividade do polling.
    if (state === "slow") setDataSaver(true);
  }, [state, setDataSaver]);

  useEffect(() => {
    document.documentElement.setAttribute("data-network", state);
  }, [state]);

  return <OfflineBanner visible={state === "offline"} />;
}

function ReducedMotionWatcher(): null {
  const setReducedMotion = useAppStore((store) => store.setReducedMotion);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReducedMotion(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, [setReducedMotion]);

  return null;
}

function TvDetectionWatcher(): null {
  const setInputMode = useAppStore((store) => store.setInputMode);
  const setSafeAreaEnabled = useAppStore((store) => store.setSafeAreaEnabled);

  useEffect(() => {
    const ua = navigator.userAgent.toLowerCase();
    const isTv =
      ua.includes("smart-tv") ||
      ua.includes("smarttv") ||
      ua.includes("tizen") ||
      ua.includes("webos") ||
      ua.includes("bravia") ||
      ua.includes("android tv") ||
      ua.includes("aftm") ||
      ua.includes("googletv") ||
      ua.includes("hbbtv");

    const hasCoarsePointer = window.matchMedia("(pointer: coarse)").matches;
    if (isTv) {
      setInputMode("remote");
      setSafeAreaEnabled(true);
    } else if (hasCoarsePointer) {
      setInputMode("touch");
    } else {
      setInputMode("mouse");
    }
  }, [setInputMode, setSafeAreaEnabled]);

  return null;
}

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(makeQueryClient);
  const safeAreaEnabled = useAppStore((store) => store.safeAreaEnabled);

  const shellClassName = useMemo(
    () => (safeAreaEnabled ? "safe-area-x" : undefined),
    [safeAreaEnabled],
  );

  return (
    <QueryClientProvider client={queryClient}>
      <SpatialNavigationProvider>
        <NetworkWatcher />
        <ReducedMotionWatcher />
        <TvDetectionWatcher />
        <div className={shellClassName}>{children}</div>
        <FloatingPip />
      </SpatialNavigationProvider>
    </QueryClientProvider>
  );
}
