"use client";

import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import * as Slider from "@radix-ui/react-slider";
import {
  Activity,
  Captions,
  ChevronLeft,
  Expand,
  Heart,
  Info,
  Minimize,
  Pause,
  PictureInPicture2,
  Play,
  RotateCw,
  Settings2,
  Signal,
  Sparkles,
  Volume2,
  VolumeX,
  WifiOff,
} from "lucide-react";

import { AmbientGlow } from "@/components/player/AmbientGlow";
import { LiveSidePanel } from "@/components/live/LiveSidePanel";
import { QualityBadge } from "@/components/ui/primitives";
import { useDoubleTapSeek } from "@/hooks/use-gestures";
import { useHlsEngine } from "@/hooks/use-hls-engine";
import { useNetworkStatus } from "@/hooks/use-network-status";
import type { Program, ResolvedStream } from "@/lib/types";
import { cn, formatDuration, formatTime } from "@/lib/utils";
import { usePlayerStore } from "@/stores/player-store";
import { useAppStore } from "@/stores/app-store";

export interface PlayerChannelMeta {
  id: string;
  name: string;
  logo: string;
  backdrop?: string;
}

interface PlayerShellProps {
  channel: PlayerChannelMeta;
  stream: ResolvedStream | null;
  streamLoading?: boolean;
  nowPlaying?: Program | null;
  upNext?: Program[];
  /** Ao desmontar, entrega a reprodução ao PiP flutuante global. */
  pipHandoff?: boolean;
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
  onBack?: () => void;
  className?: string;
  compact?: boolean;
}

const CONTROLS_IDLE_MS = 3200;

function PlayerShellComponent({
  channel,
  stream,
  streamLoading = false,
  nowPlaying = null,
  upNext = [],
  pipHandoff = true,
  isFavorite = false,
  onToggleFavorite,
  onBack,
  className,
  compact = false,
}: PlayerShellProps) {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const shellRef = useRef<HTMLDivElement | null>(null);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const progressTicker = useRef<ReturnType<typeof setInterval> | null>(null);

  const [fullscreen, setFullscreen] = useState(false);
  const [showQualityMenu, setShowQualityMenu] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [seekPulse, setSeekPulse] = useState<{ side: "left" | "right"; at: number } | null>(null);

  const ambientEnabled = usePlayerStore((state) => state.ambientEnabled);
  const setAmbientEnabled = usePlayerStore((state) => state.setAmbientEnabled);
  const controlsVisible = usePlayerStore((state) => state.controlsVisible);
  const setControlsVisible = usePlayerStore((state) => state.setControlsVisible);
  const panelOpen = usePlayerStore((state) => state.interactivePanelOpen);
  const setPanelOpen = usePlayerStore((state) => state.setInteractivePanelOpen);
  const openPip = usePlayerStore((state) => state.openPip);
  const setActive = usePlayerStore((state) => state.setActive);

  const dataSaver = useAppStore((state) => state.dataSaver);
  const { state: networkState } = useNetworkStatus(30_000);

  const engine = useHlsEngine({
    videoRef,
    source: stream?.source ?? null,
    enabled: Boolean(stream?.source),
    autoplay: true,
    maxRetries: 5,
    dataSaver,
  });

  const { phase, levels, currentLevel, autoLevelEnabled, bufferedSeconds } = engine;

  /* ---------------- Registro no store global ---------------- */

  useEffect(() => {
    if (!stream) {
      setActive(null);
      return;
    }
    setActive({
      channelId: stream.channelId,
      channelName: stream.channelName,
      logo: stream.logo,
      source: stream.source,
      originPath: `/assistir/${stream.channelId}`,
    });
    // O player principal assumiu o sinal: descarta qualquer PiP remanescente
    // (evita dois fluxos simultâneos ao trocar de canal).
    const currentPip = usePlayerStore.getState().pip;
    if (currentPip.enabled || currentPip.playback) {
      usePlayerStore.setState({ pip: { enabled: false, playback: null } });
    }
  }, [setActive, stream]);

  /* ---------------- Entrega ao PiP flutuante ---------------- */

  useEffect(() => {
    return () => {
      if (!pipHandoff) return;
      const active = usePlayerStore.getState().active;
      const pipAllowed = usePlayerStore.getState().pip;
      if (active && !pipAllowed.enabled) openPip();
    };
  }, [openPip, pipHandoff]);

  /* ---------------- Sincronização de volume ---------------- */

  const volume = usePlayerStore((state) => state.volume);
  const muted = usePlayerStore((state) => state.muted);
  const setVolume = usePlayerStore((state) => state.setVolume);
  const toggleMuted = usePlayerStore((state) => state.toggleMuted);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.volume = volume;
    video.muted = muted;
  }, [muted, volume]);

  /* ---------------- Visibilidade dos controles ---------------- */

  const revealControls = useCallback(() => {
    setControlsVisible(true);
    if (idleTimer.current) clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(() => {
      if (usePlayerStore.getState().phase === "playing") setControlsVisible(false);
    }, CONTROLS_IDLE_MS);
  }, [setControlsVisible]);

  useEffect(() => {
    revealControls();
    return () => {
      if (idleTimer.current) clearTimeout(idleTimer.current);
    };
  }, [revealControls]);

  useEffect(() => {
    if (phase === "paused" || phase === "error" || phase === "loading") {
      setControlsVisible(true);
      if (idleTimer.current) clearTimeout(idleTimer.current);
    }
  }, [phase, setControlsVisible]);

  /* ---------------- Ações ---------------- */

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      void video.play().catch(() => undefined);
    } else {
      video.pause();
    }
    revealControls();
  }, [revealControls]);

  const seekBy = useCallback(
    (seconds: number) => {
      const video = videoRef.current;
      if (!video) return;
      // Em transmissões ao vivo sem DVR, apenas reforçamos o alinhamento à borda viva.
      if (!Number.isFinite(video.duration) || video.duration === 0) {
        if (seconds > 0 && video.seekable.length > 0) {
          video.currentTime = video.seekable.end(video.seekable.length - 1) - 0.4;
        }
        setSeekPulse({ side: seconds > 0 ? "right" : "left", at: Date.now() });
        return;
      }
      video.currentTime = Math.min(
        Math.max(0, video.currentTime + seconds),
        video.duration,
      );
      setSeekPulse({ side: seconds > 0 ? "right" : "left", at: Date.now() });
    },
    [],
  );

  const toggleFullscreen = useCallback(async () => {
    const shell = shellRef.current;
    if (!shell) return;
    try {
      if (!document.fullscreenElement) {
        await shell.requestFullscreen();
        setFullscreen(true);
      } else {
        await document.exitFullscreen();
        setFullscreen(false);
      }
    } catch {
      setFullscreen((current) => !current);
    }
  }, []);

  const handoffToPip = useCallback(() => {
    openPip();
    router.push("/");
  }, [openPip, router]);

  const doubleTap = useDoubleTapSeek({ onSeek: seekBy, seekSeconds: 10 });

  /* ---------------- Atalhos de teclado (desktop + controle remoto) -------- */

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target?.isContentEditable
      ) {
        return;
      }
      switch (event.key) {
        case " ":
        case "k":
        case "MediaPlayPause":
          event.preventDefault();
          togglePlay();
          break;
        case "m":
          toggleMuted();
          revealControls();
          break;
        case "f":
          void toggleFullscreen();
          break;
        case "ArrowRight":
          if (event.shiftKey) {
            event.preventDefault();
            seekBy(10);
          }
          break;
        case "ArrowLeft":
          if (event.shiftKey) {
            event.preventDefault();
            seekBy(-10);
          }
          break;
        case "ArrowUp":
          if (event.shiftKey) {
            event.preventDefault();
            setVolume(volume + 0.05);
          }
          break;
        case "ArrowDown":
          if (event.shiftKey) {
            event.preventDefault();
            setVolume(volume - 0.05);
          }
          break;
        case "i":
          setShowInfo((current) => !current);
          break;
        case "l":
          setPanelOpen(!panelOpen);
          break;
        default:
          break;
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [panelOpen, revealControls, seekBy, setPanelOpen, setVolume, toggleFullscreen, toggleMuted, togglePlay, volume]);

  useEffect(() => {
    function onFullscreenChange() {
      setFullscreen(Boolean(document.fullscreenElement));
    }
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  /* ---------------- Telemetria de tempo assistido ---------------- */

  useEffect(() => {
    progressTicker.current = setInterval(() => {
      const video = videoRef.current;
      if (!video || video.paused || video.readyState < 3) return;
      const active = usePlayerStore.getState().active;
      if (!active) return;
      window.dispatchEvent(
        new CustomEvent("zuca:watch-tick", {
          detail: { channelId: active.channelId, seconds: 5 },
        }),
      );
    }, 5000);
    return () => {
      if (progressTicker.current) clearInterval(progressTicker.current);
    };
  }, []);

  /* ---------------- Derivados ---------------- */

  const liveSeekable = useMemo(() => {
    const video = videoRef.current;
    if (!video || !video.seekable.length) return null;
    return {
      start: video.seekable.start(0),
      end: video.seekable.end(video.seekable.length - 1),
    };
  }, [phase, bufferedSeconds]);

  const qualityLabel = useMemo(() => {
    if (autoLevelEnabled) return "Auto";
    return levels.find((level) => level.index === currentLevel)?.label ?? "Auto";
  }, [autoLevelEnabled, currentLevel, levels]);

  const statusLabel = useMemo(() => {
    switch (phase) {
      case "loading":
        return "Sintonizando o sinal";
      case "buffering":
        return "Carregando…";
      case "playing":
        return "Transmitindo ao vivo";
      case "paused":
        return "Pausado";
      case "ended":
        return "Transmissão encerrada";
      case "error":
        return "Sinal indisponível";
      default:
        return "Aguardando";
    }
  }, [phase]);

  const showSpinner = phase === "loading" || phase === "buffering" || streamLoading;

  return (
    <div
      ref={shellRef}
      className={cn(
        "group/player relative isolate w-full overflow-hidden rounded-[26px] bg-black",
        "shadow-[0_50px_120px_-40px_rgba(0,0,0,0.95)]",
        fullscreen && "rounded-none",
        className,
      )}
      onPointerMove={revealControls}
      onPointerDown={revealControls}
      {...doubleTap}
      data-player-shell="true"
    >
      {/* Halo ambiente projetado atrás do vídeo */}
      <AmbientGlow
        videoRef={videoRef}
        enabled={ambientEnabled && phase === "playing"}
        className="pointer-events-none absolute -inset-10 -z-10"
      />

      <video
        ref={videoRef}
        className="relative aspect-video w-full bg-black object-contain"
        playsInline
        autoPlay
        muted={muted}
        poster={channel.backdrop ?? stream?.backdrop}
        aria-label={`Reprodutor do canal ${channel.name}`}
      />

      {/* ---------------- Estados sobrepostos ---------------- */}
      <AnimatePresence>
        {showSpinner ? (
          <motion.div
            key="spinner"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 bg-black/45"
            role="status"
            aria-live="polite"
          >
            <div className="relative size-14">
              <div className="absolute inset-0 rounded-full border-[3px] border-white/12" />
              <div className="absolute inset-0 animate-spin rounded-full border-[3px] border-transparent border-t-zuca-brand" />
            </div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/65">
              {statusLabel}
            </p>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {phase === "error" || networkState === "offline" ? (
          <motion.div
            key="erro"
            initial={{ opacity: 0, scale: 0.985 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.985 }}
            className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-4 bg-gradient-to-b from-black/85 via-black/92 to-black px-6 text-center"
            role="alert"
          >
            <div className="flex size-16 items-center justify-center rounded-2xl bg-zuca-brand/14 text-zuca-brand-soft">
              {networkState === "offline" ? (
                <WifiOff className="size-7" aria-hidden />
              ) : (
                <Signal className="size-7" aria-hidden />
              )}
            </div>
            <div>
              <h3 className="text-xl font-bold text-white">
                {networkState === "offline"
                  ? "Você está sem conexão"
                  : "Não foi possível sintonizar este canal"}
              </h3>
              <p className="mx-auto mt-2 max-w-lg text-sm leading-relaxed text-white/60">
                {networkState === "offline"
                  ? "Verifique sua internet. Assim que a conexão voltar, a ZUCA retoma a transmissão automaticamente."
                  : (engine.error?.message ??
                    "O sinal desta emissora está fora do ar no momento. Tente novamente ou escolha outro canal.")}
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={engine.retry}
                className="focusable inline-flex h-11 items-center gap-2 rounded-2xl bg-gradient-to-br from-zuca-brand to-zuca-violet px-5 text-sm font-semibold text-white"
              >
                <RotateCw className="size-4" aria-hidden />
                Reconectar sinal
              </button>
              <button
                type="button"
                onClick={() => router.push("/canais")}
                className="focusable glass inline-flex h-11 items-center gap-2 rounded-2xl px-5 text-sm font-medium text-white/85"
              >
                Ver outros canais
              </button>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* Pulso visual do toque duplo */}
      <AnimatePresence>
        {seekPulse ? (
          <motion.div
            key={seekPulse.at}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className={cn(
              "pointer-events-none absolute inset-y-0 z-20 flex w-1/3 items-center justify-center",
              seekPulse.side === "left" ? "left-0" : "right-0",
            )}
          >
            <div className="glass-strong flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold">
              <RotateCw
                className={cn("size-4", seekPulse.side === "left" && "-scale-x-100")}
                aria-hidden
              />
              {seekPulse.side === "left" ? "10s" : "+10s"}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* ---------------- Barra de controles ---------------- */}
      <motion.div
        initial={false}
        animate={{
          opacity: controlsVisible ? 1 : 0,
          y: controlsVisible ? 0 : 12,
        }}
        transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
        className={cn(
          "pointer-events-none absolute inset-x-0 bottom-0 z-40",
          controlsVisible ? "pointer-events-auto" : "",
        )}
      >
        <div className="bg-gradient-to-t from-black/92 via-black/62 to-transparent px-4 pb-4 pt-16 sm:px-6">
          {/* Metadados do canal */}
          <div className="mb-3 flex items-end justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2.5">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-zuca-brand px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-white">
                  <span className="size-1.5 animate-[live-pulse_1.8s_ease-in-out_infinite] rounded-full bg-white" />
                  Ao vivo
                </span>
                <QualityBadge label={qualityLabel} />
                <span className="hidden font-mono text-[11px] text-white/45 sm:inline">
                  {bufferedSeconds > 0 ? `${bufferedSeconds.toFixed(0)}s em buffer` : ""}
                </span>
              </div>
              <h2 className="mt-2 truncate text-lg font-bold text-white sm:text-xl">
                {channel.name}
              </h2>
              <p className="truncate text-[13px] text-white/58">
                {nowPlaying
                  ? `${nowPlaying.title} · ${formatDuration(nowPlaying.durationMs)}`
                  : "Programação contínua da emissora"}
              </p>
            </div>

            <div className="flex shrink-0 items-center gap-1.5">
              {onBack ? (
                <ControlButton label="Voltar" onClick={onBack}>
                  <ChevronLeft className="size-5" aria-hidden />
                </ControlButton>
              ) : null}
              {onToggleFavorite ? (
                <ControlButton
                  label={isFavorite ? "Remover dos favoritos" : "Adicionar aos favoritos"}
                  onClick={onToggleFavorite}
                  active={isFavorite}
                >
                  <Heart
                    className={cn("size-5", isFavorite && "fill-zuca-brand text-zuca-brand")}
                    aria-hidden
                  />
                </ControlButton>
              ) : null}
            </div>
          </div>

          {/* Barra de progresso do programa atual (DVR visual) */}
          {nowPlaying ? (
            <div className="mb-3">
              <div className="h-1 w-full overflow-hidden rounded-full bg-white/14">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-zuca-brand to-zuca-accent transition-[width] duration-700"
                  style={{ width: `${Math.min(100, Math.max(0, nowPlaying.progress * 100))}%` }}
                />
              </div>
              <div className="mt-1.5 flex justify-between font-mono text-[11px] text-white/42">
                <span>{formatTime(nowPlaying.startsAt)}</span>
                <span>{liveSeekable ? "DVR ativo" : "Sem DVR"}</span>
                <span>{formatTime(nowPlaying.endsAt)}</span>
              </div>
            </div>
          ) : null}

          {/* Controles */}
          <div className="flex flex-wrap items-center gap-2">
            <ControlButton
              label={phase === "playing" ? "Pausar" : "Reproduzir"}
              onClick={togglePlay}
              primary
            >
              {phase === "playing" ? (
                <Pause className="size-5" aria-hidden />
              ) : (
                <Play className="size-5" aria-hidden />
              )}
            </ControlButton>

            <ControlButton label="Voltar 10 segundos" onClick={() => seekBy(-10)}>
              <RotateCw className="size-5 -scale-x-100" aria-hidden />
            </ControlButton>
            <ControlButton label="Avançar 10 segundos" onClick={() => seekBy(10)}>
              <RotateCw className="size-5" aria-hidden />
            </ControlButton>

            <div className="ml-1 flex items-center gap-2">
              <ControlButton
                label={muted ? "Ativar som" : "Silenciar"}
                onClick={toggleMuted}
              >
                {muted || volume === 0 ? (
                  <VolumeX className="size-5" aria-hidden />
                ) : (
                  <Volume2 className="size-5" aria-hidden />
                )}
              </ControlButton>
              <Slider.Root
                className="relative flex h-5 w-24 touch-none items-center sm:w-32"
                value={[muted ? 0 : volume * 100]}
                max={100}
                step={1}
                onValueChange={([value]) => setVolume((value ?? 0) / 100)}
                aria-label="Volume"
              >
                <Slider.Track className="relative h-1 grow overflow-hidden rounded-full bg-white/22">
                  <Slider.Range className="absolute h-full bg-white" />
                </Slider.Track>
                <Slider.Thumb className="block size-3.5 rounded-full bg-white shadow-[0_0_0_4px_rgba(255,46,99,0.35)] outline-none focus-visible:ring-2 focus-visible:ring-white" />
              </Slider.Root>
            </div>

            <div className="ml-auto flex items-center gap-2">
              <ControlButton
                label="Modo ao vivo interativo"
                onClick={() => setPanelOpen(!panelOpen)}
                active={panelOpen}
              >
                <Activity className="size-5" aria-hidden />
              </ControlButton>
              <ControlButton
                label="Brilho ambiente"
                onClick={() => setAmbientEnabled(!ambientEnabled)}
                active={ambientEnabled}
              >
                <Sparkles className="size-5" aria-hidden />
              </ControlButton>
              <ControlButton label="Informações do programa" onClick={() => setShowInfo((v) => !v)} active={showInfo}>
                <Info className="size-5" aria-hidden />
              </ControlButton>
              <ControlButton label="Legendas" onClick={() => setShowInfo((v) => !v)}>
                <Captions className="size-5" aria-hidden />
              </ControlButton>

              <div className="relative">
                <ControlButton
                  label="Qualidade do vídeo"
                  onClick={() => setShowQualityMenu((v) => !v)}
                  active={showQualityMenu}
                >
                  <Settings2 className="size-5" aria-hidden />
                </ControlButton>
                <AnimatePresence>
                  {showQualityMenu ? (
                    <motion.div
                      initial={{ opacity: 0, y: 8, scale: 0.96 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 8, scale: 0.96 }}
                      transition={{ duration: 0.18 }}
                      className="glass-strong absolute bottom-full right-0 mb-2 w-48 overflow-hidden rounded-2xl p-1.5"
                      role="menu"
                    >
                      <button
                        type="button"
                        role="menuitemradio"
                        aria-checked={autoLevelEnabled}
                        onClick={() => {
                          engine.setLevel(-1);
                          setShowQualityMenu(false);
                        }}
                        className={cn(
                          "flex w-full items-center justify-between rounded-xl px-3 py-2 text-sm transition",
                          autoLevelEnabled ? "bg-white/12 text-white" : "text-white/62 hover:bg-white/6",
                        )}
                      >
                        Automática
                        {autoLevelEnabled ? <span className="size-1.5 rounded-full bg-zuca-accent" /> : null}
                      </button>
                      {levels.map((level) => (
                        <button
                          key={level.index}
                          type="button"
                          role="menuitemradio"
                          aria-checked={!autoLevelEnabled && currentLevel === level.index}
                          onClick={() => {
                            engine.setLevel(level.index);
                            setShowQualityMenu(false);
                          }}
                          className={cn(
                            "flex w-full items-center justify-between rounded-xl px-3 py-2 text-sm transition",
                            !autoLevelEnabled && currentLevel === level.index
                              ? "bg-white/12 text-white"
                              : "text-white/62 hover:bg-white/6",
                          )}
                        >
                          {level.label}
                          <span className="font-mono text-[10px] text-white/35">
                            {Math.round(level.bitrate / 1000)}k
                          </span>
                        </button>
                      ))}
                      {levels.length === 0 ? (
                        <p className="px-3 py-2 text-[12px] text-white/40">
                          Nenhum nível alternativo disponível.
                        </p>
                      ) : null}
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </div>

              {!compact ? (
                <ControlButton label="Mini player flutuante" onClick={handoffToPip}>
                  <PictureInPicture2 className="size-5" aria-hidden />
                </ControlButton>
              ) : null}
              <ControlButton
                label={fullscreen ? "Sair da tela cheia" : "Tela cheia"}
                onClick={() => void toggleFullscreen()}
              >
                {fullscreen ? (
                  <Minimize className="size-5" aria-hidden />
                ) : (
                  <Expand className="size-5" aria-hidden />
                )}
              </ControlButton>
            </div>
          </div>
        </div>
      </motion.div>

      {/* ---------------- Ficha do programa ---------------- */}
      <AnimatePresence>
        {showInfo && nowPlaying ? (
          <motion.aside
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 24 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="glass-strong absolute right-4 top-4 z-40 w-[min(22rem,calc(100%-2rem))] rounded-3xl p-5"
          >
            <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-zuca-brand-soft">
              No ar agora
            </p>
            <h3 className="mt-2 text-lg font-bold leading-snug text-white">
              {nowPlaying.title}
            </h3>
            <p className="mt-1 font-mono text-[11px] text-white/42">
              {formatTime(nowPlaying.startsAt)} → {formatTime(nowPlaying.endsAt)} ·{" "}
              {formatDuration(nowPlaying.durationMs)}
            </p>
            <p className="mt-3 text-sm leading-relaxed text-white/66">
              {nowPlaying.description}
            </p>
            {upNext.length > 0 ? (
              <>
                <p className="mt-5 text-[10px] font-bold uppercase tracking-[0.24em] text-white/38">
                  A seguir
                </p>
                <ul className="mt-2 space-y-1.5">
                  {upNext.slice(0, 3).map((program) => (
                    <li key={program.startsAt} className="flex items-baseline gap-2 text-[13px]">
                      <span className="font-mono text-white/38">{formatTime(program.startsAt)}</span>
                      <span className="truncate text-white/76">{program.title}</span>
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
          </motion.aside>
        ) : null}
      </AnimatePresence>

      {/* ---------------- Modo ao vivo interativo ---------------- */}
      <LiveSidePanel
        open={panelOpen}
        onClose={() => setPanelOpen(false)}
        channelName={channel.name}
        nowPlaying={nowPlaying}
        upNext={upNext}
        networkState={networkState}
        statusLabel={statusLabel}
      />
    </div>
  );
}

function ControlButton({
  children,
  label,
  onClick,
  active = false,
  primary = false,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
  active?: boolean;
  primary?: boolean;
}) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileTap={{ scale: 0.9 }}
      whileHover={{ scale: 1.08 }}
      title={label}
      aria-label={label}
      className={cn(
        "focusable inline-flex size-10 shrink-0 items-center justify-center rounded-xl border transition-colors sm:size-11",
        primary
          ? "border-transparent bg-white text-zuca-void hover:bg-white/90"
          : active
            ? "border-zuca-brand/55 bg-zuca-brand/18 text-white"
            : "border-white/12 bg-white/6 text-white/78 hover:border-white/28 hover:text-white",
      )}
    >
      {children}
    </motion.button>
  );
}

export const PlayerShell = memo(PlayerShellComponent);
