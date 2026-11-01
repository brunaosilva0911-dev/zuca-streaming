import type { Metadata } from "next";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/primitives";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import { GuiaClient } from "@/components/epg/GuiaClient";

export const metadata: Metadata = {
  title: "Guia de programação",
  description:
    "Guia eletrônico de programação (EPG) da ZUCA com viagem no tempo: volte até 7 dias, veja o que está no ar agora e reassista programas já exibidos.",
};

export const dynamic = "force-dynamic";

function GuiaFallback() {
  return (
    <div className="flex flex-col gap-4 pt-2">
      <div className="flex flex-col gap-3">
        <Skeleton className="h-9 w-64 rounded-full" />
        <Skeleton className="h-4 w-96 max-w-full rounded-full" />
        <div className="mt-2 flex gap-2">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-9 w-28 rounded-full" />
          ))}
        </div>
      </div>
      <Skeleton className="h-[52dvh] w-full rounded-3xl" />
    </div>
  );
}

export default function GuiaPage() {
  return (
    <ErrorBoundary label="guia-de-programacao">
      <Suspense fallback={<GuiaFallback />}>
        <GuiaClient />
      </Suspense>
    </ErrorBoundary>
  );
}
