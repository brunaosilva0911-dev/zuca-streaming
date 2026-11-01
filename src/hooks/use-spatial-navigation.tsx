"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";

import { useAppStore } from "@/stores/app-store";

export type SpatialDirection = "up" | "down" | "left" | "right";

interface FocusableRegistration {
  id: number;
  node: HTMLElement;
  group: string;
  priority: number;
  onSelect?: () => void;
}

interface SpatialContextValue {
  focusedId: number | null;
  register: (registration: Omit<FocusableRegistration, "id">) => () => void;
  requestFocus: (node: HTMLElement) => void;
  focusGroup: (group: string) => void;
  isSpatialActive: boolean;
}

const SpatialContext = createContext<SpatialContextValue | null>(null);

const FOCUS_ATTRIBUTE = "data-focus";
const REMOTE_KEYS = new Set([
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "Enter",
  "Backspace",
  "Escape",
  "MediaPlayPause",
  "MediaTrackNext",
  "MediaTrackPrevious",
]);

let registrationCounter = 0;

function rectsAligned(
  source: DOMRect,
  target: DOMRect,
  direction: SpatialDirection,
): boolean {
  const tolerance = 12;
  switch (direction) {
    case "left":
      return target.right <= source.left + tolerance;
    case "right":
      return target.left >= source.right - tolerance;
    case "up":
      return target.bottom <= source.top + tolerance;
    case "down":
      return target.top >= source.bottom - tolerance;
    default:
      return false;
  }
}

function axisDistance(
  source: DOMRect,
  target: DOMRect,
  direction: SpatialDirection,
): number {
  switch (direction) {
    case "left":
      return source.left - target.right;
    case "right":
      return target.left - source.left;
    case "up":
      return source.top - target.bottom;
    case "down":
      return target.top - source.top;
    default:
      return Number.POSITIVE_INFINITY;
  }
}

function crossDistance(
  source: DOMRect,
  target: DOMRect,
  direction: SpatialDirection,
): number {
  const sourceCenter =
    direction === "left" || direction === "right"
      ? source.top + source.height / 2
      : source.left + source.width / 2;
  const targetCenter =
    direction === "left" || direction === "right"
      ? target.top + target.height / 2
      : target.left + target.width / 2;
  return Math.abs(sourceCenter - targetCenter);
}

/**
 * Motor de navegação espacial (D-Pad) para Android TV / WebViews.
 * Usa geometria real dos nós registrados e pontua candidatos por distância
 * axial + desalinhamento transversal, com prioridade por grupo.
 */
export function SpatialNavigationProvider({ children }: { children: ReactNode }) {
  const registrations = useRef<Map<number, FocusableRegistration>>(new Map());
  const [focusedId, setFocusedId] = useState<number | null>(null);
  const [isSpatialActive, setIsSpatialActive] = useState(false);
  const spatialEnabled = useAppStore((state) => state.spatialEnabled);
  const setInputMode = useAppStore((state) => state.setInputMode);

  const applyFocus = useCallback((id: number | null) => {
    registrations.current.forEach((registration, registrationId) => {
      const focused = registrationId === id;
      registration.node.setAttribute(FOCUS_ATTRIBUTE, focused ? "true" : "false");
      registration.node.setAttribute("aria-focused", focused ? "true" : "false");
      if (focused && registration.node.getAttribute("data-silent-focus") !== "true") {
        registration.node.focus({ preventScroll: true });
        registration.node.scrollIntoView({
          block: "nearest",
          inline: "nearest",
          behavior: "smooth",
        });
      }
    });
    setFocusedId(id);
  }, []);

  const register = useCallback(
    (registration: Omit<FocusableRegistration, "id">) => {
      registrationCounter += 1;
      const id = registrationCounter;
      registrations.current.set(id, { ...registration, id });
      registration.node.setAttribute(FOCUS_ATTRIBUTE, "false");
      return () => {
        registrations.current.delete(id);
        setFocusedId((current) => (current === id ? null : current));
      };
    },
    [],
  );

  const requestFocus = useCallback(
    (node: HTMLElement) => {
      for (const [id, registration] of registrations.current) {
        if (registration.node === node) {
          setIsSpatialActive(true);
          applyFocus(id);
          return;
        }
      }
    },
    [applyFocus],
  );

  const focusGroup = useCallback(
    (group: string) => {
      const candidates = [...registrations.current.values()].filter(
        (registration) => registration.group === group,
      );
      if (candidates.length === 0) return;
      candidates.sort((a, b) => a.priority - b.priority);
      applyFocus(candidates[0].id);
    },
    [applyFocus],
  );

  const move = useCallback(
    (direction: SpatialDirection) => {
      const entries = [...registrations.current.values()].filter((registration) => {
        const node = registration.node;
        if (node.getAttribute("data-disabled") === "true") return false;
        const rect = node.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      });
      if (entries.length === 0) return;

      const current = entries.find((entry) => entry.id === focusedId);
      const sourceNode = current?.node ?? document.activeElement;
      const source = (sourceNode as HTMLElement | null)?.getBoundingClientRect();

      if (!source) {
        applyFocus(entries[0].id);
        return;
      }

      const candidates = entries
        .filter((entry) => entry.id !== focusedId)
        .map((entry) => {
          const rect = entry.node.getBoundingClientRect();
          return {
            entry,
            rect,
            aligned: rectsAligned(source, rect, direction),
            axis: axisDistance(source, rect, direction),
            cross: crossDistance(source, rect, direction),
          };
        })
        .filter((candidate) => candidate.axis > -24)
        .sort((a, b) => {
          if (a.aligned !== b.aligned) return a.aligned ? -1 : 1;
          if (a.entry.group !== b.entry.group) {
            return a.entry.priority - b.entry.priority;
          }
          const scoreA = Math.abs(a.axis) + a.cross * 1.6;
          const scoreB = Math.abs(b.axis) + b.cross * 1.6;
          return scoreA - scoreB;
        });

      const next = candidates[0];
      if (next) {
        setIsSpatialActive(true);
        applyFocus(next.entry.id);
      }
    },
    [applyFocus, focusedId],
  );

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (!REMOTE_KEYS.has(event.key)) return;

      const target = event.target as HTMLElement | null;
      const typing =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target?.isContentEditable === true;
      if (typing) return;

      switch (event.key) {
        case "ArrowUp":
          event.preventDefault();
          move("up");
          break;
        case "ArrowDown":
          event.preventDefault();
          move("down");
          break;
        case "ArrowLeft":
          event.preventDefault();
          move("left");
          break;
        case "ArrowRight":
          event.preventDefault();
          move("right");
          break;
        case "Enter": {
          if (focusedId == null) return;
          const registration = registrations.current.get(focusedId);
          if (!registration) return;
          event.preventDefault();
          registration.onSelect?.();
          registration.node.click();
          break;
        }
        case "Backspace":
        case "Escape": {
          const handled = window.dispatchEvent(
            new CustomEvent("zuca:back", { cancelable: true }),
          );
          if (!handled) event.preventDefault();
          break;
        }
        default:
          break;
      }
    }

    function onPointerDown(event: PointerEvent) {
      setInputMode(event.pointerType === "touch" ? "touch" : "mouse");
      setIsSpatialActive(false);
    }

    function onKeyActivity(event: KeyboardEvent) {
      if (event.key.startsWith("Arrow") || event.key === "Enter") {
        setInputMode("remote");
        setIsSpatialActive(true);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keydown", onKeyActivity);
    window.addEventListener("pointerdown", onPointerDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keydown", onKeyActivity);
      window.removeEventListener("pointerdown", onPointerDown);
    };
  }, [focusedId, move, setInputMode]);

  const value = useMemo<SpatialContextValue>(
    () => ({
      focusedId,
      register,
      requestFocus,
      focusGroup,
      isSpatialActive,
    }),
    [focusGroup, focusedId, isSpatialActive, register, requestFocus],
  );

  useEffect(() => {
    document.documentElement.setAttribute(
      "data-spatial",
      spatialEnabled ? "true" : "false",
    );
  }, [spatialEnabled]);

  return <SpatialContext.Provider value={value}>{children}</SpatialContext.Provider>;
}

export function useSpatialContext(): SpatialContextValue {
  const context = useContext(SpatialContext);
  if (!context) {
    throw new Error("useSpatialContext precisa estar dentro de SpatialNavigationProvider");
  }
  return context;
}

interface UseFocusableOptions {
  group?: string;
  priority?: number;
  onSelect?: () => void;
  disabled?: boolean;
  autoFocus?: boolean;
}

/**
 * Registra um nó no motor espacial. Retorna `ref`, `focused` e os props de
 * acessibilidade/teclado necessários.
 */
export function useFocusable<T extends HTMLElement = HTMLDivElement>(
  options: UseFocusableOptions = {},
): { ref: RefObject<T | null>; focused: boolean; tabIndex: number } {
  const { group = "default", priority = 0, onSelect, disabled = false, autoFocus = false } =
    options;
  const context = useSpatialContext();
  const ref = useRef<T | null>(null);
  const [focused, setFocused] = useState(false);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  useEffect(() => {
    const node = ref.current;
    if (!node || disabled) return;

    const unregister = context.register({
      node,
      group,
      priority,
      onSelect: () => onSelectRef.current?.(),
    });

    const observer = new MutationObserver(() => {
      setFocused(node.getAttribute(FOCUS_ATTRIBUTE) === "true");
    });
    observer.observe(node, {
      attributes: true,
      attributeFilter: [FOCUS_ATTRIBUTE],
    });
    setFocused(node.getAttribute(FOCUS_ATTRIBUTE) === "true");

    if (autoFocus) context.requestFocus(node);

    return () => {
      observer.disconnect();
      unregister();
    };
  }, [autoFocus, context, disabled, group, priority]);

  return {
    ref,
    focused,
    tabIndex: disabled ? -1 : 0,
  };
}
