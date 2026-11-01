"use client";

import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import type {
  ChannelGroup,
  EpgChannelRow,
  FavoriteEntry,
  LiveEvent,
  Program,
  Profile,
  ResolvedStream,
  WatchEntry,
} from "@/lib/types";

export class ZucaApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly retryable: boolean;

  constructor(message: string, code: string, status: number, retryable: boolean) {
    super(message);
    this.name = "ZucaApiError";
    this.code = code;
    this.status = status;
    this.retryable = retryable;
  }
}

interface Envelope<T> {
  error: boolean;
  data?: T;
  code?: string;
  message?: string;
  retryable?: boolean;
}

async function apiGet<T>(path: string, signal?: AbortSignal): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, { signal, cache: "no-store" });
  } catch (error) {
    if ((error as Error)?.name === "AbortError") throw error;
    throw new ZucaApiError(
      "Sem conexão com os servidores ZUCA. Verifique sua internet.",
      "REDE_INDISPONIVEL",
      0,
      true,
    );
  }

  let payload: Envelope<T>;
  try {
    payload = (await response.json()) as Envelope<T>;
  } catch {
    throw new ZucaApiError(
      "Resposta inesperada do servidor.",
      "RESPOSTA_INVALIDA",
      response.status,
      true,
    );
  }

  if (!response.ok || payload.error || payload.data === undefined) {
    throw new ZucaApiError(
      payload.message ?? "Não foi possível concluir sua solicitação.",
      payload.code ?? "ERRO_DESCONHECIDO",
      response.status,
      payload.retryable ?? response.status >= 500,
    );
  }

  return payload.data;
}

async function apiSend<T>(
  path: string,
  method: "POST" | "PATCH" | "DELETE",
  body?: unknown,
): Promise<T> {
  const response = await fetch(path, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  const payload = (await response.json().catch(() => null)) as Envelope<T> | null;
  if (!response.ok || !payload || payload.error || payload.data === undefined) {
    throw new ZucaApiError(
      payload?.message ?? "Não foi possível concluir sua solicitação.",
      payload?.code ?? "ERRO_DESCONHECIDO",
      response.status,
      payload?.retryable ?? true,
    );
  }
  return payload.data;
}

export const queryKeys = {
  channels: (params: { q?: string; categoryId?: string }) =>
    ["canais", params.q ?? "", params.categoryId ?? "all"] as const,
  events: (filter: string) => ["eventos", filter] as const,
  epg: (params: { channelIds?: string[]; windowHours: number; offsetHours: number }) =>
    ["epg", params.channelIds?.join(",") ?? "all", params.windowHours, params.offsetHours] as const,
  stream: (channelId: string) => ["stream", channelId] as const,
  profiles: ["perfis"] as const,
  library: (profileId: string | null) => ["biblioteca", profileId ?? "anon"] as const,
} as const;

/* ------------------------- Catálogo ------------------------- */

export interface ChannelsResponse {
  categories: ChannelGroup["categories"];
  channels: ChannelGroup["channels"];
  total: number;
  policy: string;
}

export function useChannels(options: { q?: string; categoryId?: string; enabled?: boolean } = {}) {
  const { q = "", categoryId = "all", enabled = true } = options;
  return useQuery({
    queryKey: queryKeys.channels({ q, categoryId }),
    queryFn: ({ signal }) => {
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      if (categoryId && categoryId !== "all") params.set("categoria", categoryId);
      const suffix = params.toString();
      return apiGet<ChannelsResponse>(`/api/channels${suffix ? `?${suffix}` : ""}`, signal);
    },
    enabled,
    staleTime: 60_000,
    gcTime: 10 * 60_000,
    refetchOnWindowFocus: false,
    placeholderData: keepPreviousData,
    retry: (failureCount, error) =>
      error instanceof ZucaApiError && !error.retryable ? false : failureCount < 2,
    retryDelay: (attempt) => Math.min(4000, 700 * 2 ** attempt),
  });
}

/* ------------------------- Eventos ao vivo ------------------------- */

export interface EventsResponse {
  events: LiveEvent[];
  counts: { live: number; upcoming: number; finished: number; total: number };
}

export function useLiveEvents(filter: "todos" | "ao-vivo" | "agendados" | "encerrados" = "todos") {
  return useQuery({
    queryKey: queryKeys.events(filter),
    queryFn: ({ signal }) =>
      apiGet<EventsResponse>(`/api/events?filtro=${filter}`, signal),
    staleTime: 45_000,
    gcTime: 8 * 60_000,
    refetchInterval: 90_000,
    refetchOnWindowFocus: true,
    retry: (failureCount, error) =>
      error instanceof ZucaApiError && !error.retryable ? false : failureCount < 2,
  });
}

/* ------------------------- EPG ------------------------- */

export interface EpgResponse {
  rows: EpgChannelRow[];
  windowStart: number;
  windowEnd: number;
  now: number;
  offsetHours: number;
  windowHours: number;
  totalChannels: number;
  totalPrograms: number;
}

export function useEpgGuide(options: {
  channelIds?: string[];
  windowHours?: number;
  offsetHours?: number;
  enabled?: boolean;
}) {
  const { channelIds, windowHours = 24, offsetHours = 0, enabled = true } = options;
  return useQuery({
    queryKey: queryKeys.epg({ channelIds, windowHours, offsetHours }),
    queryFn: ({ signal }) => {
      const params = new URLSearchParams();
      if (channelIds && channelIds.length > 0) params.set("canais", channelIds.join(","));
      params.set("janela", String(windowHours));
      params.set("deslocamento", String(offsetHours));
      return apiGet<EpgResponse>(`/api/epg?${params.toString()}`, signal);
    },
    enabled,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    placeholderData: keepPreviousData,
  });
}

/* ------------------------- Stream ------------------------- */

export interface StreamResponse {
  stream: ResolvedStream;
  nowPlaying: Program | null;
  upNext: Program[];
}

export function useChannelStream(channelId: string | null, enabled = true) {
  return useQuery({
    queryKey: queryKeys.stream(channelId ?? "nenhum"),
    queryFn: ({ signal }) =>
      apiGet<StreamResponse>(`/api/streams/${encodeURIComponent(channelId ?? "")}`, signal),
    enabled: enabled && Boolean(channelId),
    staleTime: 5 * 60_000,
    gcTime: 15 * 60_000,
    refetchOnWindowFocus: false,
    retry: (failureCount, error) =>
      error instanceof ZucaApiError && !error.retryable ? false : failureCount < 3,
    retryDelay: (attempt) => Math.min(6000, 900 * 2 ** attempt),
  });
}

/* ------------------------- Perfis ------------------------- */

export function useProfiles() {
  return useQuery({
    queryKey: queryKeys.profiles,
    queryFn: ({ signal }) => apiGet<Profile[]>("/api/profiles", signal),
    staleTime: 2 * 60_000,
    gcTime: 20 * 60_000,
    refetchOnWindowFocus: false,
  });
}

export function useCreateProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { name: string; avatarSeed?: string; isKids?: boolean; pin?: string | null }) =>
      apiSend<Profile>("/api/profiles", "POST", body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.profiles });
    },
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      profileId,
      ...body
    }: {
      profileId: string;
      name?: string;
      avatarSeed?: string;
      pin?: string | null;
      isKids?: boolean;
      preferredCategories?: number[];
    }) =>
      apiSend<Profile>(`/api/profiles/${encodeURIComponent(profileId)}`, "PATCH", body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.profiles });
    },
  });
}

export function useDeleteProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (profileId: string) =>
      apiSend<{ removed: string }>(
        `/api/profiles?id=${encodeURIComponent(profileId)}`,
        "DELETE",
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.profiles });
    },
  });
}

/* ------------------------- Biblioteca ------------------------- */

export interface LibraryResponse {
  favorites: FavoriteEntry[];
  history: WatchEntry[];
}

export function useLibrary(profileId: string | null) {
  return useQuery({
    queryKey: queryKeys.library(profileId),
    queryFn: ({ signal }) =>
      apiGet<LibraryResponse>(
        `/api/profiles/${encodeURIComponent(profileId ?? "")}/library`,
        signal,
      ),
    enabled: Boolean(profileId),
    staleTime: 30_000,
    gcTime: 10 * 60_000,
    refetchOnWindowFocus: true,
  });
}

export function useFavoriteMutation(profileId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      action: "favoritar" | "desfavoritar";
      channelId: string;
      channelName: string;
      logo?: string;
    }) =>
      apiSend<{ action: string; channelId: string }>(
        `/api/profiles/${encodeURIComponent(profileId ?? "")}/library`,
        "POST",
        body,
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.library(profileId) });
    },
  });
}

export function useWatchProgressMutation(profileId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      channelId: string;
      channelName: string;
      logo?: string;
      seconds: number;
    }) =>
      apiSend<{ action: string; channelId: string }>(
        `/api/profiles/${encodeURIComponent(profileId ?? "")}/library`,
        "POST",
        { action: "assistir", ...body },
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.library(profileId) });
    },
  });
}
