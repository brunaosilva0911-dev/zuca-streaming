import { randomUUID } from "node:crypto";

import { desc, eq, and, sql } from "drizzle-orm";

import { db } from "@/db";
import { favorites, profiles, watchHistory } from "@/db/schema";
import { fail, ok } from "@/lib/api/http";
import type { FavoriteEntry, WatchEntry } from "@/lib/types";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ profileId: string }>;
}

/** GET /api/profiles/:profileId/library — favoritos + histórico do perfil. */
export async function GET(_request: Request, context: RouteContext) {
  const { profileId } = await context.params;

  try {
    const [favoriteRows, historyRows] = await Promise.all([
      db
        .select()
        .from(favorites)
        .where(eq(favorites.profileId, profileId))
        .orderBy(desc(favorites.addedAt)),
      db
        .select()
        .from(watchHistory)
        .where(eq(watchHistory.profileId, profileId))
        .orderBy(desc(watchHistory.lastWatchedAt))
        .limit(24),
    ]);

    const favoriteList: FavoriteEntry[] = favoriteRows.map((row) => ({
      channelId: row.channelId,
      channelName: row.channelName,
      logo: row.logo,
      addedAt: row.addedAt.toISOString(),
    }));

    const historyList: WatchEntry[] = historyRows.map((row) => ({
      channelId: row.channelId,
      channelName: row.channelName,
      logo: row.logo,
      lastWatchedAt: row.lastWatchedAt.toISOString(),
      secondsWatched: row.secondsWatched,
    }));

    return ok({ favorites: favoriteList, history: historyList });
  } catch {
    return fail(
      503,
      "BIBLIOTECA_INDISPONIVEL",
      "Não foi possível carregar sua biblioteca agora.",
    );
  }
}

interface LibraryMutation {
  action?: "favoritar" | "desfavoritar" | "assistir";
  channelId?: string;
  channelName?: string;
  logo?: string;
  seconds?: number;
}

/** POST /api/profiles/:profileId/library — favoritar / registrar reprodução. */
export async function POST(request: Request, context: RouteContext) {
  const { profileId } = await context.params;

  let body: LibraryMutation;
  try {
    body = (await request.json()) as LibraryMutation;
  } catch {
    return fail(400, "CORPO_INVALIDO", "Requisição malformada.", false);
  }

  const channelId = body.channelId?.trim();
  if (!channelId) {
    return fail(422, "CANAL_AUSENTE", "Informe o canal da operação.", false);
  }
  const channelName = body.channelName?.trim() || channelId;
  const logo = body.logo?.trim() || "";

  try {
    const profileExists = await db
      .select({ id: profiles.id })
      .from(profiles)
      .where(eq(profiles.id, profileId))
      .limit(1);
    if (profileExists.length === 0) {
      return fail(404, "PERFIL_NAO_ENCONTRADO", "Perfil não encontrado.", false);
    }

    if (body.action === "assistir") {
      const seconds = Math.max(0, Math.min(86_400, Number(body.seconds ?? 0) || 0));
      await db
        .insert(watchHistory)
        .values({
          id: randomUUID(),
          profileId,
          channelId,
          channelName,
          logo,
          secondsWatched: seconds,
          lastWatchedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [watchHistory.profileId, watchHistory.channelId],
          set: {
            secondsWatched: sql`${watchHistory.secondsWatched} + ${seconds}`,
            lastWatchedAt: new Date(),
            channelName,
            logo,
          },
        });
      return ok({ action: "assistir", channelId });
    }

    if (body.action === "desfavoritar") {
      await db
        .delete(favorites)
        .where(
          and(eq(favorites.profileId, profileId), eq(favorites.channelId, channelId)),
        );
      return ok({ action: "desfavoritar", channelId });
    }

    await db
      .insert(favorites)
      .values({
        id: randomUUID(),
        profileId,
        channelId,
        channelName,
        logo,
      })
      .onConflictDoNothing();
    return ok({ action: "favoritar", channelId }, { status: 201 });
  } catch {
    return fail(503, "OPERACAO_FALHOU", "Não foi possível concluir a operação.");
  }
}
