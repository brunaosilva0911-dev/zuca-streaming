"use client";

import { memo, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { CalendarClock, Radio, Search, Sparkles, Tv, X } from "lucide-react";

import { ChannelCard } from "@/components/catalog/ChannelRail";
import { EmptyState, ErrorState, GridSkeleton, SectionHeading, ZButton } from "@/components/ui/primitives";
import { useFocusable } from "@/hooks/use-spatial-navigation";
import { useChannels, useEpgGuide } from "@/hooks/use-zuca-queries";
import { cn, formatTime } from "@/lib/utils";

const SUGGESTIONS = [
  "Globo",
  "Esportes",
  "Infantil",
  "Notícias",
  "Filmes",
  "Documentário",
];

function SearchInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const { ref, focused, tabIndex } = useFocusable<HTMLDivElement>({
    group: "busca",
    priority: 0,
    autoFocus: true,
  });

  return (
    <div
      ref={ref}
      data-focus={focused ? "true" : "false"}
      className={cn("focusable glass-strong flex h-16 w-full items-center gap-3 rounded-3xl px-5")}
    >
      <Search className="size-5 shrink-0 text-zuca-brand" aria-hidden />
      <input
        type="search"
        value={value}
        tabIndex={tabIndex}
        autoFocus
        onChange={(event) => onChange(event.target.value)}
        placeholder="Buscar canais, programas, categorias…"
        aria-label="Campo de busca da ZUCA"
        className="w-full min-w-0 bg-transparent text-[16px] text-white placeholder:text-white/32 focus:outline-none [&::-webkit-search-cancel-button]:hidden"
      />
      {value ? (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="Limpar busca"
          className="shrink-0 rounded-xl p-2 text-white/45 transition hover:bg-white/10 hover:text-white"
        >
          <X className="size-4" aria-hidden />
        </button>
      ) : null}
    </div>
  );
}

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function BuscaClientComponent() {
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query.trim()), 280);
    return () => clearTimeout(timer);
  }, [query]);

  const needle = normalize(debounced);

  const { data: catalog, isPending: catalogPending, isError, error, refetch, isFetching } =
    useChannels({});
  const channels = catalog?.channels ?? [];

  const channelIds = useMemo(
    () => channels.slice(0, 80).map((channel) => channel.id),
    [channels],
  );
  const { data: epg, isPending: epgPending } = useEpgGuide({
    channelIds: channelIds.length > 0 ? channelIds : undefined,
    windowHours: 12,
    enabled: channelIds.length > 0 && needle.length >= 2,
  });

  const matchedChannels = useMemo(() => {
    if (!needle) return [];
    return channels.filter((channel) =>
      normalize(`${channel.name} ${channel.categoryNames.join(" ")}`).includes(needle),
    ).slice(0, 30);
  }, [channels, needle]);

  const matchedPrograms = useMemo(() => {
    if (!needle || needle.length < 2) return [];
    const channelNameById = new Map(channels.map((channel) => [channel.id, channel]));
    const results: Array<{
      key: string;
      channelId: string;
      channelName: string;
      title: string;
      startsAt: number;
      isNow: boolean;
    }> = [];

    for (const row of epg?.rows ?? []) {
      for (const program of row.programs) {
        if (normalize(program.title).includes(needle)) {
          results.push({
            key: `${row.channel.id}-${program.startsAt}`,
            channelId: row.channel.id,
            channelName: channelNameById.get(row.channel.id)?.name ?? row.channel.name,
            title: program.title,
            startsAt: program.startsAt,
            isNow: program.isNow,
          });
        }
      }
    }
    return results.slice(0, 24);
  }, [channels, epg, needle]);

  const matchedCategories = useMemo(() => {
    if (!needle) return [];
    return (catalog?.categories ?? []).filter(
      (category) => category.id !== 0 && normalize(category.name).includes(needle),
    );
  }, [catalog, needle]);

  const handleChange = useCallback((value: string) => setQuery(value), []);
  const total = matchedChannels.length + matchedPrograms.length + matchedCategories.length;

  return (
    <div className="flex flex-col gap-8 pb-6 pt-2">
      <header className="flex flex-col gap-5">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
            Buscar na ZUCA
          </h1>
          <p className="mt-1.5 text-[13.5px] text-white/48">
            Encontre canais ao vivo, programas da grade e categorias — tudo já filtrado
            pela curadoria familiar.
          </p>
        </div>

        <SearchInput value={query} onChange={handleChange} />

        {!needle ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/35">
              <Sparkles className="size-3.5" aria-hidden />
              Sugestões
            </span>
            {SUGGESTIONS.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => setQuery(suggestion)}
                className="focusable rounded-full border border-white/12 bg-white/5 px-3.5 py-1.5 text-[12.5px] text-white/68 transition hover:border-white/30 hover:text-white"
              >
                {suggestion}
              </button>
            ))}
          </div>
        ) : null}
      </header>

      <AnimatePresence mode="wait">
        {catalogPending ? (
          <motion.div key="carregando" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <GridSkeleton count={12} />
          </motion.div>
        ) : isError ? (
          <motion.div key="erro" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <ErrorState
              title="Busca indisponível"
              description={error instanceof Error ? error.message : "Não foi possível consultar o catálogo."}
              onRetry={() => void refetch()}
              retrying={isFetching}
            />
          </motion.div>
        ) : !needle ? (
          <motion.section
            key="explorar"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.32 }}
          >
            <SectionHeading
              title="Explorar canais"
              subtitle={`${channels.length} canais liberados para todos os perfis`}
              icon={<Tv className="size-4" aria-hidden />}
            />
            <div className="grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
              {channels.slice(0, 24).map((channel, index) => (
                <ChannelCard key={channel.id} channel={channel} priority={index} group="explorar" />
              ))}
            </div>
          </motion.section>
        ) : total === 0 ? (
          <motion.div key="vazio" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <EmptyState
              title={`Nada encontrado para “${debounced}”`}
              description="Verifique a grafia ou tente um termo mais amplo, como o nome de uma categoria (Esportes, Infantil, Notícias)."
              action={<ZButton variant="primary" onClick={() => setQuery("")}>Limpar busca</ZButton>}
            />
          </motion.div>
        ) : (
          <motion.div
            key="resultados"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
            className="flex flex-col gap-9"
          >
            {matchedCategories.length > 0 ? (
              <section aria-label="Categorias encontradas">
                <SectionHeading title="Categorias" subtitle={`${matchedCategories.length} resultados`} />
                <div className="flex flex-wrap gap-2">
                  {matchedCategories.map((category) => (
                    <Link
                      key={category.id}
                      href={`/canais?categoria=${category.id}`}
                      className="focusable glass rounded-full px-4 py-2 text-[13px] font-semibold text-white/82 transition hover:text-white"
                    >
                      {category.name}
                    </Link>
                  ))}
                </div>
              </section>
            ) : null}

            {matchedChannels.length > 0 ? (
              <section aria-label="Canais encontrados">
                <SectionHeading
                  title="Canais"
                  subtitle={`${matchedChannels.length} canais correspondem à busca`}
                  icon={<Radio className="size-4" aria-hidden />}
                />
                <div className="grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
                  {matchedChannels.map((channel, index) => (
                    <ChannelCard key={channel.id} channel={channel} priority={index} group="busca-canais" />
                  ))}
                </div>
              </section>
            ) : null}

            <section aria-label="Programas encontrados">
              <SectionHeading
                title="Na programação"
                subtitle={
                  epgPending
                    ? "Consultando a grade…"
                    : `${matchedPrograms.length} programas correspondem à busca`
                }
                icon={<CalendarClock className="size-4" aria-hidden />}
              />
              {matchedPrograms.length > 0 ? (
                <ul className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
                  {matchedPrograms.map((program) => (
                    <li key={program.key}>
                      <Link
                        href={`/assistir/${program.channelId}`}
                        className="focusable glass flex items-start gap-3 rounded-2xl px-4 py-3 transition hover:border-white/25"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13.5px] font-bold text-white/92">
                            {program.title}
                          </span>
                          <span className="mt-0.5 block truncate text-[11.5px] text-white/45">
                            {program.channelName} · {formatTime(program.startsAt)}
                          </span>
                        </span>
                        {program.isNow ? (
                          <span className="shrink-0 rounded-full bg-zuca-brand px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-[0.16em] text-white">
                            No ar
                          </span>
                        ) : null}
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="glass rounded-2xl px-4 py-5 text-[13px] text-white/50">
                  Nenhum programa com esse nome na janela de 12 horas consultada.
                </p>
              )}
            </section>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export const BuscaClient = memo(BuscaClientComponent);
