import type { Metadata } from "next";
import Link from "next/link";
import {
  CalendarRange,
  Radio,
  Sparkles,
  Trophy,
  Tv,
  Wand2,
} from "lucide-react";

import { ContinueWatching } from "@/components/home/ContinueWatching";
import { ChannelRail } from "@/components/catalog/ChannelRail";
import { EventRail } from "@/components/catalog/EventRail";
import { HeroBillboard, type HeroSlide } from "@/components/catalog/HeroBillboard";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import { EmptyState, ErrorState, SectionHeading } from "@/components/ui/primitives";
import { getChannelGroup, getEpgRows, getLiveEvents } from "@/lib/api/server";
import type { Channel, Program } from "@/lib/types";

export const metadata: Metadata = {
  title: "Início",
  description:
    "Sua tela inicial ZUCA: destaques ao vivo, eventos esportivos, guia de programação e canais por categoria.",
};

export const dynamic = "force-dynamic";

/** Curadoria do destaque: prioriza canais abertos, esportes e infantis. */
const HERO_CATEGORY_PRIORITY = [6, 1, 2, 4, 5, 7, 3];

function pickHeroSlides(
  channels: Channel[],
  nowPlayingByChannel: Map<string, Program>,
  limit = 5,
): HeroSlide[] {
  const ranked = [...channels].sort((a, b) => {
    const scoreA = Math.min(
      ...a.categories.map((id) => {
        const position = HERO_CATEGORY_PRIORITY.indexOf(id);
        return position === -1 ? 99 : position;
      }),
      99,
    );
    const scoreB = Math.min(
      ...b.categories.map((id) => {
        const position = HERO_CATEGORY_PRIORITY.indexOf(id);
        return position === -1 ? 99 : position;
      }),
      99,
    );
    if (scoreA !== scoreB) return scoreA - scoreB;
    return a.name.localeCompare(b.name, "pt-BR");
  });

  return ranked.slice(0, limit).map((channel) => ({
    channel,
    program: nowPlayingByChannel.get(channel.id) ?? null,
  }));
}

export default async function HomePage() {
  const [groupResult, eventsResult, epgResult] = await Promise.allSettled([
    getChannelGroup(),
    getLiveEvents(),
    getEpgRows({ windowHours: 6 }),
  ]);

  const group = groupResult.status === "fulfilled" ? groupResult.value : null;
  const events = eventsResult.status === "fulfilled" ? eventsResult.value : [];
  const epgRows = epgResult.status === "fulfilled" ? epgResult.value : [];

  const catalogUnavailable = groupResult.status === "rejected";

  const nowPlayingByChannel = new Map<string, Program>();
  const now = Date.now();
  for (const row of epgRows) {
    const current =
      row.programs.find((program) => program.startsAt <= now && program.endsAt > now) ??
      row.programs.find((program) => program.isNow);
    if (current) nowPlayingByChannel.set(row.channel.id, current);
  }

  const nowPlayingTitles: Record<string, string> = {};
  for (const [channelId, program] of nowPlayingByChannel) {
    nowPlayingTitles[channelId] = program.title;
  }

  const channels = group?.channels ?? [];
  const categories = group?.categories ?? [];

  const liveEvents = events.filter((event) => event.status === "ao-vivo");
  const upcomingEvents = events.filter((event) => event.status === "agendado").slice(0, 14);

  const nowPlayingChannels = channels.filter((channel) =>
    nowPlayingByChannel.has(channel.id),
  );

  const heroSlides = pickHeroSlides(
    nowPlayingChannels.length >= 5 ? nowPlayingChannels : channels,
    nowPlayingByChannel,
  );

  const categoryRails = categories
    .filter((category) => category.id !== 0)
    .map((category) => ({
      category,
      channels: channels.filter((channel) => channel.categories.includes(category.id)),
    }))
    .filter((rail) => rail.channels.length >= 4)
    .slice(0, 6);

  return (
    <div className="flex flex-col gap-10 pb-4 pt-2 sm:gap-12">
      {/* ---------------- Destaque ---------------- */}
      <ErrorBoundary label="destaque-principal">
        {catalogUnavailable || heroSlides.length === 0 ? (
          <CatalogFailure
            unavailable={catalogUnavailable}
            onRetryHref="/"
          />
        ) : (
          <HeroBillboard slides={heroSlides} />
        )}
      </ErrorBoundary>

      {/* ---------------- Atalhos ---------------- */}
      <section aria-label="Atalhos rápidos" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <QuickAction
          href="/canais"
          title="Canais ao vivo"
          description={`${channels.length} canais liberados`}
          icon={<Tv className="size-5" aria-hidden />}
        />
        <QuickAction
          href="/guia"
          title="Guia de programação"
          description="Viaje no tempo e reassista"
          icon={<CalendarRange className="size-5" aria-hidden />}
        />
        <QuickAction
          href="/ao-vivo"
          title="Eventos esportivos"
          description={`${liveEvents.length} acontecendo agora`}
          icon={<Trophy className="size-5" aria-hidden />}
        />
        <QuickAction
          href="/perfil"
          title="Perfis e controle"
          description="Curadoria familiar ativa"
          icon={<Wand2 className="size-5" aria-hidden />}
        />
      </section>

      {/* ---------------- Continuar assistindo ---------------- */}
      <section aria-label="Continuar assistindo">
        <SectionHeading
          title="Continuar assistindo"
          subtitle="Retome de onde você parou neste perfil"
          icon={<Sparkles className="size-4" aria-hidden />}
        />
        <ErrorBoundary label="continuar-assistindo">
          <ContinueWatching />
        </ErrorBoundary>
      </section>

      {/* ---------------- Eventos ao vivo ---------------- */}
      {liveEvents.length > 0 || upcomingEvents.length > 0 ? (
        <section aria-label="Eventos ao vivo">
          <SectionHeading
            title="Acontecendo agora"
            subtitle={`${liveEvents.length} ao vivo · ${upcomingEvents.length} agendados`}
            icon={<Trophy className="size-4" aria-hidden />}
            action={
              <Link href="/ao-vivo" className="focusable rounded-xl px-3 py-2 text-[13px] font-semibold text-zuca-brand-soft transition hover:text-white">
                Ver agenda completa
              </Link>
            }
          />
          <ErrorBoundary label="trilho-eventos">
            <EventRail events={[...liveEvents, ...upcomingEvents].slice(0, 18)} />
          </ErrorBoundary>
        </section>
      ) : null}

      {/* ---------------- No ar agora ---------------- */}
      {nowPlayingChannels.length > 0 ? (
        <section aria-label="No ar agora">
          <SectionHeading
            title="No ar agora"
            subtitle="Programas em exibição neste instante"
            icon={<Radio className="size-4" aria-hidden />}
          />
          <ErrorBoundary label="trilho-no-ar">
            <ChannelRail
              channels={nowPlayingChannels.slice(0, 24)}
              nowPlayingByChannel={nowPlayingTitles}
              group="no-ar"
            />
          </ErrorBoundary>
        </section>
      ) : null}

      {/* ---------------- Trilhos por categoria ---------------- */}
      {categoryRails.map((rail) => (
        <section key={rail.category.id} aria-label={`Canais de ${rail.category.name}`}>
          <SectionHeading
            title={rail.category.name}
            subtitle={`${rail.channels.length} canais nesta categoria`}
          />
          <ErrorBoundary label={`trilho-${rail.category.name}`}>
            <ChannelRail
              channels={rail.channels.slice(0, 28)}
              nowPlayingByChannel={nowPlayingTitles}
              group={`cat-${rail.category.id}`}
            />
          </ErrorBoundary>
        </section>
      ))}

      {!catalogUnavailable && channels.length === 0 ? (
        <EmptyState
          title="O catálogo está vazio"
          description="Nenhum canal passou pela curadoria neste momento. Tente novamente em instantes."
        />
      ) : null}

    </div>
  );
}

function QuickAction({
  href,
  title,
  description,
  icon,
}: {
  href: string;
  title: string;
  description: string;
  icon: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="focusable glass group flex items-center gap-3 rounded-2xl p-3.5 transition hover:border-white/22"
      aria-label={`${title} — ${description}`}
    >
      <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-zuca-brand/22 to-zuca-violet/18 text-zuca-brand-soft transition group-hover:from-zuca-brand group-hover:text-white">
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-[13.5px] font-bold text-white">{title}</span>
        <span className="block truncate text-[11.5px] text-white/45">{description}</span>
      </span>
    </Link>
  );
}

function CatalogFailure({ unavailable }: { unavailable: boolean; onRetryHref: string }) {
  void unavailable;
  return (
    <div className="flex flex-col gap-4 pt-4">
      <ErrorState
        title="Catálogo temporariamente indisponível"
        description="Não conseguimos falar com a origem de canais neste instante. O restante da ZUCA continua funcionando — recarregue a página para tentar de novo."
      />
      <div className="flex flex-wrap justify-center gap-3">
        <Link
          href="/"
          className="focusable inline-flex h-11 items-center gap-2 rounded-2xl bg-gradient-to-br from-zuca-brand to-zuca-violet px-5 text-sm font-bold text-white"
        >
          Recarregar a ZUCA
        </Link>
        <Link
          href="/guia"
          className="focusable glass inline-flex h-11 items-center rounded-2xl px-5 text-sm font-semibold text-white/85"
        >
          Ir para o guia
        </Link>
      </div>
    </div>
  );
}
