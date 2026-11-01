"use client";

import { memo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { CalendarClock, Play, Radio } from "lucide-react";

import { useFocusable } from "@/hooks/use-spatial-navigation";
import type { LiveEvent } from "@/lib/types";
import { cn, formatRelative, formatTime } from "@/lib/utils";

function TeamBadge({
  name,
  logo,
  side,
}: {
  name: string;
  logo: string;
  side: "home" | "away";
}) {
  const [failed, setFailed] = useState(false);
  return (
    <div
      className={cn(
        "flex min-w-0 items-center gap-2",
        side === "away" && "flex-row-reverse text-right",
      )}
    >
      <span className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white/8 ring-1 ring-white/10">
        {logo && !failed ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logo}
            alt=""
            loading="lazy"
            decoding="async"
            onError={() => setFailed(true)}
            className="size-6 object-contain"
          />
        ) : (
          <span className="font-display text-[11px] font-bold text-white/45">
            {name.slice(0, 2).toUpperCase()}
          </span>
        )}
      </span>
      <span className="truncate text-[12.5px] font-semibold text-white/82">{name}</span>
    </div>
  );
}

function EventCardComponent({
  event,
  priority,
}: {
  event: LiveEvent;
  priority: number;
}) {
  const { ref, focused, tabIndex } = useFocusable<HTMLAnchorElement>({
    group: "eventos",
    priority,
  });
  const [leagueFailed, setLeagueFailed] = useState(false);

  const primaryChannel = event.channelIds[0];
  const href = primaryChannel ? `/assistir/${primaryChannel}` : `/ao-vivo`;

  const statusConfig = {
    "ao-vivo": {
      label: "Ao vivo",
      className: "bg-zuca-brand text-white",
      dot: true,
    },
    agendado: {
      label: formatRelative(event.startsAt),
      className: "bg-white/10 text-white/70",
      dot: false,
    },
    encerrado: {
      label: "Encerrado",
      className: "bg-white/6 text-white/40",
      dot: false,
    },
  }[event.status];

  return (
    <Link
      ref={ref}
      href={href}
      tabIndex={tabIndex}
      data-focus={focused ? "true" : "false"}
      aria-label={`${event.title} — ${event.leagueName}, ${statusConfig.label}`}
      className="focusable snap-item w-[19rem] shrink-0 sm:w-[22rem]"
    >
      <motion.article
        animate={{ y: focused ? -4 : 0 }}
        transition={{ type: "spring", stiffness: 380, damping: 28 }}
        className={cn(
          "glass relative flex h-full flex-col gap-3 overflow-hidden rounded-3xl p-4",
          event.status === "ao-vivo" && "border-zuca-brand/35",
          event.status === "encerrado" && "opacity-55",
        )}
      >
        {event.status === "ao-vivo" ? (
          <span className="pointer-events-none absolute -right-16 -top-16 size-40 rounded-full bg-zuca-brand/18 blur-3xl" />
        ) : null}

        <div className="relative flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            {event.leagueLogo && !leagueFailed ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={event.leagueLogo}
                alt=""
                loading="lazy"
                decoding="async"
                onError={() => setLeagueFailed(true)}
                className="size-5 shrink-0 object-contain opacity-85"
              />
            ) : null}
            <span className="truncate text-[11.5px] font-semibold uppercase tracking-[0.12em] text-white/48">
              {event.leagueName}
            </span>
          </div>
          <span
            className={cn(
              "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em]",
              statusConfig.className,
            )}
          >
            {statusConfig.dot ? (
              <span className="size-1.5 animate-[live-pulse_1.8s_ease-in-out_infinite] rounded-full bg-white" />
            ) : null}
            {statusConfig.label}
          </span>
        </div>

        <div className="relative flex items-center justify-between gap-3">
          <TeamBadge name={event.homeName} logo={event.homeLogo} side="home" />
          <span className="shrink-0 font-display text-[13px] font-extrabold tracking-widest text-white/35">
            VS
          </span>
          <TeamBadge name={event.awayName} logo={event.awayLogo} side="away" />
        </div>

        <div className="relative mt-auto flex items-center justify-between gap-3 border-t border-white/8 pt-3">
          <span className="inline-flex items-center gap-1.5 font-mono text-[11px] text-white/42">
            <CalendarClock className="size-3.5" aria-hidden />
            {formatTime(event.startsAt)} → {formatTime(event.endsAt)}
          </span>
          <span
            className={cn(
              "inline-flex items-center gap-1.5 text-[12px] font-semibold",
              event.status === "ao-vivo" ? "text-zuca-brand-soft" : "text-white/55",
            )}
          >
            {event.status === "ao-vivo" ? (
              <Play className="size-3.5 fill-current" aria-hidden />
            ) : (
              <Radio className="size-3.5" aria-hidden />
            )}
            {event.status === "ao-vivo" ? "Assistir" : "Ver canal"}
          </span>
        </div>
      </motion.article>
    </Link>
  );
}

export const EventCard = memo(EventCardComponent);

function EventRailComponent({ events }: { events: LiveEvent[] }) {
  if (events.length === 0) return null;
  return (
    <div
      className="no-scrollbar snap-x-carousel -mx-1 flex gap-4 overflow-x-auto px-1 pb-2"
      role="list"
      aria-label="Eventos ao vivo e agendados"
    >
      {events.map((event, index) => (
        <div role="listitem" key={event.id} className="contents">
          <EventCard event={event} priority={index} />
        </div>
      ))}
    </div>
  );
}

export const EventRail = memo(EventRailComponent);
