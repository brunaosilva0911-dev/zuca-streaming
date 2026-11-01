"use client";

import { memo, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  CalendarRange,
  Home,
  Radio,
  Search,
  SignalHigh,
  Trophy,
  UserRound,
  Wifi,
  WifiOff,
} from "lucide-react";

import { useFocusable } from "@/hooks/use-spatial-navigation";
import { useNetworkStatus } from "@/hooks/use-network-status";
import { cn, initialsOf, avatarGradient } from "@/lib/utils";
import { useAppStore, selectActiveProfile } from "@/stores/app-store";

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  group: string;
}

const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Início", icon: <Home className="size-4" aria-hidden />, group: "nav" },
  { href: "/canais", label: "Canais", icon: <Radio className="size-4" aria-hidden />, group: "nav" },
  { href: "/guia", label: "Guia (EPG)", icon: <CalendarRange className="size-4" aria-hidden />, group: "nav" },
  { href: "/ao-vivo", label: "Ao vivo", icon: <Trophy className="size-4" aria-hidden />, group: "nav" },
  { href: "/busca", label: "Buscar", icon: <Search className="size-4" aria-hidden />, group: "nav" },
];

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  const { ref, focused, tabIndex } = useFocusable<HTMLAnchorElement>({
    group: item.group,
    priority: NAV_ITEMS.indexOf(item),
  });

  return (
    <Link
      ref={ref}
      href={item.href}
      tabIndex={tabIndex}
      data-focus={focused ? "true" : "false"}
      aria-current={active ? "page" : undefined}
      className={cn(
        "focusable relative flex shrink-0 items-center gap-2 rounded-xl px-3.5 py-2 text-[13.5px] font-medium transition-colors",
        active ? "text-white" : "text-white/55 hover:text-white/85",
      )}
    >
      {item.icon}
      <span className="hidden md:inline">{item.label}</span>
      {active ? (
        <motion.span
          layoutId="nav-ativo"
          transition={{ type: "spring", stiffness: 420, damping: 34 }}
          className="absolute inset-0 -z-10 rounded-xl border border-white/14 bg-white/9 shadow-[inset_0_1px_0_rgba(255,255,255,0.14)]"
        />
      ) : null}
    </Link>
  );
}

function NetworkPill() {
  const { state, latencyMs } = useNetworkStatus(30_000);

  const config = {
    online: { icon: <Wifi className="size-3.5" aria-hidden />, label: latencyMs ? `${latencyMs} ms` : "Online", tone: "text-zuca-accent" },
    slow: { icon: <SignalHigh className="size-3.5" aria-hidden />, label: "Rede lenta", tone: "text-zuca-gold" },
    offline: { icon: <WifiOff className="size-3.5" aria-hidden />, label: "Offline", tone: "text-zuca-brand-soft" },
  }[state];

  return (
    <span
      className={cn(
        "hidden items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 font-mono text-[10.5px] lg:inline-flex",
        config.tone,
      )}
      role="status"
      aria-live="polite"
      title={`Estado da conexão: ${config.label}`}
    >
      {config.icon}
      {config.label}
    </span>
  );
}

function ProfileButton() {
  const profile = useAppStore(selectActiveProfile);
  const router = useRouter();
  const { ref, focused, tabIndex } = useFocusable<HTMLAnchorElement>({
    group: "nav",
    priority: 90,
  });

  return (
    <Link
      ref={ref}
      href="/perfil"
      tabIndex={tabIndex}
      data-focus={focused ? "true" : "false"}
      aria-label={profile ? `Perfil ativo: ${profile.name}` : "Abrir perfis"}
      className="focusable flex shrink-0 items-center gap-2 rounded-full border border-white/12 bg-white/6 p-1 pr-3 transition hover:border-white/28"
    >
      <span
        className="flex size-7 items-center justify-center rounded-full text-[11px] font-bold text-white"
        style={{ backgroundImage: avatarGradient(profile?.avatarSeed ?? "zuca") }}
      >
        {initialsOf(profile?.name ?? "ZUCA")}
      </span>
      <span className="hidden max-w-[7rem] truncate text-[12.5px] font-semibold text-white/82 sm:inline">
        {profile?.name ?? "Entrar"}
      </span>
    </Link>
  );
}

function GlobalNavComponent() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);

  const handleBack = useCallback((event: Event) => {
    event.preventDefault();
    if (window.history.length > 1) window.history.back();
    else window.location.assign("/");
  }, []);

  useEffect(() => {
    window.addEventListener("zuca:back", handleBack);
    return () => window.removeEventListener("zuca:back", handleBack);
  }, [handleBack]);

  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 12);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "sticky top-0 z-[60] transition-all duration-300",
        scrolled ? "py-2" : "py-3",
      )}
    >
      <div className="safe-area-x">
        <motion.nav
          layout
          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          className={cn(
            "flex items-center gap-2 rounded-2xl px-2.5 py-2 transition-all duration-300 sm:gap-3 sm:px-3",
            scrolled ? "glass-strong" : "glass",
          )}
          aria-label="Navegação principal da ZUCA"
        >
          <Link
            href="/"
            aria-label="ZUCA — página inicial"
            className="focusable mr-1 flex shrink-0 items-center gap-2 rounded-xl px-1.5 py-1"
          >
            <span className="relative flex size-8 items-center justify-center">
              <span className="absolute inset-0 rounded-[10px] bg-gradient-to-br from-zuca-brand to-zuca-violet" />
              <span className="absolute inset-0 animate-breathe rounded-[10px] bg-gradient-to-tr from-zuca-accent/70 to-transparent blur-[6px]" />
              <span className="relative font-display text-[13px] font-black text-white">Z</span>
            </span>
            <span className="font-display hidden text-[17px] font-extrabold tracking-[0.14em] text-white sm:inline">
              ZUCA
            </span>
          </Link>

          <div className="no-scrollbar flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.href}
                item={item}
                active={pathname === item.href || pathname.startsWith(`${item.href}/`)}
              />
            ))}
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <NetworkPill />
            <ProfileButton />
          </div>
        </motion.nav>
      </div>
    </header>
  );
}

export const GlobalNav = memo(GlobalNavComponent);

function FooterComponent() {
  return (
    <footer className="safe-area mt-16 border-t border-white/8 pt-8 pb-10">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-display text-[15px] font-extrabold tracking-[0.16em] text-white">
            ZUCA
          </p>
          <p className="mt-1 max-w-md text-[12.5px] leading-relaxed text-white/40">
            Televisão ao vivo e conteúdo sob demanda com curadoria 100% familiar.
            Todo o catálogo passa por filtro automático de conteúdo adulto antes de
            chegar à sua tela.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[12.5px] text-white/42">
          <span className="inline-flex items-center gap-1.5">
            <span className="size-1.5 rounded-full bg-zuca-accent" />
            Política SFW ativa
          </span>
          <span>Compatível com Android TV, WebOS e Tizen</span>
          <span className="font-mono">v1.0.0</span>
        </div>
      </div>
    </footer>
  );
}

export const Footer = memo(FooterComponent);

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="relative flex min-h-dvh flex-col">
      <GlobalNav />
      <main className="safe-area-x flex-1 pt-4">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={pathname}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </main>
      <Footer />
    </div>
  );
}
