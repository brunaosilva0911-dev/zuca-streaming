/**
 * ZUCA — Domain model.
 * All interfaces describing the external provider payloads (embedtv.cc)
 * and the normalized shapes consumed by the UI.
 */

export interface ProviderCategory {
  id: number;
  name: string;
}

export interface ProviderChannel {
  id: string;
  name: string;
  image: string;
  preview: string;
  url: string;
  categories: number[];
}

export interface ProviderChannelsResponse {
  categories: ProviderCategory[];
  channels: ProviderChannel[];
}

export interface ProviderEvent {
  id: number;
  slug: string;
  title: string;
  league: { name: string; image: string };
  teams: {
    home: { name: string; image: string };
    away: { name: string; image: string };
  };
  time_start: string;
  time_end: string;
  players: string[];
}

export interface ProviderEpgProgram {
  title: string;
  desc: string;
  start_date: string;
}

export interface ProviderEpgEntry {
  id: string;
  data: ProviderEpgProgram[];
}

/* ---------------- Normalized (app-facing) shapes ---------------- */

export type ChannelStatus = "live" | "offline" | "scheduled";

export interface Channel {
  id: string;
  name: string;
  logo: string;
  backdrop: string;
  embedUrl: string;
  categories: number[];
  categoryNames: string[];
  quality: "HD" | "SD" | "4K";
}

export interface ChannelGroup {
  categories: ProviderCategory[];
  channels: Channel[];
}

export interface LiveEvent {
  id: number;
  slug: string;
  title: string;
  leagueName: string;
  leagueLogo: string;
  homeName: string;
  homeLogo: string;
  awayName: string;
  awayLogo: string;
  startsAt: string;
  endsAt: string;
  playerUrls: string[];
  channelIds: string[];
  status: "agendado" | "ao-vivo" | "encerrado";
}

export interface Program {
  channelId: string;
  title: string;
  description: string;
  startsAt: number;
  endsAt: number;
  durationMs: number;
  progress: number;
  isNow: boolean;
  isCatchup: boolean;
}

export interface EpgChannelRow {
  channel: Channel;
  programs: Program[];
}

export interface ResolvedStream {
  channelId: string;
  channelName: string;
  logo: string;
  backdrop: string;
  /** Direct HLS manifest, ready for hls.js */
  source: string;
  kind: "hls" | "embed";
}

export interface Profile {
  id: string;
  name: string;
  avatarSeed: string;
  pin: string | null;
  isKids: boolean;
  preferredCategories: number[];
  createdAt: string;
}

export interface WatchEntry {
  channelId: string;
  channelName: string;
  logo: string;
  lastWatchedAt: string;
  secondsWatched: number;
}

export interface FavoriteEntry {
  channelId: string;
  channelName: string;
  logo: string;
  addedAt: string;
}

export type ConnectionState = "online" | "offline" | "slow";

export type PlayerPhase =
  | "idle"
  | "loading"
  | "playing"
  | "paused"
  | "buffering"
  | "error"
  | "ended";
