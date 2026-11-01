"use client";

import { memo, useMemo, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { CalendarDays, Flame, Play, Radio, Trophy } from "lucide-react";

import { EventCard } from "@/components/catalog/EventRail";
import { ChannelCard } from "@/components/catalog/ChannelRail";
import { Chip, EmptyState, ErrorState, RailSkeleton, SectionHeading, Skeleton } from "@/components/ui/primitives";
import { useChannels, useLiveEvents } from "@/hooks/use-zuca-queries";
import type { LiveEvent } from "@/lib/types";
import { formatRelative, formatTime } from "@/lib/utils";

type EventFilter = "todos" | "ao-vivo" | "agendados" | "encerrados";

const FILTERS: Array<{ value: EventFilter; label: string }> = [
  { value: "todos", label: "Todos" },
  { value: "ao-vivo", label: "No ar agora" },
  { value: "agendados", label: "Agendados" },
  { value: "encerrados", label: "Encerrados" },
];

function FeaturedLive({ event }: { event: LiveEvent }) {
  const channel = event.channelIds[0];

  return (
    <Link
      href={channel ? `/assistir/${channel}` : "/canais"}
      className="focusable glass group relative block overflow-hidden rounded-[28px] p-5 sm:p-7"
      aria-label={`Assistir ${event.title} ao vivo`}
    >
      <span className="pointer-events-none absolute -right-24 -top-24 size-64 rounded-full bg-zuca-brand/16 blur-3xl transition group-hover:bg-zuca-brand/24" />
      <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-zuca-brand px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-white">
            <span className="size-1.5 animate-[live-pulse_1.8s_ease-in-out_infinite] rounded-full bg-white" />
            Transmitindo agora
          </span>
          <h2 className="mt-3 max-w-2xl text-xl font-extrabold leading-tight tracking-tight text-white sm:text-3xl">
            {event.title}
          </h2>
          <p className="mt-2 text-[13px] text-white/50">
            {event.leagueName} · {formatTime(event.startsAt)} às {formatTime(event.endsAt)} ·{" "}
            encerra {formatRelative(event.endsAt)}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-4">
          <div className="flex items-center gap-3">
            <TeamAvatar name={event.homeName} logo={event.homeLogo} />
            <span className="font-display text-sm font-extrabold tracking-widest text-white/30">VS</span>
            <TeamAvatar name={event.awayName} logo={event.awayLogo} />
          </div>
          <span className="inline-flex h-12 items-center gap-2 rounded-2xl bg-white px-5 text-sm font-bold text-zuca-void transition group-hover:bg-zuca-brand group-hover:text-white">
            <Play className="size-4 fill-current" aria-hidden />
            Assistir
          </span>
        </div>
      </div>
    </Link>
  );
}

function TeamAvatar({ name, logo }: { name: string; logo: string }) {
  return (
    <span className="flex flex-col items-center gap-1.5">
      <span className="flex size-12 items-center justify-center overflow-hidden rounded-2xl bg-white/8 ring-1 ring-white/12">
        {logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logo} alt="" loading="lazy" decoding="async" className="size-8 object-contain" />
        ) : (
          <Trophy className="size-5 text-white/35" aria-hidden />
        )}
      </span>
      <span className="max-w-[6rem] truncate text-[10.5px] font-semibold text-white/55">{name}</span>
    </span>
  );
}

function AoVivoClientComponent() {
  const [filter, setFilter] = useState<EventFilter>("todos");
  const { data, isPending, isError, error, refetch, isFetching } = useLiveEvents(filter);
  const { data: catalog } = useChannels({});

  const events = data?.events ?? [];
  const counts = data?.counts;

  const sportChannelIds = useMemo(() => {
    const channels = catalog?.channels ?? [];
    return new Set(
      channels.filter((channel) => channel.categories.includes(1)).map((channel) => channel.id),
    );
  }, [catalog]);

  const sportChannels = useMemo(
    () => (catalog?.channels ?? []).filter((channel) => sportChannelIds.has(channel.id)).slice(0, 24),
    [catalog, sportChannelIds],
  );

  const liveEvents = events.filter((event) => event.status === "ao-vivo");
  const featured = liveEvents[0] ?? events[0] ?? null;

  return (
    <div className="flex flex-col gap-9 pb-6 pt-2">
      <header className="flex flex-col gap-4">
        <div>
          <h1 className="flex items-center gap-2.5 text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
            <Flame className="size-6 text-zuca-brand" aria-hidden />
            Eventos ao vivo
          </h1>
          <p className="mt-1.5 text-[13.5px] text-white/48">
            {counts
              ? `${counts.live} no ar agora · ${counts.upcoming} agendados · ${counts.total} no total`
              : "Agenda esportiva atualizada em tempo real"}
          </p>
        </div>

        <div className="no-scrollbar snap-x-carousel -mx-1 flex items-center gap-2 overflow-x-auto px-1 pb-1" role="tablist" aria-label="Filtrar eventos">
          {FILTERS.map((option) => (
            <Chip
              key={option.value}
              active={filter === option.value}
              role="tab"
              aria-selected={filter === option.value}
              onClick={() => setFilter(option.value)}
            >
              {option.label}
              {counts && option.value !== "todos" ? (
                <span className="ml-1.5 font-mono text-[10.5px] opacity-60">
                  {option.value === "ao-vivo"
                    ? counts.live
                    : option.value === "agendados"
                      ? counts.upcoming
                      : counts.finished}
                </span>
              ) : null}
            </Chip>
          ))}
        </div>
      </header>

      <AnimatePresence mode="wait">
        {isPending ? (
          <motion.div key="carregando" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col gap-6">
            <Skeleton className="h-40 w-full rounded-[28px]" />
            <RailSkeleton count={4} />
          </motion.div>
        ) : isError ? (
          <motion.div key="erro" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <ErrorState
              title="Agenda indisponível"
              description={
                error instanceof Error
                  ? error.message
                  : "Não conseguimos sincronizar a agenda de eventos agora."
              }
              onRetry={() => void refetch()}
              retrying={isFetching}
            />
          </motion.div>
        ) : events.length === 0 ? (
          <motion.div key="vazio" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <EmptyState
              icon={<CalendarDays className="size-7" aria-hidden />}
              title="Nenhum evento nesta seleção"
              description="Não há eventos com este filtro no momento. Escolha outra opção ou explore os canais de esportes abaixo."
            />
          </motion.div>
        ) : (
          <motion.div
            key="lista"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
            className="flex flex-col gap-9"
          >
            {featured ? <FeaturedLive event={featured} /> : null}

            <section aria-label="Lista de eventos">
              <SectionHeading
                title={filter === "todos" ? "Agenda completa" : FILTERS.find((item) => item.value === filter)?.label ?? "Eventos"}
                subtitle={`${events.length} eventos listados · atualizado ${isFetching ? "agora" : "recentemente"}`}
                icon={<Trophy className="size-4" aria-hidden />}
              />
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {events.map((event, index) => (
                  <motion.div
                    key={event.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(index * 0.03, 0.4), duration: 0.3 }}
                    className="[&>a]:w-full"
                  >
                    <EventCard event={event} priority={index} />
                  </motion.div>
                ))}
              </div>
            </section>
          </motion.div>
        )}
      </AnimatePresence>

      {sportChannels.length > 0 ? (
        <section aria-label="Canais de esportes">
          <SectionHeading
            title="Canais de esportes"
            subtitle="Todas as praças esportivas liberadas pela curadoria"
            icon={<Radio className="size-4" aria-hidden />}
          />
          <div className="no-scrollbar snap-x-carousel -mx-1 flex gap-3.5 overflow-x-auto px-1 pb-2">
            {sportChannels.map((channel, index) => (
              <ChannelCard key={channel.id} channel={channel} priority={index} group="esportes" />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

export const AoVivoClient = memo(AoVivoClientComponent);
