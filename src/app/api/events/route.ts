import { getLiveEvents } from "@/lib/api/server";
import { route } from "@/lib/api/http";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/** GET /api/events — eventos esportivos/ao vivo (filtrados pela política SFW). */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const filter = searchParams.get("filtro") ?? "todos";

  return route(async () => {
    const events = await getLiveEvents();

    const live = events.filter((event) => event.status === "ao-vivo");
    const upcoming = events.filter((event) => event.status === "agendado");
    const finished = events.filter((event) => event.status === "encerrado");

    const selected =
      filter === "ao-vivo"
        ? live
        : filter === "agendados"
          ? upcoming
          : filter === "encerrados"
            ? finished
            : events;

    return {
      events: selected,
      counts: {
        live: live.length,
        upcoming: upcoming.length,
        finished: finished.length,
        total: events.length,
      },
    };
  }, {
    status: 502,
    code: "EVENTOS_INDISPONIVEIS",
    message: "Não foi possível carregar a agenda de eventos ao vivo.",
  });
}
