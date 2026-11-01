import type { Metadata } from "next";

import { AoVivoClient } from "@/components/live/AoVivoClient";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";

export const metadata: Metadata = {
  title: "Eventos ao vivo",
  description:
    "Agenda esportiva da ZUCA: jogos no ar agora, partidas agendadas e os canais que transmitem cada evento, atualizados em tempo real.",
};

export const dynamic = "force-dynamic";

export default function AoVivoPage() {
  return (
    <ErrorBoundary label="agenda-ao-vivo">
      <AoVivoClient />
    </ErrorBoundary>
  );
}
