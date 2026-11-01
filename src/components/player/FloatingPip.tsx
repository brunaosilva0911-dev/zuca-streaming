"use client";

import { memo, useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  Expand,
  Loader2,
  Maximize2,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";

import { useDraggable } from "@/hooks/use-gestures";
import { useHlsEngine } from "@/hooks/use-hls-engine";
import { cn } from "@/lib/utils";
import { usePlayerStore } from "@/stores/player-store";
import { useAppStore } from "@/stores/app-store";

/**
 * PiP flutuante global.
 *
 * Quando o usuário navega para fora de um canal ao vivo, a transmissão é
 * entregue a este mini-player, que vive fora da árvore de rotas (montado no
 * Provider raiz). Assim o áudio/vídeo continua enquanto o catálogo é navegado.
 */
function FloatingPipComponent() {
  const router = useRouter();
  const pip = usePlayerStore((state) => state.pip);
  const closePip = usePlayerStore((state) => state.closePip);
  const setActive = usePlayerStore((state) => state.setActive);
  const setPhase = usePlayerStore((state) => state.setPhase);
  const dataSaver = useAppStore((state) => state.dataSaver);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const frameRef = useRef<HTMLDivElement | null>(null);
  const [muted, setMuted] = useState(true);
  const [expanded, setExpanded] = useState(false);

  const source = pip.enabled ? pip.playback?.source ?? null : null;

  const engine = useHlsEngine({
    videoRef,
    source,
    enabled: pip.enabled && Boolean(source),
    autoplay: true,
    maxRetries: 3,
    dataSaver,
  });

  const handleMove = useCallback(() => {
    /* posição mantida inline no próprio nó — sem re-render */
  }, []);

  useDraggable<HTMLDivElement>(frameRef, {
    bounds: { padding: 12 },
    onMove: handleMove,
  });

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = muted;
  }, [muted]);

  useEffect(() => {
    if (!pip.enabled) {
      setExpanded(false);
      return;
    }
    setPhase(engine.phase);
  }, [engine.phase, pip.enabled, setPhase]);

  const expandToChannel = useCallback(() => {
    const playback = usePlayerStore.getState().pip.playback;
    usePlayerStore.setState({ pip: { enabled: false, playback: null } });
    if (playback) {
      setActive({ ...playback });
      router.push(playback.originPath);
    } else {
      router.push("/canais");
    }
  }, [router, setActive]);

  const handleClose = useCallback(() => {
    closePip();
    setActive(null);
  }, [closePip, setActive]);

  const loading = engine.phase === "loading" || engine.phase === "buffering";

  return (
    <AnimatePresence>
      {pip.enabled && pip.playback ? (
        <motion.div
          key="zuca-pip"
          initial={{ opacity: 0, scale: 0.82, y: 26 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.82, y: 26 }}
          transition={{ type: "spring", stiffness: 320, damping: 30 }}
          className="fixed z-[90] touch-none"
          style={{ right: 20, bottom: 20 }}
        >
          <div
            ref={frameRef}
            className={cn(
              "glass-strong group/pip relative overflow-hidden rounded-2xl",
              "shadow-[0_30px_80px_-24px_rgba(0,0,0,0.95)] ring-1 ring-white/12",
              expanded
                ? "h-[min(60dvh,30rem)] w-[min(90vw,54rem)]"
                : "h-[7.5rem] w-[13.33rem] sm:h-[9.5rem] sm:w-[16.9rem]",
            )}
            role="complementary"
            aria-label={`Mini player: ${pip.playback.channelName}`}
          >
            <video
              ref={videoRef}
              className="absolute inset-0 size-full bg-black object-cover"
              playsInline
              autoPlay
              muted={muted}
              poster={pip.playback.logo}
            />

            {loading ? (
              <div className="absolute inset-0 flex items-center justify-center bg-black/55">
                <Loader2 className="size-6 animate-spin text-white/75" aria-hidden />
              </div>
            ) : null}

            {engine.phase === "error" ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/80 px-3 text-center">
                <p className="text-[11px] font-semibold leading-tight text-white/80">
                  Sinal perdido no mini player
                </p>
                <button
                  type="button"
                  data-pip-no-drag
                  onClick={engine.retry}
                  className="focusable rounded-lg bg-white/14 px-2.5 py-1 text-[11px] font-semibold text-white"
                >
                  Reconectar
                </button>
              </div>
            ) : null}

            {/* Cabeçalho do PiP */}
            <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-1 bg-gradient-to-b from-black/78 to-transparent p-1.5 opacity-100 transition-opacity group-hover/pip:opacity-100">
              <div className="pointer-events-none flex min-w-0 items-center gap-1.5">
                <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-zuca-brand px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-[0.16em] text-white">
                  <span className="size-1 animate-[live-pulse_1.8s_ease-in-out_infinite] rounded-full bg-white" />
                  Ao vivo
                </span>
                <span className="truncate text-[10.5px] font-semibold text-white/85">
                  {pip.playback.channelName}
                </span>
              </div>
            </div>

            {/* Ações */}
            <div
              data-pip-no-drag
              className="absolute bottom-1.5 right-1.5 flex items-center gap-1"
            >
              <PipAction label={muted ? "Ativar som" : "Silenciar"} onClick={() => setMuted((v) => !v)}>
                {muted ? <VolumeX className="size-3.5" aria-hidden /> : <Volume2 className="size-3.5" aria-hidden />}
              </PipAction>
              <PipAction
                label={expanded ? "Reduzir mini player" : "Ampliar mini player"}
                onClick={() => setExpanded((v) => !v)}
              >
                {expanded ? <Maximize2 className="size-3.5" aria-hidden /> : <Expand className="size-3.5" aria-hidden />}
              </PipAction>
              <PipAction label="Abrir canal em tela cheia" onClick={expandToChannel}>
                <Maximize2 className="size-3.5" aria-hidden />
              </PipAction>
              <PipAction label="Fechar mini player" onClick={handleClose} danger>
                <X className="size-3.5" aria-hidden />
              </PipAction>
            </div>

            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-0.5 bg-white/8">
              <motion.div
                className="h-full bg-gradient-to-r from-zuca-brand to-zuca-accent"
                animate={{ width: loading ? "30%" : "100%" }}
                transition={{ duration: 0.6, ease: "easeOut" }}
              />
            </div>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

function PipAction({
  children,
  label,
  onClick,
  danger = false,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      data-pip-no-drag
      onClick={onClick}
      title={label}
      aria-label={label}
      className={cn(
        "focusable inline-flex size-7 items-center justify-center rounded-lg border backdrop-blur transition",
        danger
          ? "border-white/14 bg-black/55 text-white/80 hover:border-zuca-brand/60 hover:text-zuca-brand-soft"
          : "border-white/14 bg-black/55 text-white/80 hover:border-white/40 hover:text-white",
      )}
    >
      {children}
    </button>
  );
}

export const FloatingPip = memo(FloatingPipComponent);
