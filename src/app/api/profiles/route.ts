import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";

import { db } from "@/db";
import { favorites, profiles, watchHistory } from "@/db/schema";
import { fail, ok } from "@/lib/api/http";
import type { FavoriteEntry, Profile, WatchEntry } from "@/lib/types";
import { slugify } from "@/lib/utils";

export const dynamic = "force-dynamic";

function toProfile(row: typeof profiles.$inferSelect): Profile {
  return {
    id: row.id,
    name: row.name,
    avatarSeed: row.avatarSeed,
    pin: row.pin,
    isKids: row.isKids,
    preferredCategories: row.preferredCategories ?? [],
    createdAt: row.createdAt.toISOString(),
  };
}

async function ensureSeedProfiles(): Promise<void> {
  const existing = await db.select({ id: profiles.id }).from(profiles).limit(1);
  if (existing.length > 0) return;

  const seeds = [
    { name: "Casa", avatarSeed: "zuca-casa", isKids: false },
    { name: "Esportes", avatarSeed: "zuca-esportes", isKids: false },
    { name: "Kids", avatarSeed: "zuca-kids", isKids: true },
  ];

  await db
    .insert(profiles)
    .values(
      seeds.map((seed) => ({
        id: randomUUID(),
        name: seed.name,
        avatarSeed: seed.avatarSeed,
        isKids: seed.isKids,
        preferredCategories: [],
      })),
    )
    .onConflictDoNothing();
}

/** GET /api/profiles — lista os perfis da casa. */
export async function GET() {
  try {
    await ensureSeedProfiles();
    const rows = await db
      .select()
      .from(profiles)
      .orderBy(profiles.createdAt);
    return ok<Profile[]>(rows.map(toProfile));
  } catch {
    return fail(
      503,
      "PERFIS_INDISPONIVEIS",
      "Não foi possível carregar os perfis agora. Tente novamente.",
    );
  }
}

interface CreateProfileBody {
  name?: string;
  avatarSeed?: string;
  isKids?: boolean;
  pin?: string | null;
}

/** POST /api/profiles — cria um novo perfil. */
export async function POST(request: Request) {
  let body: CreateProfileBody;
  try {
    body = (await request.json()) as CreateProfileBody;
  } catch {
    return fail(400, "CORPO_INVALIDO", "Requisição malformada.", false);
  }

  const name = (body.name ?? "").trim();
  if (name.length < 2 || name.length > 24) {
    return fail(
      422,
      "NOME_INVALIDO",
      "O nome do perfil deve ter entre 2 e 24 caracteres.",
      false,
    );
  }
  if (body.pin && !/^\d{4}$/.test(body.pin)) {
    return fail(422, "PIN_INVALIDO", "O PIN deve conter exatamente 4 dígitos.", false);
  }

  try {
    const id = randomUUID();
    const [row] = await db
      .insert(profiles)
      .values({
        id,
        name,
        avatarSeed: body.avatarSeed?.trim() || slugify(name),
        isKids: Boolean(body.isKids),
        pin: body.pin ?? null,
        preferredCategories: [],
      })
      .returning();

    return ok<Profile>(toProfile(row), { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("profiles_name_uidx") || message.includes("duplicate")) {
      return fail(409, "NOME_EM_USO", "Já existe um perfil com esse nome.", false);
    }
    return fail(503, "PERFIL_NAO_CRIADO", "Não foi possível criar o perfil agora.");
  }
}

/** DELETE /api/profiles?id=... — remove perfil, favoritos e histórico. */
export async function DELETE(request: Request) {
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return fail(400, "ID_AUSENTE", "Informe o id do perfil.", false);

  try {
    await db.delete(favorites).where(eq(favorites.profileId, id));
    await db.delete(watchHistory).where(eq(watchHistory.profileId, id));
    await db.delete(profiles).where(eq(profiles.id, id));
    return ok({ removed: id });
  } catch {
    return fail(503, "PERFIL_NAO_REMOVIDO", "Não foi possível remover o perfil.");
  }
}
