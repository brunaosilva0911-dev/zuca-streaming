import type { Metadata } from "next";
import { Suspense } from "react";

import { BuscaClient } from "@/components/search/BuscaClient";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import { GridSkeleton, Skeleton } from "@/components/ui/primitives";

export const metadata: Metadata = {
  title: "Buscar",
  description:
    "Busque canais ao vivo, programas da grade e categorias na ZUCA. Resultados instantâneos com curadoria familiar sempre ativa.",
};

export const dynamic = "force-dynamic";

function BuscaFallback() {
  return (
    <div className="flex flex-col gap-6 pt-2">
      <Skeleton className="h-9 w-56 rounded-full" />
      <Skeleton className="h-16 w-full rounded-3xl" />
      <GridSkeleton count={12} />
    </div>
  );
}

export default function BuscaPage() {
  return (
    <ErrorBoundary label="busca-global">
      <Suspense fallback={<BuscaFallback />}>
        <BuscaClient />
      </Suspense>
    </ErrorBoundary>
  );
}
