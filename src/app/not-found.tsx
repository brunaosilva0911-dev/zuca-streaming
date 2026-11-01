import Link from "next/link";
import { Compass, Home, Radio, Tv } from "lucide-react";

export const metadata = {
  title: "Página não encontrada",
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <div className="flex min-h-[70dvh] flex-col items-center justify-center gap-7 py-16 text-center">
      <div className="relative">
        <div className="absolute inset-0 animate-breathe rounded-full bg-zuca-brand/25 blur-3xl" />
        <div className="glass relative flex size-24 items-center justify-center rounded-3xl">
          <Compass className="size-10 text-zuca-brand-soft" aria-hidden />
        </div>
      </div>

      <div>
        <p className="font-mono text-[11px] font-bold uppercase tracking-[0.3em] text-zuca-brand">
          Erro 404
        </p>
        <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
          Este canal não existe na ZUCA
        </h1>
        <p className="mx-auto mt-3 max-w-lg text-[14px] leading-relaxed text-white/52">
          O endereço que você tentou abrir não faz parte do nosso catálogo — ou o canal
          foi removido pela curadoria familiar. Que tal explorar o que está no ar agora?
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/"
          className="focusable inline-flex h-12 items-center gap-2 rounded-2xl bg-gradient-to-br from-zuca-brand via-[#ff4470] to-zuca-violet px-6 text-sm font-bold text-white shadow-[0_22px_55px_-20px_rgba(255,46,99,0.95)]"
        >
          <Home className="size-4" aria-hidden />
          Voltar ao início
        </Link>
        <Link
          href="/canais"
          className="focusable glass inline-flex h-12 items-center gap-2 rounded-2xl px-5 text-sm font-semibold text-white/88"
        >
          <Tv className="size-4" aria-hidden />
          Ver todos os canais
        </Link>
        <Link
          href="/ao-vivo"
          className="focusable glass inline-flex h-12 items-center gap-2 rounded-2xl px-5 text-sm font-semibold text-white/88"
        >
          <Radio className="size-4" aria-hidden />
          Eventos ao vivo
        </Link>
      </div>
    </div>
  );
}
