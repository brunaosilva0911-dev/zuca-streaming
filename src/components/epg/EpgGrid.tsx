"use client";

import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import {
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  History,
  Play,
  RotateCcw,
} from "lucide-react";

import { useFocusable } from "@/hooks/use-spatial-navigation";
import { useHorizontalSwipe } from "@/hooks/use-gestures";
import { EPG_HOUR_MS, EPG_PIXELS_PER_HOUR, cn, formatDuration, formatTime, msToPx, pxToMs, snapToHour } from "@/lib/utils";
import type { EpgChannelRow, Program } from "@/lib/types";

const ROW_HEIGHT = 78;
const ROW_GAP = 8;
const ROW_STEP = ROW_HEIGHT + ROW_GAP;
const OVERSCAN_ROWS = 4;
const CHANNEL_COLUMN_WIDTH = 172;

interface EpgGridProps {
  rows: EpgChannelRow[];
  windowStart: number;
  windowEnd: number;
  now: number;
  offsetHours: number;
  onOffsetChange: (offsetHours: number) => void;
  focusChannelId?: string | null;
  loading?: boolean;
}

/* ------------------------------------------------------------------ */
/*  Régua de tempo                                                     */
/* ------------------------------------------------------------------ */

const TimeRuler = memo(function TimeRuler({
  windowStart,
  windowEnd,
  now,
}: {
  windowStart: number;
  windowEnd: number;
  now: number;
}) {
  const ticks = useMemo(() => {
    const result: number[] = [];
    const start = snapToHour(windowStart, 1);
    for (let time = start; time <= windowEnd; time += EPG_HOUR_MS) {
      result.push(time);
    }
    return result;
  }, [windowEnd, windowStart]);

  const nowOffset = now - windowStart;
  const showNowLine = nowOffset >= 0 && nowOffset <= windowEnd - windowStart;

  return (
    <div
      className="relative h-12 shrink-0 overflow-hidden border-b border-white/8 bg-black/35"
      style={{ width: msToPx(windowEnd - windowStart) }}
      aria-hidden
    >
      {ticks.map((tick) => {
        const left = msToPx(tick - windowStart);
        const isHalf = false;
        return (
          <div
            key={tick}
            className="absolute top-0 flex h-full items-center gap-2 border-l border-white/10 pl-2"
            style={{ left, width: msToPx(EPG_HOUR_MS) }}
          >
            <span
              className={cn(
                "font-mono text-[11.5px] font-semibold",
                isHalf ? "text-white/32" : "text-white/58",
              )}
            >
              {formatTime(tick)}
            </span>
          </div>
        );
      })}

      {showNowLine ? (
        <div
          className="absolute top-0 h-full w-px bg-zuca-brand shadow-[0_0_14px_2px_rgba(255,46,99,0.75)]"
          style={{ left: msToPx(nowOffset) }}
        >
          <span className="absolute -top-0.5 -left-[3px] size-[7px] rounded-full bg-zuca-brand" />
        </div>
      ) : null}
    </div>
  );
});

/* ------------------------------------------------------------------ */
/*  Célula de programa                                                 */
/* ------------------------------------------------------------------ */

const ProgramCell = memo(function ProgramCell({
  program,
  left,
  width,
  priority,
}: {
  program: Program;
  left: number;
  width: number;
  priority: number;
}) {
  const { ref, focused, tabIndex } = useFocusable<HTMLAnchorElement>({
    group: `epg-${program.channelId}`,
    priority,
  });

  const progressWidth = Math.min(100, Math.max(0, program.progress * 100));

  return (
    <Link
      ref={ref}
      href={`/assistir/${program.channelId}`}
      tabIndex={tabIndex}
      data-focus={focused ? "true" : "false"}
      aria-label={`${program.title}, ${formatTime(program.startsAt)} às ${formatTime(program.endsAt)}, ${
        program.isCatchup ? "já exibido — assistir do início" : program.isNow ? "no ar agora" : "programado"
      }`}
      className="focusable absolute top-0 block h-full"
      style={{ left, width: Math.max(84, width) }}
    >
      <div
        className={cn(
          "relative flex h-full flex-col justify-center overflow-hidden rounded-2xl border px-3.5 py-2 transition-colors",
          program.isNow
            ? "border-zuca-brand/45 bg-gradient-to-br from-zuca-brand/22 to-zuca-violet/14"
            : program.isCatchup
              ? "border-white/8 bg-white/4 hover:bg-white/8"
              : "border-white/8 bg-white/6 hover:bg-white/10",
        )}
      >
        <span className="flex items-center gap-1.5">
          {program.isNow ? (
            <span className="size-1.5 shrink-0 animate-[live-pulse_1.8s_ease-in-out_infinite] rounded-full bg-zuca-brand" />
          ) : null}
          {program.isCatchup ? (
            <History className="size-3 shrink-0 text-white/35" aria-hidden />
          ) : null}
          <span className="truncate text-[12.5px] font-bold leading-tight text-white/92">
            {program.title}
          </span>
        </span>
        <span className="mt-0.5 flex items-center gap-1.5 font-mono text-[10.5px] text-white/42">
          {formatTime(program.startsAt)}
          <span className="text-white/22">·</span>
          {formatDuration(program.durationMs)}
        </span>

        {program.isNow ? (
          <span className="absolute inset-x-0 bottom-0 h-[3px] bg-white/10">
            <span
              className="block h-full bg-gradient-to-r from-zuca-brand to-zuca-accent"
              style={{ width: `${progressWidth}%` }}
            />
          </span>
        ) : null}
      </div>
    </Link>
  );
});

/* ------------------------------------------------------------------ */
/*  Coluna de canais (sincronizada verticalmente)                      */
/* ------------------------------------------------------------------ */

const ChannelColumn = memo(function ChannelColumn({
  rows,
  scrollTop,
  viewportHeight,
  focusChannelId,
}: {
  rows: EpgChannelRow[];
  scrollTop: number;
  viewportHeight: number;
  focusChannelId?: string | null;
}) {
  const visible = useVisibleRange(rows.length, scrollTop, viewportHeight);

  return (
    <div
      className="relative shrink-0 overflow-hidden border-r border-white/8 bg-black/45"
      style={{ width: CHANNEL_COLUMN_WIDTH }}
      aria-hidden
    >
      <div className="relative" style={{ height: rows.length * ROW_STEP }}>
        {visible.map((index) => {
          const row = rows[index];
          if (!row) return null;
          const isFocused = focusChannelId === row.channel.id;
          return (
            <div
              key={row.channel.id}
              className={cn(
                "absolute left-0 flex w-full items-center gap-2.5 px-3",
                isFocused && "bg-zuca-brand/12",
              )}
              style={{ top: index * ROW_STEP, height: ROW_HEIGHT }}
            >
              <span className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white/8 ring-1 ring-white/10">
                {row.channel.logo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={row.channel.logo}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    className="max-h-8 max-w-8 object-contain"
                  />
                ) : (
                  <span className="font-display text-[10px] font-bold text-white/45">
                    {row.channel.name.slice(0, 3).toUpperCase()}
                  </span>
                )}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-[12.5px] font-bold text-white/88">
                  {row.channel.name}
                </span>
                <span className="block truncate text-[10.5px] text-white/38">
                  {row.channel.categoryNames[0] ?? "Ao vivo"}
                </span>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
});

/* ------------------------------------------------------------------ */
/*  Virtualização                                                      */
/* ------------------------------------------------------------------ */

function useVisibleRange(total: number, scrollTop: number, viewportHeight: number) {
  return useMemo(() => {
    if (total === 0 || viewportHeight === 0) return [] as number[];
    const first = Math.max(0, Math.floor(scrollTop / ROW_STEP) - OVERSCAN_ROWS);
    const last = Math.min(
      total - 1,
      Math.ceil((scrollTop + viewportHeight) / ROW_STEP) + OVERSCAN_ROWS,
    );
    const range: number[] = [];
    for (let index = first; index <= last; index += 1) range.push(index);
    return range;
  }, [scrollTop, total, viewportHeight]);
}

/* ------------------------------------------------------------------ */
/*  Grade                                                              */
/* ------------------------------------------------------------------ */

function EpgGridComponent({
  rows,
  windowStart,
  windowEnd,
  now,
  offsetHours,
  onOffsetChange,
  focusChannelId,
  loading = false,
}: EpgGridProps) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const timelineRef = useRef<HTMLDivElement | null>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(600);
  const rafPending = useRef(false);

  const totalWidth = msToPx(windowEnd - windowStart);

  const measure = useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    setViewportHeight(viewport.clientHeight);
    setScrollTop(viewport.scrollTop);
  }, []);

  useLayoutEffect(() => {
    measure();
    const observer = new ResizeObserver(() => measure());
    if (viewportRef.current) observer.observe(viewportRef.current);
    return () => observer.disconnect();
  }, [measure]);

  const handleScroll = useCallback(() => {
    if (rafPending.current) return;
    rafPending.current = true;
    requestAnimationFrame(() => {
      rafPending.current = false;
      const viewport = viewportRef.current;
      if (!viewport) return;
      setScrollTop(viewport.scrollTop);
    });
  }, []);

  /* Centraliza na linha "agora" ao montar / trocar o deslocamento. */
  useEffect(() => {
    const timeline = timelineRef.current;
    if (!timeline) return;
    const target = msToPx(now - windowStart) - timeline.clientWidth * 0.32;
    timeline.scrollTo({ left: Math.max(0, target), behavior: "smooth" });
  }, [now, windowStart]);

  const shiftBy = useCallback(
    (hours: number) => {
      const next = Math.min(72, Math.max(-168, offsetHours + hours));
      onOffsetChange(Math.round(next));
    },
    [offsetHours, onOffsetChange],
  );

  useHorizontalSwipe(viewportRef, {
    onSwipe: (direction) => shiftBy(direction === "left" ? 2 : -2),
    threshold: 56,
  });

  /* Roda do mouse: shift+wheel ou wheel vertical desloca o tempo. */
  useEffect(() => {
    const timeline = timelineRef.current;
    if (!timeline) return;
    function onWheel(event: WheelEvent) {
      if (!timeline) return;
      if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;
      if (event.shiftKey) {
        event.preventDefault();
        timeline.scrollLeft += event.deltaY;
      }
    }
    timeline.addEventListener("wheel", onWheel, { passive: false });
    return () => timeline.removeEventListener("wheel", onWheel);
  }, []);

  const visibleRows = useVisibleRange(rows.length, scrollTop, viewportHeight);

  return (
    <div className="flex flex-col gap-3">
      {/* Barra de viagem no tempo */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <TimeTravelButton label="Voltar 6 horas" onClick={() => shiftBy(-6)}>
            <ChevronLeft className="size-4" aria-hidden />
            <span className="font-mono text-[11.5px]">6h</span>
          </TimeTravelButton>
          <TimeTravelButton label="Voltar 1 hora" onClick={() => shiftBy(-1)}>
            <ChevronLeft className="size-4" aria-hidden />
            <span className="font-mono text-[11.5px]">1h</span>
          </TimeTravelButton>
          <TimeTravelButton label="Avançar 1 hora" onClick={() => shiftBy(1)}>
            <span className="font-mono text-[11.5px]">1h</span>
            <ChevronRight className="size-4" aria-hidden />
          </TimeTravelButton>
          <TimeTravelButton label="Avançar 6 horas" onClick={() => shiftBy(6)}>
            <span className="font-mono text-[11.5px]">6h</span>
            <ChevronRight className="size-4" aria-hidden />
          </TimeTravelButton>
        </div>

        <div className="flex items-center gap-3">
          <span
            className={cn(
              "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 font-mono text-[11.5px]",
              offsetHours === 0
                ? "border-zuca-accent/35 bg-zuca-accent/10 text-zuca-accent"
                : "border-zuca-gold/35 bg-zuca-gold/10 text-zuca-gold",
            )}
            role="status"
            aria-live="polite"
          >
            <CalendarClock className="size-3.5" aria-hidden />
            {offsetHours === 0
              ? `Tempo real · ${formatTime(now)}`
              : `${offsetHours > 0 ? "À frente" : "No passado"} ${Math.abs(offsetHours)}h · ${formatTime(now)}`}
          </span>
          <TimeTravelButton
            label="Voltar para o tempo real"
            onClick={() => onOffsetChange(0)}
            disabled={offsetHours === 0}
          >
            <RotateCcw className="size-4" aria-hidden />
            <span className="text-[11.5px] font-semibold">Agora</span>
          </TimeTravelButton>
        </div>
      </div>

      {/* Grade */}
      <div className="glass relative overflow-hidden rounded-3xl">
        <div className="flex">
          {/* Cabeçalho da coluna de canais */}
          <div
            className="flex h-12 shrink-0 items-center border-b border-r border-white/8 bg-black/45 px-3"
            style={{ width: CHANNEL_COLUMN_WIDTH }}
          >
            <span className="text-[10.5px] font-bold uppercase tracking-[0.2em] text-white/42">
              {rows.length} canais
            </span>
          </div>

          <div className="no-scrollbar min-w-0 flex-1 overflow-x-auto" ref={timelineRef}>
            <TimeRuler windowStart={windowStart} windowEnd={windowEnd} now={now} />
          </div>
        </div>

        <div className="flex">
          <div className="no-scrollbar shrink-0 overflow-hidden" style={{ width: CHANNEL_COLUMN_WIDTH }}>
            <div style={{ transform: `translateY(${-scrollTop}px)` }}>
              <ChannelColumn
                rows={rows}
                scrollTop={scrollTop}
                viewportHeight={viewportHeight}
                focusChannelId={focusChannelId}
              />
            </div>
          </div>

          <div
            ref={viewportRef}
            onScroll={handleScroll}
            className="thin-scrollbar relative max-h-[62dvh] min-h-[46dvh] flex-1 overflow-y-auto overflow-x-hidden"
            role="grid"
            aria-label="Grade de programação — use as setas para navegar"
            tabIndex={-1}
          >
            {loading ? (
              <div className="flex flex-col gap-2 p-3">
                {Array.from({ length: 6 }).map((_, index) => (
                  <div key={index} className="skeleton h-[78px] w-full rounded-2xl" />
                ))}
              </div>
            ) : (
              <div className="relative" style={{ height: Math.max(0, rows.length * ROW_STEP), width: totalWidth }}>
                {/* Linha do "agora" sobre todas as linhas */}
                {now >= windowStart && now <= windowEnd ? (
                  <div
                    className="pointer-events-none absolute top-0 z-20 h-full w-px bg-zuca-brand/70 shadow-[0_0_14px_2px_rgba(255,46,99,0.5)]"
                    style={{ left: msToPx(now - windowStart) }}
                  />
                ) : null}

                {visibleRows.map((index) => {
                  const row = rows[index];
                  if (!row) return null;
                  return (
                    <div
                      key={row.channel.id}
                      className="absolute left-0 w-full"
                      style={{ top: index * ROW_STEP, height: ROW_HEIGHT }}
                      role="row"
                    >
                      {row.programs.map((program, programIndex) => {
                        const left = msToPx(program.startsAt - windowStart);
                        if (left > totalWidth) return null;
                        const width = msToPx(program.endsAt - program.startsAt) - 6;
                        if (left + width < 0) return null;
                        return (
                          <ProgramCell
                            key={`${program.channelId}-${program.startsAt}`}
                            program={program}
                            left={left}
                            width={width}
                            priority={programIndex}
                          />
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <AnimatePresence>
          {loading ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="pointer-events-none absolute inset-x-0 top-0 z-30 h-0.5 overflow-hidden"
            >
              <motion.div
                className="h-full w-1/3 bg-gradient-to-r from-transparent via-zuca-brand to-transparent"
                animate={{ x: ["-100%", "400%"] }}
                transition={{ duration: 1.4, repeat: Infinity, ease: "linear" }}
              />
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>

      <p className="flex items-center gap-2 text-[11.5px] text-white/38">
        <Play className="size-3.5" aria-hidden />
        Selecione um programa para sintonizar o canal. Em telas de toque, deslize
        horizontalmente para viajar no tempo ({Math.round(pxToMs(EPG_PIXELS_PER_HOUR) / EPG_HOUR_MS)}h por página).
      </p>
    </div>
  );
}

function TimeTravelButton({
  children,
  label,
  onClick,
  disabled = false,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={cn(
        "focusable inline-flex h-9 items-center gap-1.5 rounded-xl border px-3 transition",
        disabled
          ? "cursor-not-allowed border-white/8 bg-white/3 text-white/25"
          : "border-white/12 bg-white/6 text-white/78 hover:border-white/30 hover:text-white",
      )}
    >
      {children}
    </button>
  );
}

export const EpgGrid = memo(EpgGridComponent);
