"use client";

import { memo, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { Info, Play, Sparkles } from "lucide-react";

import { QualityBadge } from "@/components/ui/primitives";
import { useFocusable } from "@/hooks/use-spatial-navigation";
import type { Channel, Program } from "@/lib/types";
import { cn, formatDuration, formatTime } from "@/lib/utils";

export interface HeroSlide {
  channel: Channel;
  program?: Program | null;
  tagline?: string;
}

interface HeroBillboardProps {
  slides: HeroSlide[];
  /** Rotação automática em ms. 0 desativa. */
  intervalMs?: number;
}

function HeroSlideView({
  slide,
  index,
  active,
}: {
  slide: HeroSlide;
  index: number;
  active: boolean;
}) {
  const { channel, program, tagline } = slide;
  const { ref, focused, tabIndex } = useFocusable<HTMLAnchorElement>({
    group: "destaque",
    priority: index,
  });
  const [imageFailed, setImageFailed] = useState(false);

  return (
    <div className="relative aspect-[16/10] w-full overflow-hidden rounded-[30px] sm:aspect-[21/9]">
      <AnimatePresence mode="sync">
        {active ? (
          <motion.div
            key={channel.id}
            initial={{ opacity: 0, scale: 1.06 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.02 }}
            transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
            className="absolute inset-0"
          >
            {!imageFailed && channel.backdrop ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={channel.backdrop}
                alt=""
                fetchPriority="high"
                decoding="async"
                onError={() => setImageFailed(true)}
                className="size-full object-cover"
              />
            ) : (
              <div className="size-full bg-gradient-to-br from-zuca-slate via-zuca-abyss to-black" />
            )}
          </motion.div>
        ) : null}
      </AnimatePresence>

      <div className="absolute inset-0 bg-gradient-to-tr from-black/94 via-black/58 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/92 via-transparent to-black/25" />
      <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-zuca-void to-transparent" />

      <div className="absolute inset-x-0 bottom-0 flex flex-col gap-4 p-5 sm:p-8 lg:p-11">
        <AnimatePresence mode="wait">
          {active ? (
            <motion.div
              key={`meta-${channel.id}`}
              initial={{ opacity: 0, y: 22 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-zuca-brand px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-white">
                  <span className="size-1.5 animate-[live-pulse_1.8s_ease-in-out_infinite] rounded-full bg-white" />
                  No ar
                </span>
                <QualityBadge label={channel.quality} />
                {channel.categoryNames.slice(0, 2).map((name) => (
                  <span
                    key={name}
                    className="rounded-full border border-white/14 bg-white/6 px-2.5 py-1 text-[10.5px] font-medium text-white/62"
                  >
                    {name}
                  </span>
                ))}
              </div>

              <h1 className="mt-3 max-w-3xl text-2xl font-extrabold leading-[1.08] tracking-tight text-white text-balance-pretty sm:text-4xl lg:text-[3.1rem]">
                {channel.name}
              </h1>

              <p className="mt-2 max-w-2xl text-[13.5px] leading-relaxed text-white/62 sm:text-[15px]">
                {program
                  ? `${program.title} · ${formatTime(program.startsAt)} às ${formatTime(program.endsAt)} · ${formatDuration(program.durationMs)}`
                  : (tagline ?? "Transmissão contínua em alta definição.")}
              </p>

              {program?.description ? (
                <p className="mt-2 hidden max-w-xl text-[13px] leading-relaxed text-white/45 sm:line-clamp-2 sm:block">
                  {program.description}
                </p>
              ) : null}

              <div className="mt-5 flex flex-wrap items-center gap-3">
                <Link
                  ref={ref}
                  href={`/assistir/${channel.id}`}
                  tabIndex={tabIndex}
                  data-focus={focused ? "true" : "false"}
                  aria-label={`Assistir ${channel.name} agora`}
                  className={cn(
                    "focusable inline-flex h-12 items-center gap-2.5 rounded-2xl px-6 text-sm font-bold text-white",
                    "bg-gradient-to-br from-zuca-brand via-[#ff4470] to-zuca-violet",
                    "shadow-[0_22px_55px_-20px_rgba(255,46,99,0.95)]",
                  )}
                >
                  <Play className="size-4 fill-white" aria-hidden />
                  Assistir agora
                </Link>
                <Link
                  href={`/guia?canal=${channel.id}`}
                  aria-label={`Ver programação de ${channel.name}`}
                  className="focusable glass inline-flex h-12 items-center gap-2 rounded-2xl px-5 text-sm font-semibold text-white/88 transition hover:text-white"
                >
                  <Info className="size-4" aria-hidden />
                  Programação
                </Link>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>

      <div className="absolute right-5 top-5 hidden items-center gap-1.5 rounded-full border border-white/12 bg-black/45 px-3 py-1.5 text-[11px] font-medium text-white/70 backdrop-blur-xl sm:flex">
        <Sparkles className="size-3.5 text-zuca-accent" aria-hidden />
        Conteúdo 100% familiar
      </div>
    </div>
  );
}

function HeroBillboardComponent({ slides, intervalMs = 9000 }: HeroBillboardProps) {
  const [current, setCurrent] = useState(0);
  const count = slides.length;

  useEffect(() => {
    if (count <= 1 || intervalMs <= 0) return;
    const timer = setInterval(() => {
      setCurrent((index) => (index + 1) % count);
    }, intervalMs);
    return () => clearInterval(timer);
  }, [count, intervalMs]);

  const visibleSlide = useMemo(() => slides[current], [current, slides]);
  if (!visibleSlide) return null;

  return (
    <section aria-label="Destaque em cartaz" className="relative">
      <HeroSlideView slide={visibleSlide} index={current} active />

      {count > 1 ? (
        <div className="absolute bottom-5 right-5 z-10 flex items-center gap-1.5">
          {slides.map((slide, index) => (
            <button
              key={slide.channel.id}
              type="button"
              onClick={() => setCurrent(index)}
              aria-label={`Ir para o destaque ${index + 1}: ${slide.channel.name}`}
              aria-current={index === current}
              className={cn(
                "h-1.5 rounded-full transition-all duration-500",
                index === current ? "w-7 bg-white" : "w-1.5 bg-white/32 hover:bg-white/60",
              )}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}

export const HeroBillboard = memo(HeroBillboardComponent);
