"use client";

import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, Heart, Loader2, ShieldCheck } from "lucide-react";

import { PlayerShell } from "@/components/player/PlayerShell";
import { ErrorState, SectionHeading, Skeleton, ZButton } from "@/components/ui/primitives";
import { useChannelStream, useFavoriteMutation, useLibrary, useWatchProgressMutation } from "@/hooks/use-zuca-queries";
import type { Channel, Program, ResolvedStream } from "@/lib/types";
import { formatDuration, formatTime } from "@/lib/utils";
import { useAppStore } from "@/stores/app-store";
import { usePlayerStore } from "@/stores/player-store";

interface WatchExperienceProps {
  channel: Channel;
  initialStream: ResolvedStream | null;
  initialNowPlaying: Program | null;
  initialUpNext: Program[];
}

function WatchExperienceComponent({
  channel,
  initialStream,
  initialNowPlaying,
  initialUpNext,
}: WatchExperienceProps) {
  const router = useRouter();
  const [attempt, setAttempt] = useState(0);

  const profileId = useAppStore((state) => state.activeProfileId);
  const { data: library } = useLibrary(profileId);
  const favoriteMutation = useFavoriteMutation(profileId);
  const watchMutation = useWatchProgressMutation(profileId);

  const setInteractivePanelOpen = usePlayerStore((state) => state.setInteractivePanelOpen);

  const {
    data: live,
    isPending: streamPending,
    isError: streamError,
    error,
    refetch,
    isFetching,
  } = useChannelStream(channel.id, attempt >= 0);

  const stream = live?.stream ?? initialStream;
  const nowPlaying = live?.nowPlaying ?? initialNowPlaying;
  const upNext = live?.upNext ?? initialUpNext;

  const isFavorite = useMemo(
    () => (library?.favorites ?? []).some((entry) => entry.channelId === channel.id),
    [channel.id, library],
  );

  /* Fecha o painel interativo ao trocar de canal. */
  useEffect(() => {
    setInteractivePanelOpen(false);
  }, [channel.id, setInteractivePanelOpen]);

  /* Registra tempo assistido a cada tick emitido pelo player. */
  useEffect(() => {
    if (!profileId) return;
    function onTick(event: Event) {
      const detail = (event as CustomEvent<{ channelId: string; seconds: number }>).detail;
      if (!detail || detail.channelId !== channel.id) return;
      watchMutation.mutate({
        channelId: channel.id,
        channelName: channel.name,
        logo: channel.logo,
        seconds: detail.seconds,
      });
    }
    window.addEventListener("zuca:watch-tick", onTick as EventListener);
    return () => window.removeEventListener("zuca:watch-tick", onTick as EventListener);
  }, [channel.id, channel.logo, channel.name, profileId, watchMutation]);

  const toggleFavorite = useCallback(() => {
    if (!profileId) {
      router.push("/perfil");
      return;
    }
    favoriteMutation.mutate({
      action: isFavorite ? "desfavoritar" : "favoritar",
      channelId: channel.id,
      channelName: channel.name,
      logo: channel.logo,
    });
  }, [channel.id, channel.logo, channel.name, favoriteMutation, isFavorite, profileId, router]);

  const handleRetry = useCallback(() => {
    setAttempt((current) => current + 1);
    void refetch();
  }, [refetch]);

  if (streamError && !stream) {
    return (
      <div className="pt-6">
        <ErrorState
          title="Canal temporariamente indisponível"
          description={
            error instanceof Error
              ? error.message
              : "Não conseguimos obter o sinal desta emissora agora."
          }
          onRetry={handleRetry}
          retrying={isFetching}
        />
        <div className="mt-4 flex justify-center gap-3">
          <ZButton variant="glass" onClick={() => router.push("/canais")}>
            Ver outros canais
          </ZButton>
          <ZButton variant="primary" onClick={() => router.push("/guia")}>
            Abrir guia de programação
          </ZButton>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8 pb-6 pt-2">
      {/* Trilha de navegação */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => (window.history.length > 1 ? router.back() : router.push("/canais"))}
          className="focusable glass inline-flex h-10 items-center gap-2 rounded-xl px-3.5 text-[13px] font-semibold text-white/78 transition hover:text-white"
          aria-label="Voltar para a página anterior"
        >
          <ChevronLeft className="size-4" aria-hidden />
          Voltar
        </button>

        <span className="inline-flex items-center gap-2 rounded-full border border-zuca-accent/25 bg-zuca-accent/8 px-3 py-1.5 text-[11.5px] font-semibold text-zuca-accent">
          <ShieldCheck className="size-3.5" aria-hidden />
          Conteúdo verificado · curadoria familiar
        </span>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        {/* Player */}
        <div className="min-w-0">
          {streamPending && !stream ? (
            <div className="relative aspect-video w-full overflow-hidden rounded-[26px] bg-black">
              <Skeleton className="absolute inset-0 rounded-none" />
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                <Loader2 className="size-8 animate-spin text-zuca-brand" aria-hidden />
                <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-white/55">
                  Obtendo sinal
                </p>
              </div>
            </div>
          ) : (
            <PlayerShell
              key={`${channel.id}-${attempt}`}
              channel={{
                id: channel.id,
                name: channel.name,
                logo: channel.logo,
                backdrop: channel.backdrop,
              }}
              stream={stream}
              nowPlaying={nowPlaying}
              upNext={upNext}
              isFavorite={isFavorite}
              onToggleFavorite={toggleFavorite}
              pipHandoff
            />
          )}

          {/* Metadados sob o player */}
          <div className="mt-5 flex flex-col gap-4">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <h1 className="text-xl font-extrabold tracking-tight text-white sm:text-2xl">
                  {channel.name}
                </h1>
                <p className="mt-1 flex flex-wrap items-center gap-2 text-[12.5px] text-white/45">
                  {channel.categoryNames.length > 0 ? (
                    channel.categoryNames.map((name) => (
                      <span key={name} className="rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5">
                        {name}
                      </span>
                    ))
                  ) : (
                    <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5">
                      Ao vivo
                    </span>
                  )}
                  <span className="font-mono">Qualidade {channel.quality}</span>
                </p>
              </div>

              <div className="flex items-center gap-2">
                <ZButton
                  variant={isFavorite ? "primary" : "glass"}
                  onClick={toggleFavorite}
                  icon={<Heart className={cnFill(isFavorite)} aria-hidden />}
                  loading={favoriteMutation.isPending}
                >
                  {isFavorite ? "Favoritado" : "Favoritar"}
                </ZButton>
                <ZButton
                  variant="glass"
                  onClick={() => setInteractivePanelOpen(true)}
                >
                  Modo ao vivo
                </ZButton>
              </div>
            </div>

            {nowPlaying ? (
              <div className="glass rounded-3xl p-5">
                <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-zuca-brand-soft">
                  No ar agora
                </p>
                <h2 className="mt-2 text-lg font-bold text-white">{nowPlaying.title}</h2>
                <p className="mt-1 font-mono text-[11.5px] text-white/40">
                  {formatTime(nowPlaying.startsAt)} → {formatTime(nowPlaying.endsAt)} ·{" "}
                  {formatDuration(nowPlaying.durationMs)}
                </p>
                <p className="mt-3 text-[13.5px] leading-relaxed text-white/62">
                  {nowPlaying.description}
                </p>
              </div>
            ) : null}
          </div>
        </div>

        {/* Coluna lateral: a seguir */}
        <aside className="flex flex-col gap-4">
          <SectionHeading title="A seguir" subtitle={`Programação de ${channel.name}`} />
          <AnimatePresence initial={false}>
            {upNext.length === 0 ? (
              <motion.p
                key="vazio"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="glass rounded-2xl px-4 py-5 text-[13px] leading-relaxed text-white/50"
              >
                A emissora ainda não publicou a grade das próximas horas. Deixe o canal
                rolando — a ZUCA atualiza a programação automaticamente.
              </motion.p>
            ) : (
              <ul className="flex flex-col gap-2.5">
                {upNext.map((program, index) => (
                  <motion.li
                    key={`${program.startsAt}-${program.title}`}
                    initial={{ opacity: 0, x: 16 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: Math.min(index * 0.045, 0.35), duration: 0.32 }}
                    className="glass-soft rounded-2xl px-4 py-3"
                  >
                    <p className="flex items-center gap-2 font-mono text-[11px] text-white/40">
                      <span className="rounded-md bg-white/8 px-1.5 py-0.5">
                        {formatTime(program.startsAt)}
                      </span>
                      {formatDuration(program.durationMs)}
                    </p>
                    <p className="mt-1.5 text-[13.5px] font-bold leading-snug text-white/90">
                      {program.title}
                    </p>
                    <p className="mt-1 line-clamp-2 text-[12px] leading-relaxed text-white/48">
                      {program.description}
                    </p>
                  </motion.li>
                ))}
              </ul>
            )}
          </AnimatePresence>
        </aside>
      </div>
    </div>
  );
}

function cnFill(filled: boolean): string {
  return filled ? "size-4 fill-current" : "size-4";
}

export const WatchExperience = memo(WatchExperienceComponent);
