"use client";

import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { CalendarRange, Clock3, Filter, Radio } from "lucide-react";

import { EpgGrid } from "@/components/epg/EpgGrid";
import { Chip, EmptyState, ErrorState, Skeleton, ZButton } from "@/components/ui/primitives";
import { useChannels, useEpgGuide } from "@/hooks/use-zuca-queries";
import { formatFullDate } from "@/lib/utils";

const WINDOW_OPTIONS = [
  { hours: 6, label: "6 horas" },
  { hours: 12, label: "12 horas" },
  { hours: 24, label: "24 horas" },
  { hours: 48, label: "48 horas" },
];

function GuiaClientComponent() {
  const searchParams = useSearchParams();
  const focusChannelId = searchParams.get("canal");
  const categoryParam = searchParams.get("categoria") ?? "all";

  const [windowHours, setWindowHours] = useState(24);
  const [offsetHours, setOffsetHours] = useState(0);
  const [categoryId, setCategoryId] = useState(categoryParam);

  const { data: catalog, isPending: catalogPending } = useChannels({});

  const channelIds = useMemo(() => {
    const channels = catalog?.channels ?? [];
    if (categoryId === "all") return channels.slice(0, 60).map((channel) => channel.id);
    const wanted = Number(categoryId);
    return channels
      .filter((channel) => channel.categories.includes(wanted))
      .slice(0, 60)
      .map((channel) => channel.id);
  }, [catalog, categoryId]);

  const {
    data: epg,
    isPending,
    isError,
    error,
    refetch,
    isFetching,
  } = useEpgGuide({
    channelIds: channelIds.length > 0 ? channelIds : undefined,
    windowHours,
    offsetHours,
    enabled: channelIds.length > 0,
  });

  const handleOffsetChange = useCallback((next: number) => setOffsetHours(next), []);

  /* Relógio vivo: atualiza a linha do "agora" a cada 30s sem refazer a consulta. */
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setTick((value) => value + 1), 30_000);
    return () => clearInterval(timer);
  }, []);

  const now = useMemo(
    () => (epg?.now ?? Date.now()) + (tick > 0 ? Math.floor(tick / 2) * 30_000 : 0),
    [epg, tick],
  );

  const rows = epg?.rows ?? [];

  return (
    <div className="flex flex-col gap-6 pb-6 pt-2">
      <header className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="flex items-center gap-2.5 text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
              <CalendarRange className="size-6 text-zuca-brand" aria-hidden />
              Guia de programação
            </h1>
            <p className="mt-1.5 text-[13.5px] text-white/48">
              {formatFullDate(now)} · viagem no tempo habilitada para reassistir o que já passou
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/38">
              <Clock3 className="size-3.5" aria-hidden />
              Janela
            </span>
            {WINDOW_OPTIONS.map((option) => (
              <Chip
                key={option.hours}
                active={windowHours === option.hours}
                onClick={() => setWindowHours(option.hours)}
              >
                {option.label}
              </Chip>
            ))}
          </div>
        </div>

        <div
          className="no-scrollbar snap-x-carousel -mx-1 flex items-center gap-2 overflow-x-auto px-1 pb-1"
          role="tablist"
          aria-label="Filtrar canais por categoria"
        >
          <Chip
            active={categoryId === "all"}
            role="tab"
            aria-selected={categoryId === "all"}
            onClick={() => setCategoryId("all")}
          >
            <Filter className="mr-1.5 inline size-3.5" aria-hidden />
            Todos os canais
          </Chip>
          {(catalog?.categories ?? [])
            .filter((category) => category.id !== 0)
            .map((category) => {
              const active = String(category.id) === categoryId;
              return (
                <Chip
                  key={category.id}
                  active={active}
                  role="tab"
                  aria-selected={active}
                  onClick={() => setCategoryId(String(category.id))}
                >
                  {category.name}
                </Chip>
              );
            })}
        </div>
      </header>

      <AnimatePresence mode="wait">
        {catalogPending || isPending ? (
          <motion.div
            key="carregando"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="glass overflow-hidden rounded-3xl p-3"
          >
            <div className="flex gap-3">
              <div className="flex w-[172px] shrink-0 flex-col gap-2">
                {Array.from({ length: 7 }).map((_, index) => (
                  <Skeleton key={index} className="h-[78px] w-full rounded-2xl" />
                ))}
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                {Array.from({ length: 7 }).map((_, index) => (
                  <div key={index} className="flex gap-2">
                    <Skeleton className="h-[78px] w-[38%] rounded-2xl" />
                    <Skeleton className="h-[78px] w-[26%] rounded-2xl" />
                    <Skeleton className="h-[78px] flex-1 rounded-2xl" />
                  </div>
                ))}
              </div>
            </div>
            <p className="mt-4 text-center text-[12.5px] text-white/40">
              Montando a grade de programação…
            </p>
          </motion.div>
        ) : isError ? (
          <motion.div key="erro" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <ErrorState
              title="Não foi possível montar a grade"
              description={
                error instanceof Error
                  ? error.message
                  : "A origem de programação não respondeu. Tente novamente em instantes."
              }
              onRetry={() => void refetch()}
              retrying={isFetching}
            />
          </motion.div>
        ) : rows.length === 0 ? (
          <motion.div key="vazio" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <EmptyState
              icon={<Radio className="size-7" aria-hidden />}
              title="Sem programação nesta seleção"
              description="Nenhum canal desta categoria publicou grade para a janela escolhida. Amplie a janela ou selecione outra categoria."
              action={
                <ZButton
                  variant="primary"
                  onClick={() => {
                    setCategoryId("all");
                    setWindowHours(24);
                    setOffsetHours(0);
                  }}
                >
                  Restaurar guia completo
                </ZButton>
              }
            />
          </motion.div>
        ) : (
          <motion.div
            key="grade"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
          >
            <EpgGrid
              rows={rows}
              windowStart={epg?.windowStart ?? now - windowHours * 1_800_000}
              windowEnd={epg?.windowEnd ?? now + windowHours * 1_800_000}
              now={now}
              offsetHours={offsetHours}
              onOffsetChange={handleOffsetChange}
              focusChannelId={focusChannelId}
              loading={isFetching}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export const GuiaClient = memo(GuiaClientComponent);
