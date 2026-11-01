import { getNowPlaying, getUpNext, resolveStream } from "@/lib/api/server";
import { fail, route } from "@/lib/api/http";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface RouteContext {
  params: Promise<{ channelId: string }>;
}

/**
 * GET /api/streams/:channelId
 * Resolve o manifesto HLS real do canal + programa atual + próximos eventos
 * (usado pelo Modo Ao Vivo Interativo).
 */
export async function GET(_request: Request, context: RouteContext) {
  const { channelId } = await context.params;

  if (!channelId || channelId.length > 128) {
    return fail(400, "CANAL_INVALIDO", "Identificador de canal inválido.", false);
  }

  return route(async () => {
    const [stream, nowPlaying, upNext] = await Promise.all([
      resolveStream(channelId),
      getNowPlaying(channelId).catch(() => null),
      getUpNext(channelId, 6).catch(() => []),
    ]);

    return { stream, nowPlaying, upNext };
  }, {
    status: 502,
    code: "SINAL_INDISPONIVEL",
    message: "Não foi possível obter o sinal deste canal agora.",
  });
}
