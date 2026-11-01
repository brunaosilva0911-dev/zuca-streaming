"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

import type { Profile } from "@/lib/types";

export type InputMode = "mouse" | "touch" | "remote";

interface AppState {
  /** Perfil ativo da casa. */
  activeProfileId: string | null;
  profiles: Profile[];
  profileUnlocked: boolean;

  /** Modo de entrada detectado — controla a navegação espacial (D-Pad). */
  inputMode: InputMode;
  spatialEnabled: boolean;
  safeAreaEnabled: boolean;
  reducedMotion: boolean;
  ambientByDefault: boolean;
  dataSaver: boolean;

  /** Filtro SFW — sempre ligado e não pode ser desativado pelo usuário. */
  familyMode: true;

  setProfiles: (profiles: Profile[]) => void;
  setActiveProfile: (id: string | null) => void;
  setProfileUnlocked: (unlocked: boolean) => void;
  setInputMode: (mode: InputMode) => void;
  setSpatialEnabled: (enabled: boolean) => void;
  setSafeAreaEnabled: (enabled: boolean) => void;
  setReducedMotion: (enabled: boolean) => void;
  setAmbientByDefault: (enabled: boolean) => void;
  setDataSaver: (enabled: boolean) => void;
  reset: () => void;
}

const DEFAULTS = {
  activeProfileId: null,
  profileUnlocked: false,
  inputMode: "mouse" as InputMode,
  spatialEnabled: true,
  safeAreaEnabled: true,
  reducedMotion: false,
  ambientByDefault: true,
  dataSaver: false,
  familyMode: true as const,
};

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      ...DEFAULTS,
      profiles: [],

      setProfiles: (profiles) =>
        set((state) => ({
          profiles,
          activeProfileId:
            state.activeProfileId &&
            profiles.some((profile) => profile.id === state.activeProfileId)
              ? state.activeProfileId
              : (profiles[0]?.id ?? null),
        })),

      setActiveProfile: (activeProfileId) =>
        set({ activeProfileId, profileUnlocked: true }),

      setProfileUnlocked: (profileUnlocked) => set({ profileUnlocked }),
      setInputMode: (inputMode) =>
        set({ inputMode, spatialEnabled: inputMode === "remote" ? true : inputMode === "mouse" ? true : false }),
      setSpatialEnabled: (spatialEnabled) => set({ spatialEnabled }),
      setSafeAreaEnabled: (safeAreaEnabled) => set({ safeAreaEnabled }),
      setReducedMotion: (reducedMotion) => set({ reducedMotion }),
      setAmbientByDefault: (ambientByDefault) => set({ ambientByDefault }),
      setDataSaver: (dataSaver) => set({ dataSaver }),

      reset: () => set({ ...DEFAULTS, profiles: [] }),
    }),
    {
      name: "zuca-app-state",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        activeProfileId: state.activeProfileId,
        profileUnlocked: state.profileUnlocked,
        spatialEnabled: state.spatialEnabled,
        safeAreaEnabled: state.safeAreaEnabled,
        reducedMotion: state.reducedMotion,
        ambientByDefault: state.ambientByDefault,
        dataSaver: state.dataSaver,
      }),
    },
  ),
);

export const selectActiveProfile = (state: AppState) =>
  state.profiles.find((profile) => profile.id === state.activeProfileId) ?? null;

export const selectFamilyMode = (state: AppState) => state.familyMode;
