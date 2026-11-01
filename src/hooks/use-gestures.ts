"use client";

import { useCallback, useEffect, useRef } from "react";
import type { RefObject } from "react";

interface SwipeOptions {
  /** Disparado ao final de um swipe horizontal com a direção detectada. */
  onSwipe?: (direction: "left" | "right", distance: number) => void;
  /** Disparido continuamente durante o arraste (feedback elástico). */
  onDrag?: (deltaX: number) => void;
  threshold?: number;
  enabled?: boolean;
}

/**
 * Suporte nativo a swipe horizontal (carrosséis e grade EPG) em telas de toque.
 * Não interfere no scroll vertical: o gesto é cancelado quando o eixo Y domina.
 */
export function useHorizontalSwipe<T extends HTMLElement>(
  ref: RefObject<T | null>,
  options: SwipeOptions = {},
) {
  const { onSwipe, onDrag, threshold = 48, enabled = true } = options;
  const state = useRef({ startX: 0, startY: 0, tracking: false, axisLocked: "" });

  useEffect(() => {
    const node = ref.current;
    if (!node || !enabled) return;

    function handleStart(event: TouchEvent) {
      const touch = event.touches[0];
      if (!touch) return;
      state.current = {
        startX: touch.clientX,
        startY: touch.clientY,
        tracking: true,
        axisLocked: "",
      };
    }

    function handleMove(event: TouchEvent) {
      if (!state.current.tracking) return;
      const touch = event.touches[0];
      if (!touch) return;
      const deltaX = touch.clientX - state.current.startX;
      const deltaY = touch.clientY - state.current.startY;

      if (!state.current.axisLocked) {
        if (Math.abs(deltaX) > 12 || Math.abs(deltaY) > 12) {
          state.current.axisLocked =
            Math.abs(deltaX) > Math.abs(deltaY) ? "x" : "y";
        }
      }
      if (state.current.axisLocked === "x") onDrag?.(deltaX);
    }

    function handleEnd(event: TouchEvent) {
      if (!state.current.tracking) return;
      state.current.tracking = false;
      if (state.current.axisLocked !== "x") return;
      const touch = event.changedTouches[0];
      if (!touch) return;
      const deltaX = touch.clientX - state.current.startX;
      if (Math.abs(deltaX) < threshold) return;
      onSwipe?.(deltaX < 0 ? "left" : "right", Math.abs(deltaX));
    }

    node.addEventListener("touchstart", handleStart, { passive: true });
    node.addEventListener("touchmove", handleMove, { passive: true });
    node.addEventListener("touchend", handleEnd, { passive: true });
    node.addEventListener("touchcancel", handleEnd, { passive: true });

    return () => {
      node.removeEventListener("touchstart", handleStart);
      node.removeEventListener("touchmove", handleMove);
      node.removeEventListener("touchend", handleEnd);
      node.removeEventListener("touchcancel", handleEnd);
    };
  }, [enabled, onDrag, onSwipe, ref, threshold]);
}

interface DoubleTapOptions {
  onSeek: (deltaSeconds: number) => void;
  /** Largura da zona de borda em % do contêiner. */
  edgeRatio?: number;
  delayMs?: number;
  seekSeconds?: number;
  enabled?: boolean;
}

/**
 * Toque duplo nas bordas do vídeo: -10s (esquerda) / +10s (direita).
 * Retorna os handlers a serem espalhados no contêiner do player.
 */
export function useDoubleTapSeek(options: DoubleTapOptions) {
  const {
    onSeek,
    edgeRatio = 0.32,
    delayMs = 320,
    seekSeconds = 10,
    enabled = true,
  } = options;
  const lastTap = useRef({ time: 0, side: "" as "" | "left" | "right" });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handlePointerUp = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      if (!enabled) return;
      if (event.pointerType === "mouse") return;
      const rect = event.currentTarget.getBoundingClientRect();
      if (rect.width === 0) return;
      const relative = (event.clientX - rect.left) / rect.width;
      const side: "left" | "right" | "center" =
        relative <= edgeRatio ? "left" : relative >= 1 - edgeRatio ? "right" : "center";
      if (side === "center") return;

      const now = Date.now();
      const isDouble =
        now - lastTap.current.time < delayMs && lastTap.current.side === side;

      if (isDouble) {
        onSeek(side === "left" ? -seekSeconds : seekSeconds);
        lastTap.current = { time: 0, side: "" };
        if (timer.current) clearTimeout(timer.current);
        return;
      }

      lastTap.current = { time: now, side };
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        lastTap.current = { time: 0, side: "" };
      }, delayMs);
    },
    [delayMs, edgeRatio, enabled, onSeek, seekSeconds],
  );

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  return { onPointerUp: handlePointerUp };
}

interface DraggableOptions {
  bounds?: { padding?: number };
  onMove?: (position: { x: number; y: number }) => void;
}

/**
 * Arraste do PiP flutuante com inércia simples e clamp às bordas da viewport.
 * A posição é devolvida em pixels absolutos (canto superior esquerdo).
 */
export function useDraggable<T extends HTMLElement>(
  ref: RefObject<T | null>,
  options: DraggableOptions = {},
) {
  const { bounds, onMove } = options;
  const padding = bounds?.padding ?? 12;
  const drag = useRef({ active: false, offsetX: 0, offsetY: 0, moved: false });

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    function handlePointerDown(event: PointerEvent) {
      if (!node) return;
      const target = event.target as HTMLElement;
      if (target.closest("[data-pip-no-drag]")) return;
      const rect = node.getBoundingClientRect();
      drag.current = {
        active: true,
        offsetX: event.clientX - rect.left,
        offsetY: event.clientY - rect.top,
        moved: false,
      };
      node.setPointerCapture?.(event.pointerId);
    }

    function handlePointerMove(event: PointerEvent) {
      if (!drag.current.active || !node) return;
      drag.current.moved = true;
      const maxX = window.innerWidth - node.offsetWidth - padding;
      const maxY = window.innerHeight - node.offsetHeight - padding;
      const x = Math.min(maxX, Math.max(padding, event.clientX - drag.current.offsetX));
      const y = Math.min(maxY, Math.max(padding, event.clientY - drag.current.offsetY));
      node.style.left = `${x}px`;
      node.style.top = `${y}px`;
      node.style.right = "auto";
      node.style.bottom = "auto";
      onMove?.({ x, y });
    }

    function handlePointerUp(event: PointerEvent) {
      if (!drag.current.active) return;
      drag.current.active = false;
      node?.releasePointerCapture?.(event.pointerId);
    }

    node.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);

    return () => {
      node.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
    };
  }, [onMove, padding, ref]);

  return { wasDragged: () => drag.current.moved };
}
