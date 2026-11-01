import { getEpgRows } from "@/lib/api/server";
import { route } from "@/lib/api/http";
import { snapToHour } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * GET /api/epg?canais=a,b&janela=24&deslocamento=0
 *
 * `deslocamento` (em horas) permite o "Time-Travel": valores negativos voltam
 * no tempo. A janela é sempre limitada para proteger a memória das Smart TVs.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const channelParam = searchParams.get("canais") ?? "";
  const onlyChannelIds = channelParam
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);

  const windowHours = Math.min(
    48,
    Math.max(3, Number(searchParams.get("janela") ?? 24) || 24),
  );
  const offsetHours = Math.min(
    72,
    Math.max(-168, Number(searchParams.get("deslocamento") ?? 0) || 0),
  );

  return route(async () => {
    const rows = await getEpgRows({
      onlyChannelIds: onlyChannelIds.length > 0 ? onlyChannelIds : undefined,
      windowHours,
    });

    const shifted =
      offsetHours === 0
        ? rows
        : rows.map((row) => ({
            channel: row.channel,
            programs: row.programs.map((program) => ({
              ...program,
              isNow:
                program.startsAt - offsetHours * 3_600_000 <= Date.now() &&
                program.endsAt - offsetHours * 3_600_000 > Date.now(),
            })),
          }));

    const now = Date.now() + offsetHours * 3_600_000;

    return {
      rows: shifted,
      windowStart: snapToHour(now - windowHours / 2, 1),
      windowEnd: snapToHour(now + windowHours / 2, 1),
      now,
      offsetHours,
      windowHours,
      totalChannels: shifted.length,
      totalPrograms: shifted.reduce((acc, row) => acc + row.programs.length, 0),
    };
  }, {
    status: 502,
    code: "EPG_INDISPONIVEL",
    message: "Não foi possível carregar a programação (EPG) agora.",
  });
}
