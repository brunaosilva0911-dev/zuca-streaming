import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ChannelRail } from "@/components/catalog/ChannelRail";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import { SectionHeading } from "@/components/ui/primitives";
import { WatchExperience } from "@/components/watch/WatchExperience";
import {
  getChannelById,
  getChannelGroup,
  getEpgRows,
  getNowPlaying,
  getUpNext,
  resolveStream,
} from "@/lib/api/server";
import { isSafeChannel } from "@/lib/content-filter";
import type { Program, ResolvedStream } from "@/lib/types";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const channel = await getChannelById(id).catch(() => null);
  if (!channel) {
    return { title: "Canal não encontrado", robots: { index: false } };
  }
  return {
    title: `${channel.name} ao vivo`,
    description: `Assista ${channel.name} ao vivo na ZUCA, com guia de programação, brilho ambiente e mini player flutuante.`,
    robots: { index: false, follow: false },
  };
}

export default async function AssistirPage({ params }: PageProps) {
  const { id } = await params;

  if (!id || !isSafeChannel({ id })) {
    notFound();
  }

  const channel = await getChannelById(id).catch(() => null);
  if (!channel) {
    notFound();
  }

  const [streamResult, nowResult, upNextResult, groupResult] = await Promise.allSettled([
    resolveStream(channel.id),
    getNowPlaying(channel.id),
    getUpNext(channel.id, 8),
    getChannelGroup(),
  ]);

  const stream: ResolvedStream | null =
    streamResult.status === "fulfilled" ? streamResult.value : null;
  const nowPlaying: Program | null = nowResult.status === "fulfilled" ? nowResult.value : null;
  const upNext: Program[] = upNextResult.status === "fulfilled" ? upNextResult.value : [];

  const group = groupResult.status === "fulfilled" ? groupResult.value : null;
  const related = (group?.channels ?? [])
    .filter((item) => item.id !== channel.id)
    .filter((item) =>
      item.categories.some((categoryId) => channel.categories.includes(categoryId)),
    )
    .slice(0, 24);

  const fallbackRelated = related.length >= 6
    ? related
    : (group?.channels ?? []).filter((item) => item.id !== channel.id).slice(0, 24);

  return (
    <div className="flex flex-col gap-10">
      <ErrorBoundary label="experiencia-de-reproducao">
        <WatchExperience
          channel={channel}
          initialStream={stream}
          initialNowPlaying={nowPlaying}
          initialUpNext={upNext}
        />
      </ErrorBoundary>

      {fallbackRelated.length > 0 ? (
        <section aria-label="Canais relacionados">
          <SectionHeading
            title="Você também pode gostar"
            subtitle="Canais da mesma categoria, todos verificados pela curadoria familiar"
          />
          <ErrorBoundary label="trilho-relacionados">
            <ChannelRail channels={fallbackRelated} group="relacionados" />
          </ErrorBoundary>
        </section>
      ) : null}
    </div>
  );
}
