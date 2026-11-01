"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type Hls from "hls.js";
import type { ErrorData, Level, ManifestParsedData } from "hls.js";

/**
 * Nomes literais dos eventos do hls.js. Importar o enum `Events` como valor
 * forçaria o bundling estático da biblioteca — o que anularia o dynamic import
 * essencial para Smart TVs de baixo processamento.
 */
const HLS_EVENTS = {
  manifestParsed: "hlsManifestParsed",
  levelSwitched: "hlsLevelSwitched",
  error: "hlsError",
} as const;

import type { PlayerPhase } from "@/lib/types";

export interface QualityLevel {
  index: number;
  label: string;
  height: number | null;
  bitrate: number;
}

export interface HlsEngineState {
  phase: PlayerPhase;
  error: { code: string; message: string; fatal: boolean } | null;
  levels: QualityLevel[];
  currentLevel: number;
  droppedFrames: number;
  bufferedSeconds: number;
  /** -1 = automático */
  autoLevelEnabled: boolean;
}

interface UseHlsEngineOptions {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  source: string | null;
  enabled?: boolean;
  autoplay?: boolean;
  maxRetries?: number;
  /** Chamado a cada tentativa de reconexão (para telemetria/UI). */
  onRetry?: (attempt: number) => void;
  onFatal?: (error: HlsEngineState["error"]) => void;
  dataSaver?: boolean;
}

const MAX_BACKOFF_MS = 12_000;

/**
 * Shim tipado para `hls.on`. Permite usar nomes de evento literais sem
 * importar o enum `Events` como valor (o que quebraria o dynamic import).
 */
function onHls<K extends string>(
  hls: Hls,
  event: K,
  listener: (event: K, data: never) => void,
): void {
  const bindable = hls.on.bind(hls) as unknown as (
    event: K,
    listener: (event: K, data: never) => void,
  ) => void;
  bindable(event, listener);
}

function levelLabel(level: Level, index: number): string {
  if (level.height) return `${level.height}p`;
  if (level.bitrate) return `${Math.round(level.bitrate / 1000)} kbps`;
  return `Nível ${index + 1}`;
}

/**
 * Motor HLS resiliente.
 *
 * - Carrega o hls.js sob demanda (dynamic import) para não pesar no bundle
 *   inicial de Smart TVs.
 * - Usa reprodução nativa em Safari/iOS (Media Source Extensions ausentes).
 * - Reconexão automática com backoff exponencial para links HLS mortos ou
 *   quedas de rede, respeitando `maxRetries`.
 * - Expõe níveis de qualidade para seleção manual.
 */
export function useHlsEngine(options: UseHlsEngineOptions): HlsEngineState & {
  setLevel: (index: number) => void;
  retry: () => void;
} {
  const {
    videoRef,
    source,
    enabled = true,
    autoplay = true,
    maxRetries = 5,
    onRetry,
    onFatal,
    dataSaver = false,
  } = options;

  const hlsRef = useRef<Hls | null>(null);
  const retryCount = useRef(0);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const destroyed = useRef(false);

  const [state, setState] = useState<HlsEngineState>({
    phase: "idle",
    error: null,
    levels: [],
    currentLevel: -1,
    droppedFrames: 0,
    bufferedSeconds: 0,
    autoLevelEnabled: true,
  });

  const patch = useCallback((partial: Partial<HlsEngineState>) => {
    setState((current) => ({ ...current, ...partial }));
  }, []);

  const clearRetryTimer = useCallback(() => {
    if (retryTimer.current) {
      clearTimeout(retryTimer.current);
      retryTimer.current = null;
    }
  }, []);

  const destroyHls = useCallback(() => {
    if (hlsRef.current) {
      try {
        hlsRef.current.destroy();
      } catch {
        /* instância já descartada */
      }
      hlsRef.current = null;
    }
  }, []);

  const scheduleRetry = useCallback(
    (reload: () => void) => {
      clearRetryTimer();
      if (retryCount.current >= maxRetries) {
        const error = {
          code: "SINAL_ESGOTADO",
          message:
            "Esgotamos as tentativas de reconexão com este canal. O sinal pode estar temporariamente fora do ar.",
          fatal: true,
        };
        patch({ phase: "error", error });
        onFatal?.(error);
        return;
      }
      retryCount.current += 1;
      const delay = Math.min(
        MAX_BACKOFF_MS,
        600 * 2 ** (retryCount.current - 1) + Math.random() * 220,
      );
      patch({
        phase: "buffering",
        error: {
          code: "RECONECTANDO",
          message: `Reconectando ao sinal (tentativa ${retryCount.current} de ${maxRetries})…`,
          fatal: false,
        },
      });
      onRetry?.(retryCount.current);
      retryTimer.current = setTimeout(() => {
        if (!destroyed.current) reload();
      }, delay);
    },
    [clearRetryTimer, maxRetries, onFatal, onRetry, patch],
  );

  const attach = useCallback(async () => {
    const video = videoRef.current;
    if (!video || !source || !enabled) return;

    destroyHls();
    patch({ phase: "loading", error: null });

    const nativeHls = video.canPlayType("application/vnd.apple.mpegurl");
    if (nativeHls) {
      video.src = source;
      if (autoplay) {
        try {
          await video.play();
          patch({ phase: "playing" });
        } catch {
          patch({ phase: "paused" });
        }
      }
      return;
    }

    let HlsConstructor: typeof Hls;
    try {
      const module = await import("hls.js");
      HlsConstructor = module.default;
    } catch {
      const error = {
        code: "HLS_INDISPONIVEL",
        message:
          "Seu navegador não oferece suporte à reprodução HLS e o módulo de reprodução não pôde ser carregado.",
        fatal: true,
      };
      patch({ phase: "error", error });
      onFatal?.(error);
      return;
    }

    if (!HlsConstructor.isSupported()) {
      const error = {
        code: "MSE_NAO_SUPORTADO",
        message:
          "Este dispositivo não suporta Media Source Extensions, necessário para o sinal HLS.",
        fatal: true,
      };
      patch({ phase: "error", error });
      onFatal?.(error);
      return;
    }

    const hls = new HlsConstructor({
      enableWorker: true,
      lowLatencyMode: true,
      backBufferLength: dataSaver ? 30 : 90,
      maxBufferLength: dataSaver ? 12 : 30,
      maxMaxBufferLength: dataSaver ? 30 : 120,
      liveSyncDurationCount: dataSaver ? 4 : 3,
      manifestLoadingTimeOut: 12_000,
      manifestLoadingMaxRetry: 2,
      manifestLoadingRetryDelay: 900,
      levelLoadingTimeOut: 12_000,
      levelLoadingMaxRetry: 3,
      fragLoadingTimeOut: 20_000,
      fragLoadingMaxRetry: 4,
      startLevel: dataSaver ? 0 : -1,
      capLevelToPlayerSize: true,
    });
    hlsRef.current = hls;

    onHls(hls, HLS_EVENTS.manifestParsed, (_event, raw) => {
      const data = raw as unknown as ManifestParsedData;
      const levels: QualityLevel[] = (data.levels ?? []).map((level, index) => ({
        index,
        label: levelLabel(level as Level, index),
        height: level.height ?? null,
        bitrate: level.bitrate ?? 0,
      }));
      patch({ levels, currentLevel: hls.currentLevel, autoLevelEnabled: hls.autoLevelEnabled });
      if (autoplay) {
        void video.play().then(
          () => patch({ phase: "playing" }),
          () => patch({ phase: "paused" }),
        );
      } else {
        patch({ phase: "idle" });
      }
    });

    onHls(hls, HLS_EVENTS.levelSwitched, (_event, raw) => {
      const data = raw as unknown as { level: number };
      patch({ currentLevel: data.level, autoLevelEnabled: hls.autoLevelEnabled });
    });

    onHls(hls, HLS_EVENTS.error, (_event, raw) => {
      const data = raw as unknown as ErrorData;
      if (!data.fatal) return;
      const fatal = {
        code: data.type ? String(data.type) : "ERRO_HLS",
        message:
          data.details === "manifestLoadError"
            ? "Não foi possível carregar a lista de reprodução deste canal."
            : data.details === "fragLoadError"
              ? "Falha ao baixar um trecho do vídeo. O sinal pode estar instável."
              : data.details === "bufferStalledError"
                ? "A reprodução travou aguardando novos dados."
                : "Ocorreu um erro fatal na reprodução deste canal.",
        fatal: true,
      };

      switch (data.type) {
        case "networkError":
          scheduleRetry(() => {
            void hls.startLoad();
          });
          break;
        case "mediaError":
          scheduleRetry(() => {
            hls.recoverMediaError();
          });
          break;
        default:
          destroyHls();
          patch({ phase: "error", error: fatal });
          onFatal?.(fatal);
          break;
      }
    });

    hls.attachMedia(video);
    hls.loadSource(source);
  }, [autoplay, dataSaver, destroyHls, enabled, onFatal, patch, scheduleRetry, source, videoRef]);

  /* ---------------- Element events ---------------- */

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleWaiting = () => patch({ phase: "buffering" });
    const handlePlaying = () => {
      retryCount.current = 0;
      patch({ phase: "playing", error: null });
    };
    const handlePause = () => {
      setState((current) =>
        current.phase === "playing" || current.phase === "buffering"
          ? { ...current, phase: "paused" }
          : current,
      );
    };
    const handleEnded = () => patch({ phase: "ended" });
    const handleError = () =>
      patch({
        phase: "error",
        error: {
          code: "MEDIA_ELEMENT_ERROR",
          message: "O elemento de vídeo reportou uma falha ao decodificar o sinal.",
          fatal: true,
        },
      });
    const handleProgress = () => {
      if (!video.buffered.length) return;
      const bufferedSeconds = Math.max(
        0,
        video.buffered.end(video.buffered.length - 1) - video.currentTime,
      );
      setState((current) =>
        Math.abs(current.bufferedSeconds - bufferedSeconds) > 0.4
          ? { ...current, bufferedSeconds }
          : current,
      );
    };

    video.addEventListener("waiting", handleWaiting);
    video.addEventListener("playing", handlePlaying);
    video.addEventListener("play", handlePlaying);
    video.addEventListener("pause", handlePause);
    video.addEventListener("ended", handleEnded);
    video.addEventListener("error", handleError);
    video.addEventListener("progress", handleProgress);

    return () => {
      video.removeEventListener("waiting", handleWaiting);
      video.removeEventListener("playing", handlePlaying);
      video.removeEventListener("play", handlePlaying);
      video.removeEventListener("pause", handlePause);
      video.removeEventListener("ended", handleEnded);
      video.removeEventListener("error", handleError);
      video.removeEventListener("progress", handleProgress);
    };
  }, [patch, videoRef]);

  /* ---------------- Attach / detach ---------------- */

  useEffect(() => {
    destroyed.current = false;
    retryCount.current = 0;
    void attach();
    return () => {
      destroyed.current = true;
      clearRetryTimer();
      destroyHls();
    };
  }, [attach, clearRetryTimer, destroyHls]);

  const setLevel = useCallback(
    (index: number) => {
      const hls = hlsRef.current;
      if (!hls) return;
      hls.currentLevel = index;
      patch({ currentLevel: index, autoLevelEnabled: index === -1 });
    },
    [patch],
  );

  const retry = useCallback(() => {
    retryCount.current = 0;
    clearRetryTimer();
    setState((current) => ({ ...current, error: null }));
    void attach();
  }, [attach, clearRetryTimer]);

  return { ...state, setLevel, retry };
}
