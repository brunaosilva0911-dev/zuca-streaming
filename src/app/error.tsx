"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { PlugZap, RefreshCw, ShieldAlert } from "lucide-react";

export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();

  useEffect(() => {
    if (process.env.NODE_ENV !== "production") {
      console.error("[ZUCA] Erro de rota capturado", error);
    }
  }, [error]);

  return (
    <div className="flex min-h-[72dvh] items-center justify-center py-14">
      <motion.div
        initial={{ opacity: 0, y: 18, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="glass flex w-full max-w-xl flex-col items-center gap-5 rounded-[32px] px-7 py-12 text-center"
        role="alert"
      >
        <div className="flex size-16 items-center justify-center rounded-2xl bg-zuca-brand/14 text-zuca-brand-soft">
          <ShieldAlert className="size-8" aria-hidden />
        </div>

        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-white">
            Tivemos uma falha nesta página
          </h1>
          <p className="mx-auto mt-2.5 max-w-md text-[13.5px] leading-relaxed text-white/55">
            Algo interrompeu o carregamento desta seção. Seus favoritos e histórico
            estão seguros. Você pode tentar novamente sem sair daqui.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={reset}
            className="focusable inline-flex h-12 items-center gap-2 rounded-2xl bg-gradient-to-br from-zuca-brand via-[#ff4470] to-zuca-violet px-6 text-sm font-bold text-white shadow-[0_22px_55px_-20px_rgba(255,46,99,0.95)]"
          >
            <RefreshCw className="size-4" aria-hidden />
            Tentar novamente
          </button>
          <button
            type="button"
            onClick={() => router.push("/")}
            className="focusable glass inline-flex h-12 items-center gap-2 rounded-2xl px-5 text-sm font-semibold text-white/88"
          >
            <PlugZap className="size-4" aria-hidden />
            Voltar ao início
          </button>
        </div>

        {error.digest ? (
          <p className="font-mono text-[11px] text-white/28">
            Referência do incidente: {error.digest}
          </p>
        ) : null}
      </motion.div>
    </div>
  );
}
