"use client";

import { memo, useMemo } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { History, Play } from "lucide-react";

import { RailSkeleton } from "@/components/ui/primitives";
import { useFocusable } from "@/hooks/use-spatial-navigation";
import { useLibrary } from "@/hooks/use-zuca-queries";
import { useAppStore } from "@/stores/app-store";
import { cn, formatRelative } from "@/lib/utils";

function HistoryCard({
  entry,
  index,
}: {
  entry: { channelId: string; channelName: string; logo: string; lastWatchedAt: string; secondsWatched: number };
  index: number;
}) {
  const { ref, focused, tabIndex } = useFocusable<HTMLAnchorElement>({
    group: "continuar",
    priority: index,
  });
  const minutes = Math.round(entry.secondsWatched / 60);

  return (
    <Link
      ref={ref}
      href={`/assistir/${entry.channelId}`}
      tabIndex={tabIndex}
      data-focus={focused ? "true" : "false"}
      aria-label={`Retomar ${entry.channelName}`}
      className="focusable snap-item w-[178px] shrink-0 sm:w-[208px]"
    >
      <motion.div
        animate={{ y: focused ? -4 : 0 }}
        transition={{ type: "spring", stiffness: 380, damping: 28 }}
        className="glass relative overflow-hidden rounded-2xl p-3"
      >
        <div className="flex items-center gap-3">
          <span className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white/8 ring-1 ring-white/10">
            {entry.logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={entry.logo} alt="" loading="lazy" decoding="async" className="max-h-8 max-w-8 object-contain" />
            ) : (
              <History className="size-5 text-white/35" aria-hidden />
            )}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-[13px] font-bold text-white/90">
              {entry.channelName}
            </span>
            <span className="block truncate text-[11px] text-white/42">
              {formatRelative(entry.lastWatchedAt)}
            </span>
          </span>
          <span className="ml-auto flex size-8 shrink-0 items-center justify-center rounded-lg bg-white/10 text-white">
            <Play className="size-3.5 fill-current" aria-hidden />
          </span>
        </div>
        {minutes > 0 ? (
          <p className="mt-2.5 font-mono text-[10.5px] text-white/35">
            {minutes} min assistidos neste perfil
          </p>
        ) : null}
      </motion.div>
    </Link>
  );
}

function ContinueWatchingComponent() {
  const profileId = useAppStore((state) => state.activeProfileId);
  const { data, isLoading } = useLibrary(profileId);

  const entries = useMemo(() => (data?.history ?? []).slice(0, 12), [data]);

  if (isLoading) {
    return <RailSkeleton count={4} />;
  }
  if (entries.length === 0) return null;

  return (
    <div
      className={cn("no-scrollbar snap-x-carousel -mx-1 flex gap-3.5 overflow-x-auto px-1 pb-2")}
      role="list"
      aria-label="Continuar assistindo"
    >
      {entries.map((entry, index) => (
        <div role="listitem" key={entry.channelId} className="contents">
          <HistoryCard entry={entry} index={index} />
        </div>
      ))}
    </div>
  );
}

export const ContinueWatching = memo(ContinueWatchingComponent);
