import { getChannelGroup } from "@/lib/api/server";
import { route } from "@/lib/api/http";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/** GET /api/channels — catálogo de canais (já filtrado pela política SFW). */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim().toLowerCase() ?? "";
  const categoryId = searchParams.get("categoria");

  return route(async () => {
    const group = await getChannelGroup();

    let channels = group.channels;

    if (categoryId && categoryId !== "0" && categoryId !== "all") {
      const wanted = Number(categoryId);
      if (Number.isFinite(wanted)) {
        channels = channels.filter((channel) => channel.categories.includes(wanted));
      }
    }

    if (query.length > 0) {
      const needle = query
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();
      channels = channels.filter((channel) => {
        const haystack = `${channel.name} ${channel.categoryNames.join(" ")}`
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .toLowerCase();
        return haystack.includes(needle);
      });
    }

    return {
      categories: group.categories,
      channels,
      total: channels.length,
      policy: "conteudo-familiar-ativo",
    };
  }, {
    status: 502,
    code: "CATALOGO_INDISPONIVEL",
    message: "Não foi possível carregar o catálogo de canais agora.",
  });
}
