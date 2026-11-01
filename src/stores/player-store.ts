"use client";

import { create } from "zustand";
import type { PlayerPhase } from "@/lib/types";

export interface ActivePlayback {
  channelId: string;
  channelName: string;
  logo: string;
  source: string;
  /** Rota onde a reprodução começou — usada para "voltar ao canal". */
  originPath: string;
}

interface PlayerState {
  phase: PlayerPhase;
  active: ActivePlayback | null;
  volume: number;
  muted: boolean;
  ambientEnabled: boolean;
  ambientColors: { top: string; bottom: string; left: string; right: string } | null;
  controlsVisible: boolean;
  interactivePanelOpen: boolean;
  qualityLabel: string;
  retryCount: number;

  /** PiP flutuante global: sobrevive à navegação entre rotas. */
  pip: { enabled: boolean; playback: ActivePlayback | null };
  pipPosition: { x: number; y: number };

  setPhase: (phase: PlayerPhase) => void;
  setActive: (playback: ActivePlayback | null) => void;
  setVolume: (volume: number) => void;
  toggleMuted: () => void;
  setAmbientEnabled: (enabled: boolean) => void;
  setAmbientColors: (colors: PlayerState["ambientColors"]) => void;
  setControlsVisible: (visible: boolean) => void;
  setInteractivePanelOpen: (open: boolean) => void;
  setQualityLabel: (label: string) => void;
  registerRetry: () => void;
  resetRetries: () => void;

  openPip: () => void;
  closePip: () => void;
  movePip: (position: { x: number; y: number }) => void;
}

export const usePlayerStore = create<PlayerState>((set, get) => ({
  phase: "idle",
  active: null,
  volume: 0.9,
  muted: false,
  ambientEnabled: true,
  ambientColors: null,
  controlsVisible: true,
  interactivePanelOpen: false,
  qualityLabel: "Auto",
  retryCount: 0,

  pip: { enabled: false, playback: null },
  pipPosition: { x: 1, y: 1 },

  setPhase: (phase) => set({ phase }),

  setActive: (active) =>
    set({
      active,
      phase: active ? "loading" : "idle",
      retryCount: 0,
    }),

  setVolume: (volume) =>
    set({ volume: Math.min(1, Math.max(0, volume)), muted: volume <= 0 }),

  toggleMuted: () => set({ muted: !get().muted }),

  setAmbientEnabled: (ambientEnabled) => set({ ambientEnabled }),
  setAmbientColors: (ambientColors) => set({ ambientColors }),
  setControlsVisible: (controlsVisible) => set({ controlsVisible }),
  setInteractivePanelOpen: (interactivePanelOpen) => set({ interactivePanelOpen }),
  setQualityLabel: (qualityLabel) => set({ qualityLabel }),
  registerRetry: () => set({ retryCount: get().retryCount + 1 }),
  resetRetries: () => set({ retryCount: 0 }),

  openPip: () => {
    const active = get().active;
    if (!active) return;
    set({ pip: { enabled: true, playback: active } });
  },

  closePip: () => set({ pip: { enabled: false, playback: null }, phase: "idle" }),

  movePip: (pipPosition) => set({ pipPosition }),
}));

/**
 * Seletores finos — evitam re-render de toda a árvore em Smart TVs.
 */
export const selectPip = (state: PlayerState) => state.pip;
export const selectPhase = (state: PlayerState) => state.phase;
export const selectActive = (state: PlayerState) => state.active;
export const selectAmbient = (state: PlayerState) => state.ambientColors;
