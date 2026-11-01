/**
 * ZUCA — Strict SFW content gate.
 *
 * The filter runs at the FETCH layer (server side) so that blocked items are
 * never serialized to the client bundle, never cached by TanStack Query and
 * never rendered. Three independent passes are applied:
 *
 *  1. Identifier / slug blocklist (channel ids, event slugs).
 *  2. Display-name blocklist (channel names, league names, program titles).
 *  3. Category-name blocklist (provider taxonomy).
 */

const BLOCKED_TOKENS = [
  // explicit brands / channel identifiers
  "playboy",
  "playboytv",
  "sexyhot",
  "sexy_hot",
  "sexyhot_tv",
  "sextreme",
  "sexzone",
  "sex_zone",
  "hotclub",
  "hot_club",
  "hot_tv",
  "hotgold",
  "venus",
  "privetv",
  "prive",
  "privê",
  "for_you",
  "foryou",
  "brasileirinhas",
  "brasileirinha",
  "canalhenta",
  "hustler",
  "penthouse",
  "redlight",
  "red_light",
  "brazzers",
  "dorcel",
  "dorceltv",
  "jasmin",
  "jasmin_tv",
  "babes",
  "babestation",
  "xtrasmall",
  "pinkotv",
  "pinko",
  "butgo",
  "bluehustler",
  "eroxxx",
  "ero_x",
  "extasy",
  "exxxotica",
  "taboo",
  "xxtv",
  "xx_tv",
  "xxx",
  "passie",
  "vivid",
  "vividtv",
  "dusk",
  "lustchannel",
  "libidotv",
  "libido",
  "hotpleasure",
  "pleasure",
  "adult",
  "adults",
  "erotico",
  "erotica",
  "erotic",
  "erotique",
  "porn",
  "porno",
  "pornhub",
  "porntv",
  "hardcore",
  "softcore",
  "nudity",
  "nude",
  "sexo",
  "sexual",
  "mais18",
  "mais_18",
  "18+",
  "+18",
  "18plus",
  "onlyadults",
  "conteudo_adulto",
  "conteudoadulto",
  "canal_adulto",
] as const;

/**
 * "adultswim" is a mainstream animation block (Cartoon Network family) and must
 * survive the `adult` token. Whitelisted identifiers are checked first.
 */
const ALLOWED_OVERRIDE_TOKENS = [
  "adultswim",
  "adult_swim",
  "adult swim",
] as const;

const BLOCKED_CATEGORY_NAMES = [
  "adulto",
  "adultos",
  "adult",
  "adults",
  "+18",
  "18+",
  "erotico",
  "erotica",
  "sexy",
  "hot",
  "porn",
  "sexo",
] as const;

function normalize(value: string | null | undefined): string {
  if (!value) return "";
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9+]+/g, " ")
    .trim();
}

function containsBlockedToken(value: string | null | undefined): boolean {
  const haystack = ` ${normalize(value)} `;
  if (!haystack.trim()) return false;
  // Whitelisted mainstream identifiers (e.g. "Adult Swim") are stripped before
  // scanning so they never trigger the `adult` token.
  const stripped = ALLOWED_OVERRIDE_TOKENS.reduce(
    (acc, ok) => acc.split(normalize(ok)).join(" "),
    haystack,
  );
  return BLOCKED_TOKENS.some((token) => {
    const needle = normalize(token);
    if (!needle) return false;
    return stripped.includes(needle);
  });
}

/** True when ANY of the given values match the blocklist. */
export function isBlockedContent(
  ...values: Array<string | null | undefined>
): boolean {
  return values.some((value) => containsBlockedToken(value));
}

/** True when a provider category name is an adult category. */
export function isBlockedCategory(name: string | null | undefined): boolean {
  const normalized = normalize(name);
  if (!normalized) return false;
  return BLOCKED_CATEGORY_NAMES.some((blocked) => normalized === blocked || normalized.includes(blocked));
}

/**
 * Applies the full SFW gate to a raw channel payload.
 * Returns `true` when the channel is SAFE to expose.
 */
export function isSafeChannel(channel: {
  id?: string | null;
  name?: string | null;
  url?: string | null;
  image?: string | null;
}): boolean {
  return !isBlockedContent(channel.id, channel.name, channel.url, channel.image);
}

/** Applies the full SFW gate to a live event payload. */
export function isSafeEvent(event: {
  slug?: string | null;
  title?: string | null;
  leagueName?: string | null;
  homeName?: string | null;
  awayName?: string | null;
}): boolean {
  return !isBlockedContent(
    event.slug,
    event.title,
    event.leagueName,
    event.homeName,
    event.awayName,
  );
}

/** Applies the full SFW gate to an EPG program payload. */
export function isSafeProgram(program: {
  title?: string | null;
  desc?: string | null;
}): boolean {
  return !isBlockedContent(program.title, program.desc);
}

export const SAFE_PROGRAM_TITLE = "Programação ZUCA";
export const SAFE_PROGRAM_DESCRIPTION =
  "Conteúdo familiar selecionado pela curadoria ZUCA.";
