import {
  isBlockedCategory,
  isSafeChannel,
  isSafeEvent,
  isSafeProgram,
  SAFE_PROGRAM_DESCRIPTION,
  SAFE_PROGRAM_TITLE,
} from "@/lib/content-filter";
import type {
  Channel,
  ChannelGroup,
  EpgChannelRow,
  LiveEvent,
  Program,
  ProviderChannelsResponse,
  ProviderEpgEntry,
  ProviderEvent,
  ResolvedStream,
} from "@/lib/types";
import { snapToHour } from "@/lib/utils";

const PROVIDER_BASE = process.env.ZUCA_PROVIDER_BASE ?? "https://embedtv.cc";

/** Fallback manifest used when a provider embed page cannot be scraped. */
const FALLBACK_HLS = process.env.ZUCA_FALLBACK_HLS ?? "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8";

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

/* ------------------------------------------------------------------ */
/*  Cache                                                              */
/* ------------------------------------------------------------------ */

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

const memoryCache = new Map<string, CacheEntry<unknown>>();

function readCache<T>(key: string): T | null {
  const entry = memoryCache.get(key) as CacheEntry<T> | undefined;
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) {
    memoryCache.delete(key);
    return null;
  }
  return entry.value;
}

function writeCache<T>(key: string, value: T, ttlMs: number): T {
  memoryCache.set(key, { value, expiresAt: Date.now() + ttlMs });
  return value;
}

const TTL = {
  channels: 10 * 60 * 1000,
  events: 2 * 60 * 1000,
  epg: 15 * 60 * 1000,
  stream: 30 * 60 * 1000,
} as const;

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${PROVIDER_BASE}${path}`, {
    ...init,
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });
  if (!response.ok) {
    throw new ProviderError(
      `Falha ao consultar ${path} (HTTP ${response.status})`,
      response.status,
    );
  }
  return (await response.json()) as T;
}

export class ProviderError extends Error {
  readonly status: number;
  constructor(message: string, status = 502) {
    super(message);
    this.name = "ProviderError";
    this.status = status;
  }
}

/* ------------------------------------------------------------------ */
/*  Channels                                                           */
/* ------------------------------------------------------------------ */

function deriveQuality(id: string, name: string): Channel["quality"] {
  const haystack = `${id} ${name}`.toLowerCase();
  if (haystack.includes("4k") || haystack.includes("uhd")) return "4K";
  if (haystack.includes("sd") || haystack.includes("alt")) return "SD";
  return "HD";
}

function normalizeChannel(
  raw: ProviderChannelsResponse["channels"][number],
  categories: ProviderChannelsResponse["categories"],
): Channel {
  const categoryNames = raw.categories
    .map((id) => categories.find((category) => category.id === id)?.name)
    .filter((name): name is string => Boolean(name) && name !== "Todos");

  return {
    id: raw.id,
    name: raw.name,
    logo: raw.image,
    backdrop: raw.preview || raw.image,
    embedUrl: raw.url,
    categories: raw.categories,
    categoryNames,
    quality: deriveQuality(raw.id, raw.name),
  };
}

/**
 * Fetches the provider catalog and applies the strict SFW gate at fetch level.
 * Blocked channels are dropped before anything reaches the client.
 */
export async function getChannelGroup(): Promise<ChannelGroup> {
  const cached = readCache<ChannelGroup>("channels");
  if (cached) return cached;

  const payload = await fetchJson<ProviderChannelsResponse>("/api/channels");

  const allCategories = payload.categories ?? [];
  const blockedCategoryIds = new Set(
    allCategories.filter((category) => isBlockedCategory(category.name)).map((category) => category.id),
  );
  const safeCategories = allCategories.filter(
    (category) => !blockedCategoryIds.has(category.id),
  );
  const safeCategoryIds = new Set(safeCategories.map((category) => category.id));

  const safeChannels = (payload.channels ?? [])
    // Pass 1 — identifier / name / url blocklist.
    .filter((channel) => isSafeChannel(channel))
    // Pass 2 — taxonomy blocklist.
    .filter((channel) => !channel.categories.some((id) => blockedCategoryIds.has(id)))
    .map((channel) =>
      normalizeChannel(
        {
          ...channel,
          categories: channel.categories.filter((id) => safeCategoryIds.has(id)),
        },
        safeCategories,
      ),
    )
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));

  return writeCache<ChannelGroup>("channels", {
    categories: safeCategories,
    channels: safeChannels,
  }, TTL.channels);
}

export async function getChannelById(id: string): Promise<Channel | null> {
  const { channels } = await getChannelGroup();
  return channels.find((channel) => channel.id === id) ?? null;
}

/* ------------------------------------------------------------------ */
/*  Stream resolution (embed page -> HLS manifest)                     */
/* ------------------------------------------------------------------ */

const HLS_PATTERNS = [
  /const\s+src\s*=\s*["']([^"']+\.m3u8[^"']*)["']/i,
  /["'](https?:\/\/[^"']+\.m3u8[^"']*)["']/i,
  /source\s*[:=]\s*["']([^"']+\.m3u8[^"']*)["']/i,
];

/**
 * Scrapes the provider embed page for the real HLS manifest. Results are
 * memoized; on any failure we degrade to the fallback manifest so the player
 * never shows a dead end.
 */
export async function resolveStream(channelId: string): Promise<ResolvedStream> {
  const cacheKey = `stream:${channelId}`;
  const cached = readCache<ResolvedStream>(cacheKey);
  if (cached) return cached;

  const channel = await getChannelById(channelId);
  if (!channel) {
    throw new ProviderError(`Canal "${channelId}" não encontrado no catálogo.`, 404);
  }

  let source = FALLBACK_HLS;

  try {
    const html = await fetch(channel.embedUrl, {
      headers: { "User-Agent": USER_AGENT, Referer: PROVIDER_BASE },
      cache: "no-store",
    });
    if (html.ok) {
      const markup = await html.text();
      for (const pattern of HLS_PATTERNS) {
        const match = markup.match(pattern);
        if (match?.[1]) {
          source = match[1].startsWith("//") ? `https:${match[1]}` : match[1];
          break;
        }
      }
    }
  } catch {
    source = FALLBACK_HLS;
  }

  const resolved: ResolvedStream = {
    channelId: channel.id,
    channelName: channel.name,
    logo: channel.logo,
    backdrop: channel.backdrop,
    source,
    kind: source.endsWith(".m3u8") || source.includes(".m3u8") ? "hls" : "embed",
  };

  return writeCache<ResolvedStream>(cacheKey, resolved, TTL.stream);
}

/* ------------------------------------------------------------------ */
/*  Live events                                                        */
/* ------------------------------------------------------------------ */

function channelIdFromPlayerUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.pathname.replace(/^\/+|\/+$/g, "");
  } catch {
    return url.split("/").pop() ?? "";
  }
}

function eventStatus(startsAt: string, endsAt: string): LiveEvent["status"] {
  const now = Date.now();
  const start = new Date(startsAt).getTime();
  const end = new Date(endsAt).getTime();
  if (Number.isNaN(start) || Number.isNaN(end)) return "agendado";
  if (now < start) return "agendado";
  if (now > end) return "encerrado";
  return "ao-vivo";
}

/** Fetches sports/live events, SFW-filtered and normalized. */
export async function getLiveEvents(): Promise<LiveEvent[]> {
  const cached = readCache<LiveEvent[]>("events");
  if (cached) return cached;

  const payload = await fetchJson<ProviderEvent[]>("/api/events");

  const events = (Array.isArray(payload) ? payload : [])
    .filter((event) =>
      isSafeEvent({
        slug: event.slug,
        title: event.title,
        leagueName: event.league?.name,
        homeName: event.teams?.home?.name,
        awayName: event.teams?.away?.name,
      }),
    )
    .map((event): LiveEvent => {
      return {
        id: event.id,
        slug: event.slug,
        title: event.title,
        leagueName: event.league?.name ?? "Evento ao vivo",
        leagueLogo: event.league?.image ?? "",
        homeName: event.teams?.home?.name ?? "",
        homeLogo: event.teams?.home?.image ?? "",
        awayName: event.teams?.away?.name ?? "",
        awayLogo: event.teams?.away?.image ?? "",
        startsAt: event.time_start,
        endsAt: event.time_end,
        playerUrls: (event.players ?? []).map((url) => url),
        channelIds: (event.players ?? [])
          .map(channelIdFromPlayerUrl)
          .filter(Boolean),
        status: eventStatus(event.time_start, event.time_end),
      };
    })
    // Pass 3 — every transmission feed attached to the event must be safe.
    .filter((event) =>
      event.playerUrls.every((url) =>
        isSafeChannel({ url: channelIdFromPlayerUrl(url) }),
      ),
    )
    .sort(
      (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
    );

  return writeCache<LiveEvent[]>("events", events, TTL.events);
}

/* ------------------------------------------------------------------ */
/*  EPG                                                                */
/* ------------------------------------------------------------------ */

interface RawProgram {
  title: string;
  desc: string;
  start_date: string;
}

function toPrograms(channelId: string, rawList: RawProgram[]): Program[] {
  const now = Date.now();
  const sorted = [...rawList].sort(
    (a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime(),
  );

  return sorted.map((raw, index) => {
    const safe = isSafeProgram({ title: raw.title, desc: raw.desc });
    const startsAt = new Date(raw.start_date).getTime();
    const next = sorted[index + 1];
    const endsAt = next
      ? new Date(next.start_date).getTime()
      : startsAt + 60 * 60 * 1000;

    const progress =
      now >= startsAt && now <= endsAt ? (now - startsAt) / Math.max(1, endsAt - startsAt) : now > endsAt ? 1 : 0;

    return {
      channelId,
      title: safe ? raw.title : SAFE_PROGRAM_TITLE,
      description: safe ? raw.desc || "Sem sinopse disponível." : SAFE_PROGRAM_DESCRIPTION,
      startsAt,
      endsAt,
      durationMs: Math.max(60_000, endsAt - startsAt),
      progress,
      isNow: progress > 0 && progress < 1,
      isCatchup: endsAt < now,
    };
  });
}

/**
 * Full EPG. Returns only rows for channels that survived the SFW gate.
 * `windowHours` limits the timeline span returned to the client (Smart TVs
 * have limited memory) — defaults to a 24h window centered on "now".
 */
export async function getEpgRows(options?: {
  onlyChannelIds?: string[];
  windowHours?: number;
}): Promise<EpgChannelRow[]> {
  const cacheKey = `epg:${options?.onlyChannelIds?.join(",") ?? "all"}:${options?.windowHours ?? 24}`;
  const cached = readCache<EpgChannelRow[]>(cacheKey);
  if (cached) return cached;

  const [{ channels }, payload] = await Promise.all([
    getChannelGroup(),
    fetchJson<ProviderEpgEntry[]>("/api/epg_all"),
  ]);

  const channelById = new Map(channels.map((channel) => [channel.id, channel]));
  const wanted = options?.onlyChannelIds
    ? new Set(options.onlyChannelIds)
    : null;

  const windowHours = options?.windowHours ?? 24;
  const windowStart = snapToHour(Date.now() - windowHours / 2, 1);
  const windowEnd = windowStart + windowHours * 60 * 60 * 1000;

  const rows: EpgChannelRow[] = (Array.isArray(payload) ? payload : [])
    .filter((entry) => channelById.has(entry.id))
    .filter((entry) => (wanted ? wanted.has(entry.id) : true))
    .map((entry) => {
      const channel = channelById.get(entry.id) as Channel;
      const programs = toPrograms(entry.id, entry.data ?? []).filter(
        (program) => program.endsAt > windowStart && program.startsAt < windowEnd,
      );
      return { channel, programs };
    })
    .filter((row) => row.programs.length > 0)
    .sort((a, b) => a.channel.name.localeCompare(b.channel.name, "pt-BR"));

  return writeCache<EpgChannelRow[]>(cacheKey, rows, TTL.epg);
}

/** The single "now playing" program for a channel, if any. */
export async function getNowPlaying(channelId: string): Promise<Program | null> {
  const rows = await getEpgRows({ onlyChannelIds: [channelId], windowHours: 6 });
  const row = rows.find((entry) => entry.channel.id === channelId);
  if (!row) return null;
  const now = Date.now();
  return (
    row.programs.find((program) => program.startsAt <= now && program.endsAt > now) ??
    row.programs[row.programs.length - 1] ??
    null
  );
}

/** Upcoming programs for the Interactive Live side-panel. */
export async function getUpNext(channelId: string, limit = 6): Promise<Program[]> {
  const rows = await getEpgRows({ onlyChannelIds: [channelId], windowHours: 12 });
  const row = rows.find((entry) => entry.channel.id === channelId);
  if (!row) return [];
  const now = Date.now();
  return row.programs.filter((program) => program.startsAt > now).slice(0, limit);
}
