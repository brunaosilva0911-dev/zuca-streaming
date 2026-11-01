import { Skeleton } from "@/components/ui/primitives";

export default function Loading() {
  return (
    <div className="flex flex-col gap-8 pb-8 pt-2" aria-busy="true" aria-live="polite">
      <div className="flex items-center gap-3">
        <div className="relative size-6">
          <div className="absolute inset-0 rounded-full border-2 border-white/12" />
          <div className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-zuca-brand" />
        </div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/45">
          Carregando a ZUCA
        </p>
      </div>

      <Skeleton className="aspect-[21/9] w-full rounded-[30px]" />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-[74px] w-full rounded-2xl" />
        ))}
      </div>

      <div className="flex flex-col gap-4">
        <Skeleton className="h-6 w-52 rounded-full" />
        <div className="no-scrollbar flex gap-4 overflow-hidden">
          {Array.from({ length: 7 }).map((_, index) => (
            <div key={index} className="w-[196px] shrink-0">
              <Skeleton className="aspect-video w-full rounded-2xl" />
              <Skeleton className="mt-3 h-3.5 w-3/4 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
