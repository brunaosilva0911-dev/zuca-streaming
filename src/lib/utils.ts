import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Tailwind-aware className combiner. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

const TIME_FMT = new Intl.DateTimeFormat("pt-BR", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Sao_Paulo",
});

const DAY_FMT = new Intl.DateTimeFormat("pt-BR", {
  weekday: "short",
  day: "2-digit",
  month: "2-digit",
  timeZone: "America/Sao_Paulo",
});

const FULL_FMT = new Intl.DateTimeFormat("pt-BR", {
  weekday: "long",
  day: "2-digit",
  month: "long",
  year: "numeric",
  timeZone: "America/Sao_Paulo",
});

const REL_FMT = new Intl.RelativeTimeFormat("pt-BR", { numeric: "auto" });

export function formatTime(value: number | string | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "--:--";
  return TIME_FMT.format(date);
}

export function formatDay(value: number | string | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  return DAY_FMT.format(date);
}

function toDate(value: number | string | Date): Date {
  return value instanceof Date ? value : new Date(value);
}

export function formatFullDate(value: number | string | Date): string {
  const parsed = toDate(value);
  if (Number.isNaN(parsed.getTime())) return "--";
  return FULL_FMT.format(parsed);
}

/** "agora", "em 12 min", "há 2 h" — always pt-BR. */
export function formatRelative(value: number | string | Date): string {
  const target = toDate(value).getTime();
  if (Number.isNaN(target)) return "--";
  const diffSeconds = Math.round((target - Date.now()) / 1000);
  const abs = Math.abs(diffSeconds);
  if (abs < 45) return "agora";
  if (abs < 3600) return REL_FMT.format(Math.round(diffSeconds / 60), "minute");
  if (abs < 86400) return REL_FMT.format(Math.round(diffSeconds / 3600), "hour");
  return REL_FMT.format(Math.round(diffSeconds / 86400), "day");
}

export function formatDuration(ms: number): string {
  const totalMinutes = Math.max(0, Math.round(ms / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours <= 0) return `${minutes} min`;
  return `${hours}h ${String(minutes).padStart(2, "0")}min`;
}

export function formatClock(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "00:00";
  const total = Math.floor(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) {
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/** Brazil timezone hour boundary (ms) used by the EPG grid ruler. */
export const EPG_HOUR_MS = 60 * 60 * 1000;
export const EPG_PIXELS_PER_HOUR = 320;

export function pxPerMs(): number {
  return EPG_PIXELS_PER_HOUR / EPG_HOUR_MS;
}

export function msToPx(ms: number): number {
  return ms * pxPerMs();
}

export function pxToMs(px: number): number {
  return px / pxPerMs();
}

export function snapToHour(timestamp: number, hours = 1): number {
  const step = hours * EPG_HOUR_MS;
  return Math.floor(timestamp / step) * step;
}

/** Deterministic avatar gradient from a string seed. */
export function avatarGradient(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) % 360;
  }
  const hue = Math.abs(hash);
  return `linear-gradient(135deg, hsl(${hue} 88% 62%), hsl(${(hue + 62) % 360} 90% 48%))`;
}

export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "Z";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
