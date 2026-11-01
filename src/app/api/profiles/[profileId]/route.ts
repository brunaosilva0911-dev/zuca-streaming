import { eq } from "drizzle-orm";

import { db } from "@/db";
import { profiles } from "@/db/schema";
import { fail, ok } from "@/lib/api/http";
import type { Profile } from "@/lib/types";
import { slugify } from "@/lib/utils";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ profileId: string }>;
}

interface UpdateBody {
  name?: string;
  avatarSeed?: string;
  pin?: string | null;
  isKids?: boolean;
  preferredCategories?: number[];
}

/** PATCH /api/profiles/:profileId — edita nome, PIN, avatar e preferências. */
export async function PATCH(request: Request, context: RouteContext) {
  const { profileId } = await context.params;

  let body: UpdateBody;
  try {
    body = (await request.json()) as UpdateBody;
  } catch {
    return fail(400, "CORPO_INVALIDO", "Requisição malformada.", false);
  }

  const patch: Record<string, unknown> = {};

  if (typeof body.name === "string") {
    const name = body.name.trim();
    if (name.length < 2 || name.length > 24) {
      return fail(422, "NOME_INVALIDO", "O nome deve ter entre 2 e 24 caracteres.", false);
    }
    patch.name = name;
  }
  if (typeof body.avatarSeed === "string" && body.avatarSeed.trim()) {
    patch.avatarSeed = slugify(body.avatarSeed);
  }
  if (body.pin !== undefined) {
    if (body.pin !== null && !/^\d{4}$/.test(body.pin)) {
      return fail(422, "PIN_INVALIDO", "O PIN deve conter exatamente 4 dígitos.", false);
    }
    patch.pin = body.pin;
  }
  if (typeof body.isKids === "boolean") patch.isKids = body.isKids;
  if (Array.isArray(body.preferredCategories)) {
    patch.preferredCategories = body.preferredCategories
      .map((value) => Number(value))
      .filter((value) => Number.isFinite(value));
  }

  if (Object.keys(patch).length === 0) {
    return fail(422, "NADA_PARA_ATUALIZAR", "Nenhum campo para atualizar.", false);
  }

  try {
    const [row] = await db
      .update(profiles)
      .set(patch)
      .where(eq(profiles.id, profileId))
      .returning();

    if (!row) {
      return fail(404, "PERFIL_NAO_ENCONTRADO", "Perfil não encontrado.", false);
    }

    const profile: Profile = {
      id: row.id,
      name: row.name,
      avatarSeed: row.avatarSeed,
      pin: row.pin,
      isKids: row.isKids,
      preferredCategories: row.preferredCategories ?? [],
      createdAt: row.createdAt.toISOString(),
    };
    return ok<Profile>(profile);
  } catch {
    return fail(503, "PERFIL_NAO_ATUALIZADO", "Não foi possível atualizar o perfil.");
  }
}
