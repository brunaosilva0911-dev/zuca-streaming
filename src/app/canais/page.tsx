import type { Metadata } from "next";
import { Suspense } from "react";

import { ChannelsCatalog } from "@/components/catalog/ChannelsCatalog";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import { GridSkeleton } from "@/components/ui/primitives";

export const metadata: Metadata = {
  title: "Canais ao vivo",
  description:
    "Explore todos os canais ao vivo da ZUCA: abertos, esportes, filmes, séries, notícias, documentários e infantil — com curadoria 100% familiar.",
};

export const dynamic = "force-dynamic";

export default function CanaisPage() {
  return (
    <ErrorBoundary label="catalogo-de-canais">
      <Suspense fallback={<div className="pt-6"><GridSkeleton count={24} /></div>}>
        <ChannelsCatalog />
      </Suspense>
    </ErrorBoundary>
  );
}
