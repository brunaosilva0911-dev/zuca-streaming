"use client";

import { memo, useCallback, useRef, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Play } from "lucide-react";

import { QualityBadge } from "@/components/ui/primitives";
import { useFocusable } from "@/hooks/use-spatial-navigation";
import { useHorizontalSwipe } from "@/hooks/use-gestures";
import type { Channel } from "@/lib/types";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/*  Cartão de canal                                                    */
/* ------------------------------------------------------------------ */

interface ChannelCardProps {
  channel: Channel;
  nowPlayingTitle?: string;
  size?: "sm" | "md" | "lg";
  priority?: number;
  group?: string;
  href?: string;
}

function ChannelCardComponent({
  channel,
  nowPlayingTitle,
  size = "md",
  priority = 0,
  group = "carrossel",
  href,
}: ChannelCardProps) {
  const { ref, focused, tabIndex } = useFocusable<HTMLAnchorElement>({ group, priority });
  const [imageFailed, setImageFailed] = useState(false);
  const target = href ?? `/assistir/${channel.id}`;

  const widthClass = {
    sm: "w-[132px] sm:w-[150px]",
    md: "w-[168px] sm:w-[200px]",
    lg: "w-[220px] sm:w-[268px]",
  }[size];

  return (
    <Link
      ref={ref}
      href={target}
      tabIndex={tabIndex}
      data-focus={focused ? "true" : "false"}
      aria-label={`Assistir ${channel.name}`}
      className={cn("focusable snap-item group/card relative shrink-0", widthClass)}
    >
      <motion.div
        animate={{ y: focused ? -4 : 0 }}
        transition={{ type: "spring", stiffness: 380, damping: 28 }}
        className="relative aspect-video w-full overflow-hidden rounded-2xl border border-white/8 bg-zuca-slate"
      >
        {!imageFailed && channel.backdrop ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={channel.backdrop}
            alt=""
            loading="lazy"
            decoding="async"
            onError={() => setImageFailed(true)}
            className="absolute inset-0 size-full object-cover transition-transform duration-500 group-hover/card:scale-[1.06]"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-zuca-slate to-zuca-abyss">
            {channel.logo && !imageFailed ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={channel.logo}
                alt=""
                loading="lazy"
                decoding="async"
                className="max-h-12 max-w-[70%] object-contain opacity-90"
                onError={() => setImageFailed(true)}
              />
            ) : (
              <span className="font-display px-3 text-center text-[13px] font-bold text-white/45">
                {channel.name}
              </span>
            )}
          </div>
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-black/82 via-black/8 to-transparent" />

        <div className="absolute left-2 top-2 flex items-center gap-1.5">
          <QualityBadge label={channel.quality} />
        </div>

        <div className="absolute bottom-2 left-2.5 right-2.5 flex items-center gap-2">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-white/12 backdrop-blur-md transition group-hover/card:bg-white group-focus-visible:bg-white">
            <Play className="size-3.5 fill-white text-white transition group-hover/card:fill-zuca-void group-hover/card:text-zuca-void" aria-hidden />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-[13px] font-bold leading-tight text-white">
              {channel.name}
            </span>
            {nowPlayingTitle ? (
              <span className="block truncate text-[10.5px] leading-tight text-white/52">
                {nowPlayingTitle}
              </span>
            ) : (
              <span className="block truncate text-[10.5px] leading-tight text-white/42">
                {channel.categoryNames[0] ?? "Ao vivo"}
              </span>
            )}
          </span>
        </div>
      </motion.div>
    </Link>
  );
}

export const ChannelCard = memo(ChannelCardComponent);

/* ------------------------------------------------------------------ */
/*  Carrossel horizontal                                               */
/* ------------------------------------------------------------------ */

interface ChannelRailProps {
  channels: Channel[];
  nowPlayingByChannel?: Record<string, string>;
  size?: "sm" | "md" | "lg";
  group?: string;
  hrefFor?: (channel: Channel) => string;
}

function ChannelRailComponent({
  channels,
  nowPlayingByChannel,
  size = "md",
  group = "carrossel",
  hrefFor,
}: ChannelRailProps) {
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const [edges, setEdges] = useState({ start: true, end: false });

  const updateEdges = useCallback(() => {
    const node = scrollerRef.current;
    if (!node) return;
    setEdges({
      start: node.scrollLeft <= 8,
      end: node.scrollLeft + node.clientWidth >= node.scrollWidth - 8,
    });
  }, []);

  const scrollByPage = useCallback((direction: 1 | -1) => {
    const node = scrollerRef.current;
    if (!node) return;
    node.scrollBy({ left: direction * node.clientWidth * 0.82, behavior: "smooth" });
  }, []);

  const handleSwipe = useCallback(
    (direction: "left" | "right") => {
      scrollByPage(direction === "left" ? 1 : -1);
    },
    [scrollByPage],
  );

  useHorizontalSwipe(scrollerRef, {
    onSwipe: handleSwipe,
    threshold: 40,
  });

  if (channels.length === 0) return null;

  return (
    <div className="relative">
      {!edges.start ? (
        <RailArrow side="left" onClick={() => scrollByPage(-1)} />
      ) : null}

      <div
        ref={scrollerRef}
        onScroll={updateEdges}
        className="no-scrollbar snap-x-carousel flex gap-3.5 overflow-x-auto scroll-px-1 pb-2 sm:gap-4"
        role="list"
        aria-label="Lista de canais — deslize para o lado"
      >
        {channels.map((channel, index) => (
          <div role="listitem" key={channel.id} className="contents">
            <ChannelCard
              channel={channel}
              size={size}
              priority={index}
              group={group}
              nowPlayingTitle={nowPlayingByChannel?.[channel.id]}
              href={hrefFor?.(channel)}
            />
          </div>
        ))}
      </div>

      {!edges.end ? <RailArrow side="right" onClick={() => scrollByPage(1)} /> : null}
    </div>
  );
}

function RailArrow({ side, onClick }: { side: "left" | "right"; onClick: () => void }) {
  return (
    <motion.button
      type="button"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      onClick={onClick}
      aria-label={side === "left" ? "Rolar canais para a esquerda" : "Rolar canais para a direita"}
      className={cn(
        "focusable absolute top-1/2 z-20 hidden -translate-y-1/2 items-center justify-center",
        "size-11 rounded-full border border-white/14 bg-black/62 text-white backdrop-blur-xl",
        "transition hover:border-white/40 hover:bg-black/80 lg:flex",
        side === "left" ? "-left-5" : "-right-5",
      )}
    >
      {side === "left" ? (
        <ChevronLeft className="size-5" aria-hidden />
      ) : (
        <ChevronRight className="size-5" aria-hidden />
      )}
    </motion.button>
  );
}

export const ChannelRail = memo(ChannelRailComponent);
