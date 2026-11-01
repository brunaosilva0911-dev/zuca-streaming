"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Grid2x2, LayoutList, Radio, Search, SlidersHorizontal, X } from "lucide-react";

import { ChannelCard } from "@/components/catalog/ChannelRail";
import {
  Chip,
  EmptyState,
  ErrorState,
  GridSkeleton,
  SectionHeading,
  ZButton,
} from "@/components/ui/primitives";
import { useChannels, useEpgGuide } from "@/hooks/use-zuca-queries";
import { useFocusable } from "@/hooks/use-spatial-navigation";
import type { Channel } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/stores/app-store";

type Layout = "grade" | "lista";

function SearchField({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const { ref, focused, tabIndex } = useFocusable<HTMLDivElement>({
    group: "filtros",
    priority: 0,
  });

  return (
    <div
      ref={ref}
      data-focus={focused ? "true" : "false"}
      className={cn(
        "focusable glass flex h-12 min-w-0 flex-1 items-center gap-2.5 rounded-2xl px-4",
        focused && "border-white/70",
      )}
    >
      <Search className="size-4 shrink-0 text-white/40" aria-hidden />
      <input
        type="search"
        value={value}
        tabIndex={tabIndex}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Buscar canal, categoria ou programa…"
        aria-label="Buscar canais"
        className="w-full min-w-0 bg-transparent text-[14px] text-white placeholder:text-white/35 focus:outline-none [&::-webkit-search-cancel-button]:hidden"
      />
      {value ? (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="Limpar busca"
          className="shrink-0 rounded-lg p-1 text-white/45 transition hover:text-white"
        >
          <X className="size-4" aria-hidden />
        </button>
      ) : null}
    </div>
  );
}

function ChannelListRow({ channel, nowPlaying, index }: { channel: Channel; nowPlaying?: string; index: number }) {
  const { ref, focused, tabIndex } = useFocusable<HTMLAnchorElement>({
    group: "lista-canais",
    priority: index,
  });
  const [logoFailed, setLogoFailed] = useState(false);

  return (
    <a
      ref={ref}
      href={`/assistir/${channel.id}`}
      tabIndex={tabIndex}
      data-focus={focused ? "true" : "false"}
      className={cn(
        "focusable glass flex items-center gap-3.5 rounded-2xl px-3.5 py-3 transition",
        focused && "border-white/70",
      )}
      aria-label={`Assistir ${channel.name}`}
    >
      <span className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white/8 ring-1 ring-white/10">
        {channel.logo && !logoFailed ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={channel.logo}
            alt=""
            loading="lazy"
            decoding="async"
            onError={() => setLogoFailed(true)}
            className="max-h-8 max-w-8 object-contain"
          />
        ) : (
          <Radio className="size-4 text-white/35" aria-hidden />
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[14px] font-bold text-white/92">{channel.name}</span>
        <span className="block truncate text-[11.5px] text-white/42">
          {nowPlaying ?? channel.categoryNames.join(" · ") ?? "Transmissão contínua"}
        </span>
      </span>
      <span className="shrink-0 rounded-md border border-white/20 bg-black/40 px-1.5 py-0.5 font-mono text-[10px] font-bold text-white/70">
        {channel.quality}
      </span>
    </a>
  );
}

function ChannelsCatalogComponent() {
  const searchParams = useSearchParams();
  const initialCategory = searchParams.get("categoria") ?? "all";
  const initialQuery = searchParams.get("q") ?? "";

  const [query, setQuery] = useState(initialQuery);
  const [debouncedQuery, setDebouncedQuery] = useState(initialQuery);
  const [categoryId, setCategoryId] = useState(initialCategory);
  const [layout, setLayout] = useState<Layout>("grade");
  const [visibleCount, setVisibleCount] = useState(48);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const dataSaver = useAppStore((state) => state.dataSaver);

  const { data, isPending, isError, error, refetch, isFetching } = useChannels({
    q: debouncedQuery,
    categoryId,
  });

  const channels = data?.channels ?? [];
  const categories = data?.categories ?? [];

  const channelIds = useMemo(
    () => channels.slice(0, 40).map((channel) => channel.id),
    [channels],
  );

  const { data: epg } = useEpgGuide({
    channelIds,
    windowHours: 4,
    enabled: channelIds.length > 0 && !dataSaver,
  });

  const nowPlayingTitles = useMemo(() => {
    const map: Record<string, string> = {};
    const now = Date.now();
    for (const row of epg?.rows ?? []) {
      const current =
        row.programs.find((program) => program.startsAt <= now && program.endsAt > now) ?? null;
      if (current) map[row.channel.id] = current.title;
    }
    return map;
  }, [epg]);

  /* Debounce da busca */
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query.trim()), 320);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    setVisibleCount(48);
  }, [categoryId, debouncedQuery]);

  /* Paginação infinita leve — evita DOM gigante em TVs */
  useEffect(() => {
    const node = sentinelRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setVisibleCount((current) => Math.min(channels.length, current + 36));
        }
      },
      { rootMargin: "600px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [channels.length]);

  const handleQueryChange = useCallback((value: string) => setQuery(value), []);

  const visibleChannels = useMemo(
    () => channels.slice(0, visibleCount),
    [channels, visibleCount],
  );

  const errorMessage =
    error instanceof Error ? error.message : "Não foi possível carregar o catálogo de canais.";

  return (
    <div className="flex flex-col gap-6 pb-6 pt-2">
      <header className="flex flex-col gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
            Canais ao vivo
          </h1>
          <p className="mt-1.5 text-[13.5px] text-white/48">
            {isPending
              ? "Carregando o catálogo com curadoria familiar…"
              : `${data?.total ?? 0} canais disponíveis · filtro de conteúdo adulto sempre ativo`}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <SearchField value={query} onChange={handleQueryChange} />
          <div className="flex items-center gap-1.5">
            <ZButton
              variant={layout === "grade" ? "primary" : "glass"}
              size="md"
              onClick={() => setLayout("grade")}
              aria-label="Exibir em grade"
              icon={<Grid2x2 className="size-4" aria-hidden />}
            >
              Grade
            </ZButton>
            <ZButton
              variant={layout === "lista" ? "primary" : "glass"}
              size="md"
              onClick={() => setLayout("lista")}
              aria-label="Exibir em lista"
              icon={<LayoutList className="size-4" aria-hidden />}
            >
              Lista
            </ZButton>
          </div>
        </div>

        <div
          className="no-scrollbar snap-x-carousel -mx-1 flex items-center gap-2 overflow-x-auto px-1 pb-1"
          role="tablist"
          aria-label="Categorias de canais"
        >
          <Chip active={categoryId === "all"} onClick={() => setCategoryId("all")} role="tab" aria-selected={categoryId === "all"}>
            <SlidersHorizontal className="mr-1.5 inline size-3.5" aria-hidden />
            Todas
          </Chip>
          {categories
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
        {isPending ? (
          <motion.div key="carregando" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <GridSkeleton count={24} />
          </motion.div>
        ) : isError ? (
          <motion.div key="erro" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <ErrorState
              title="Não conseguimos carregar os canais"
              description={errorMessage}
              onRetry={() => void refetch()}
              retrying={isFetching}
            />
          </motion.div>
        ) : channels.length === 0 ? (
          <motion.div key="vazio" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <EmptyState
              title="Nenhum canal encontrado"
              description={
                debouncedQuery
                  ? `Não há resultados para “${debouncedQuery}”. Tente outro termo ou limpe os filtros.`
                  : "Esta categoria não possui canais liberados pela curadoria no momento."
              }
              action={
                <ZButton
                  variant="primary"
                  onClick={() => {
                    setQuery("");
                    setDebouncedQuery("");
                    setCategoryId("all");
                  }}
                >
                  Limpar filtros
                </ZButton>
              }
            />
          </motion.div>
        ) : layout === "grade" ? (
          <motion.section
            key="grade"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
          >
            <SectionHeading
              title={`${visibleChannels.length} de ${channels.length} canais`}
              subtitle={isFetching ? "Atualizando…" : "Use as setas do controle ou deslize para navegar"}
            />
            <div className="grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
              {visibleChannels.map((channel, index) => (
                <ChannelCard
                  key={channel.id}
                  channel={channel}
                  priority={index}
                  group="grade-canais"
                  nowPlayingTitle={nowPlayingTitles[channel.id]}
                />
              ))}
            </div>
            <div ref={sentinelRef} className="h-8" aria-hidden />
            {visibleCount < channels.length ? (
              <div className="mt-2 flex justify-center">
                <ZButton
                  variant="glass"
                  onClick={() => setVisibleCount((current) => Math.min(channels.length, current + 36))}
                >
                  Carregar mais canais
                </ZButton>
              </div>
            ) : null}
          </motion.section>
        ) : (
          <motion.section
            key="lista"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
            className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3"
          >
            {visibleChannels.map((channel, index) => (
              <ChannelListRow
                key={channel.id}
                channel={channel}
                index={index}
                nowPlaying={nowPlayingTitles[channel.id]}
              />
            ))}
            <div ref={sentinelRef} className="h-4 sm:col-span-2 xl:col-span-3" aria-hidden />
          </motion.section>
        )}
      </AnimatePresence>
    </div>
  );
}

export const ChannelsCatalog = memo(ChannelsCatalogComponent);
