"use client";

import { memo, useCallback, useEffect, useRef } from "react";
import type { RefObject } from "react";
import { motion } from "framer-motion";

import { usePlayerStore } from "@/stores/player-store";

const SAMPLE_WIDTH = 32;
const SAMPLE_HEIGHT = 18;
/** ~4 amostras/s — suficientemente fluido e barato para CPUs de Smart TV. */
const SAMPLE_INTERVAL_MS = 240;

interface AmbientColors {
  top: string;
  bottom: string;
  left: string;
  right: string;
}

function averageOf(data: Uint8ClampedArray, indices: number[]): [number, number, number] {
  let r = 0;
  let g = 0;
  let b = 0;
  let count = 0;
  for (const index of indices) {
    const offset = index * 4;
    if (offset + 2 >= data.length) continue;
    const alpha = data[offset + 3];
    if (alpha < 24) continue;
    r += data[offset];
    g += data[offset + 1];
    b += data[offset + 2];
    count += 1;
  }
  if (count === 0) return [0, 0, 0];
  return [Math.round(r / count), Math.round(g / count), Math.round(b / count)];
}

function toRgb(value: [number, number, number], boost = 1.18): string {
  const [r, g, b] = value;
  return `rgb(${Math.min(255, Math.round(r * boost))} ${Math.min(255, Math.round(g * boost))} ${Math.min(255, Math.round(b * boost))})`;
}

/**
 * Ambient Glow cinematográfico.
 *
 * Amostra as quatro bordas do frame de vídeo em um canvas offscreen minúsculo
 * (32×18) e projeta a cor média para fora do player, criando o halo difuso
 * característico de telas premium. O resultado é publicado no store global para
 * que o PiP flutuante e o fundo da página reajam ao mesmo sinal.
 */
function AmbientGlowComponent({
  videoRef,
  enabled,
  className,
}: {
  videoRef: RefObject<HTMLVideoElement | null>;
  enabled: boolean;
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const colorsRef = useRef<AmbientColors | null>(null);
  const paintRef = useRef<HTMLDivElement | null>(null);
  const setAmbientColors = usePlayerStore((state) => state.setAmbientColors);

  const sample = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState < 2) return;
    if (video.videoWidth === 0 || video.videoHeight === 0) return;
    if (video.paused || video.ended) return;

    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return;

    try {
      context.drawImage(video, 0, 0, SAMPLE_WIDTH, SAMPLE_HEIGHT);
      const { data } = context.getImageData(0, 0, SAMPLE_WIDTH, SAMPLE_HEIGHT);

      const topRow: number[] = [];
      const bottomRow: number[] = [];
      const leftCol: number[] = [];
      const rightCol: number[] = [];

      for (let x = 0; x < SAMPLE_WIDTH; x += 1) {
        topRow.push(x);
        bottomRow.push((SAMPLE_HEIGHT - 1) * SAMPLE_WIDTH + x);
      }
      for (let y = 0; y < SAMPLE_HEIGHT; y += 1) {
        leftCol.push(y * SAMPLE_WIDTH);
        rightCol.push(y * SAMPLE_WIDTH + (SAMPLE_WIDTH - 1));
      }

      const next: AmbientColors = {
        top: toRgb(averageOf(data, topRow)),
        bottom: toRgb(averageOf(data, bottomRow)),
        left: toRgb(averageOf(data, leftCol)),
        right: toRgb(averageOf(data, rightCol)),
      };

      const previous = colorsRef.current;
      if (
        previous &&
        previous.top === next.top &&
        previous.bottom === next.bottom &&
        previous.left === next.left &&
        previous.right === next.right
      ) {
        return;
      }

      colorsRef.current = next;
      setAmbientColors(next);
    } catch {
      // Canvas poluído por CORS: mantém o último halo válido sem quebrar a UI.
    }
  }, [setAmbientColors, videoRef]);

  useEffect(() => {
    if (!enabled) {
      setAmbientColors(null);
      return;
    }
    const timer = setInterval(sample, SAMPLE_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [enabled, sample, setAmbientColors]);

  const colors = usePlayerStore((state) => state.ambientColors);

  return (
    <>
      <canvas
        ref={canvasRef}
        width={SAMPLE_WIDTH}
        height={SAMPLE_HEIGHT}
        className="pointer-events-none absolute size-0 opacity-0"
        aria-hidden
      />
      <div
        ref={paintRef}
        className={className}
        aria-hidden
        style={{ contain: "strict" }}
      >
        <motion.div
          className="ambient-layer pointer-events-none absolute -top-[14%] left-[8%] right-[8%] h-[42%] rounded-[50%]"
          animate={{
            background: colors
              ? `radial-gradient(closest-side, ${colors.top}, transparent 78%)`
              : "radial-gradient(closest-side, rgba(255,46,99,0.28), transparent 78%)",
            opacity: enabled ? 0.85 : 0,
          }}
          transition={{ duration: 0.9, ease: "easeOut" }}
        />
        <motion.div
          className="ambient-layer pointer-events-none absolute -bottom-[16%] left-[6%] right-[6%] h-[46%] rounded-[50%]"
          animate={{
            background: colors
              ? `radial-gradient(closest-side, ${colors.bottom}, transparent 78%)`
              : "radial-gradient(closest-side, rgba(123,92,255,0.26), transparent 78%)",
            opacity: enabled ? 0.85 : 0,
          }}
          transition={{ duration: 0.9, ease: "easeOut" }}
        />
        <motion.div
          className="ambient-layer pointer-events-none absolute -left-[12%] top-[12%] bottom-[12%] w-[30%] rounded-[50%]"
          animate={{
            background: colors
              ? `radial-gradient(closest-side, ${colors.left}, transparent 76%)`
              : "radial-gradient(closest-side, rgba(0,229,195,0.22), transparent 76%)",
            opacity: enabled ? 0.7 : 0,
          }}
          transition={{ duration: 1.1, ease: "easeOut" }}
        />
        <motion.div
          className="ambient-layer pointer-events-none absolute -right-[12%] top-[12%] bottom-[12%] w-[30%] rounded-[50%]"
          animate={{
            background: colors
              ? `radial-gradient(closest-side, ${colors.right}, transparent 76%)`
              : "radial-gradient(closest-side, rgba(255,200,87,0.2), transparent 76%)",
            opacity: enabled ? 0.7 : 0,
          }}
          transition={{ duration: 1.1, ease: "easeOut" }}
        />
      </div>
    </>
  );
}

export const AmbientGlow = memo(AmbientGlowComponent);
