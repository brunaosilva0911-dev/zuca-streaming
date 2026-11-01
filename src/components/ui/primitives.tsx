"use client";

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { motion, type HTMLMotionProps } from "framer-motion";
import { AlertTriangle, Radio, RefreshCw, SearchX } from "lucide-react";

import { cn } from "@/lib/utils";
import { useFocusable } from "@/hooks/use-spatial-navigation";

/* ------------------------------------------------------------------ */
/*  Botão                                                              */
/* ------------------------------------------------------------------ */

type ButtonVariant = "primary" | "glass" | "ghost" | "danger" | "accent";
type ButtonSize = "sm" | "md" | "lg";

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary:
    "bg-gradient-to-br from-zuca-brand via-[#ff4470] to-zuca-violet text-white shadow-[0_18px_45px_-18px_rgba(255,46,99,0.9)] hover:brightness-110",
  accent:
    "bg-gradient-to-br from-zuca-accent to-[#00b39a] text-zuca-void font-semibold shadow-[0_18px_45px_-18px_rgba(0,229,195,0.85)] hover:brightness-110",
  glass: "glass text-white/92 hover:text-white hover:bg-white/10",
  ghost: "bg-transparent text-white/72 hover:text-white hover:bg-white/8",
  danger: "bg-[#3a1220] text-[#ff8fa8] border border-[#ff2e63]/35 hover:bg-[#4a1526]",
};

const BUTTON_SIZES: Record<ButtonSize, string> = {
  sm: "h-9 px-3.5 text-[13px] gap-1.5 rounded-xl",
  md: "h-11 px-5 text-sm gap-2 rounded-2xl",
  lg: "h-14 px-7 text-base gap-2.5 rounded-2xl",
};

export interface ZButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "ref"> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ReactNode;
  trailing?: ReactNode;
  loading?: boolean;
  spatialGroup?: string;
  spatialPriority?: number;
}

export const ZButton = forwardRef<HTMLButtonElement, ZButtonProps>(function ZButton(
  {
    variant = "glass",
    size = "md",
    icon,
    trailing,
    loading = false,
    className,
    children,
    disabled,
    spatialGroup = "acoes",
    spatialPriority = 0,
    ...props
  },
  forwardedRef,
) {
  const { ref: focusRef, focused, tabIndex } = useFocusable<HTMLButtonElement>({
    group: spatialGroup,
    priority: spatialPriority,
    disabled: Boolean(disabled),
  });

  return (
    <motion.button
      ref={(node) => {
        focusRef.current = node;
        if (typeof forwardedRef === "function") forwardedRef(node);
        else if (forwardedRef) forwardedRef.current = node;
      }}
      data-focus={focused ? "true" : "false"}
      data-disabled={disabled ? "true" : "false"}
      tabIndex={tabIndex}
      whileTap={disabled ? undefined : { scale: 0.96 }}
      className={cn(
        "focusable relative inline-flex select-none items-center justify-center font-medium tracking-tight",
        "disabled:pointer-events-none disabled:opacity-40",
        BUTTON_VARIANTS[variant],
        BUTTON_SIZES[size],
        className,
      )}
      aria-busy={loading}
      aria-disabled={disabled}
      aria-label={typeof children === "string" ? children : props["aria-label"]}
      {...(props as HTMLMotionProps<"button">)}
      onClick={loading || disabled ? undefined : props.onClick}
    >
      {loading ? (
        <RefreshCw className="size-4 animate-spin" aria-hidden />
      ) : (
        icon
      )}
      {children}
      {trailing}
    </motion.button>
  );
});

/* ------------------------------------------------------------------ */
/*  Painel de vidro                                                    */
/* ------------------------------------------------------------------ */

export function GlassPanel({
  className,
  children,
  intensity = "normal",
  ...props
}: {
  className?: string;
  children: ReactNode;
  intensity?: "soft" | "normal" | "strong";
} & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-3xl",
        intensity === "soft" && "glass-soft",
        intensity === "normal" && "glass",
        intensity === "strong" && "glass-strong",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Selos                                                              */
/* ------------------------------------------------------------------ */

export function LiveBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full bg-zuca-brand/95 px-2.5 py-1",
        "text-[10px] font-bold uppercase tracking-[0.18em] text-white",
        className,
      )}
    >
      <span className="size-1.5 animate-[live-pulse_1.8s_ease-in-out_infinite] rounded-full bg-white" />
      Ao vivo
    </span>
  );
}

export function QualityBadge({
  label,
  className,
}: {
  label: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "rounded-md border border-white/25 bg-black/45 px-1.5 py-0.5",
        "font-mono text-[10px] font-bold tracking-wider text-white/85 backdrop-blur",
        className,
      )}
    >
      {label}
    </span>
  );
}

export function Chip({
  children,
  active = false,
  className,
  ...props
}: {
  children: ReactNode;
  active?: boolean;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      aria-pressed={active}
      className={cn(
        "focusable snap-item shrink-0 rounded-full border px-4 py-2 text-[13px] font-medium whitespace-nowrap transition",
        active
          ? "border-transparent bg-white text-zuca-void shadow-[0_10px_30px_-12px_rgba(255,255,255,0.7)]"
          : "border-white/12 bg-white/5 text-white/72 hover:border-white/25 hover:text-white",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  Títulos de seção                                                   */
/* ------------------------------------------------------------------ */

export function SectionHeading({
  title,
  subtitle,
  icon,
  action,
  className,
}: {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-4 flex items-end justify-between gap-4", className)}>
      <div className="min-w-0">
        <h2 className="flex items-center gap-2.5 text-lg font-bold tracking-tight text-white sm:text-xl">
          {icon ? <span className="text-zuca-brand">{icon}</span> : null}
          {title}
        </h2>
        {subtitle ? (
          <p className="mt-1 truncate text-[13px] text-white/48">{subtitle}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Skeletons                                                          */
/* ------------------------------------------------------------------ */

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton rounded-2xl", className)} aria-hidden />;
}

export function ChannelCardSkeleton() {
  return (
    <div className="w-[168px] shrink-0 sm:w-[196px]">
      <Skeleton className="aspect-video w-full rounded-2xl" />
      <Skeleton className="mt-3 h-3.5 w-3/4 rounded-full" />
      <Skeleton className="mt-2 h-3 w-1/2 rounded-full" />
    </div>
  );
}

export function RailSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="flex gap-4 overflow-hidden">
      {Array.from({ length: count }).map((_, index) => (
        <ChannelCardSkeleton key={index} />
      ))}
    </div>
  );
}

export function HeroSkeleton() {
  return (
    <div className="relative aspect-[16/9] w-full overflow-hidden rounded-[28px] sm:aspect-[21/9]">
      <Skeleton className="absolute inset-0 rounded-none" />
      <div className="absolute inset-x-0 bottom-0 flex flex-col gap-3 p-6 sm:p-10">
        <Skeleton className="h-4 w-28 rounded-full" />
        <Skeleton className="h-9 w-2/3 rounded-full" />
        <Skeleton className="h-4 w-1/2 rounded-full" />
        <div className="mt-2 flex gap-3">
          <Skeleton className="h-12 w-40 rounded-2xl" />
          <Skeleton className="h-12 w-32 rounded-2xl" />
        </div>
      </div>
    </div>
  );
}

export function GridSkeleton({ count = 18 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
      {Array.from({ length: count }).map((_, index) => (
        <ChannelCardSkeleton key={index} />
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Estados vazios / erro                                              */
/* ------------------------------------------------------------------ */

export function EmptyState({
  title,
  description,
  icon,
  action,
  className,
}: {
  title: string;
  description: string;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "glass flex flex-col items-center justify-center gap-3 rounded-[28px] px-8 py-16 text-center",
        className,
      )}
      role="status"
    >
      <div className="flex size-16 items-center justify-center rounded-2xl bg-white/6 text-zuca-brand">
        {icon ?? <SearchX className="size-7" aria-hidden />}
      </div>
      <h3 className="text-lg font-bold text-white">{title}</h3>
      <p className="max-w-md text-sm leading-relaxed text-white/52">{description}</p>
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}

export function ErrorState({
  title = "Algo saiu do ar",
  description = "Não conseguimos carregar estas informações agora.",
  onRetry,
  retrying = false,
  className,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
  retrying?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "glass flex flex-col items-center justify-center gap-4 rounded-[28px] border-zuca-brand/25 px-8 py-16 text-center",
        className,
      )}
      role="alert"
    >
      <div className="flex size-16 items-center justify-center rounded-2xl bg-zuca-brand/12 text-zuca-brand-soft">
        <AlertTriangle className="size-7" aria-hidden />
      </div>
      <div>
        <h3 className="text-lg font-bold text-white">{title}</h3>
        <p className="mx-auto mt-1.5 max-w-md text-sm leading-relaxed text-white/55">
          {description}
        </p>
      </div>
      {onRetry ? (
        <ZButton variant="primary" size="md" onClick={onRetry} loading={retrying} icon={<RefreshCw className="size-4" aria-hidden />}>
          Tentar novamente
        </ZButton>
      ) : null}
    </div>
  );
}

export function OfflineBanner({ visible }: { visible: boolean }) {
  if (!visible) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[80] flex justify-center pt-3">
      <div className="glass-strong pointer-events-auto flex items-center gap-2.5 rounded-full border-zuca-gold/35 px-4 py-2 text-[13px] text-zuca-gold">
        <Radio className="size-4 animate-pulse" aria-hidden />
        <span>
          Conexão instável — exibindo o último conteúdo carregado.
        </span>
      </div>
    </div>
  );
}
