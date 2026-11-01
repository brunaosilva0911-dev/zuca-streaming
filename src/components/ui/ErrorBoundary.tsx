"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { PlugZap, RefreshCw, ShieldAlert } from "lucide-react";

import { ZButton } from "@/components/ui/primitives";

interface ErrorBoundaryProps {
  children: ReactNode;
  /** Rótulo exibido no título do estado de erro. */
  label?: string;
  /** Render alternativo opcional; quando ausente usa o painel padrão ZUCA. */
  fallback?: (error: Error, reset: () => void) => ReactNode;
  className?: string;
}

interface ErrorBoundaryState {
  error: Error | null;
  attempt: number;
}

/**
 * Fronteira de erro elegante com retry progressivo. Em Smart TVs uma falha de
 * um carrossel não pode derrubar a tela inteira — por isso cada ilha crítica
 * é embrulhada individualmente.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null, attempt: 0 };

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    if (process.env.NODE_ENV !== "production") {
      console.error(`[ZUCA] Falha em "${this.props.label ?? "componente"}"`, error, info.componentStack);
    }
  }

  reset = (): void => {
    this.setState((current) => ({ error: null, attempt: current.attempt + 1 }));
  };

  render(): ReactNode {
    const { error, attempt } = this.state;
    if (!error) return this.props.children;

    if (this.props.fallback) return this.props.fallback(error, this.reset);

    const exhausted = attempt >= 3;

    return (
      <AnimatePresence mode="wait">
        <motion.div
          key="zuca-error"
          initial={{ opacity: 0, y: 12, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, scale: 0.98 }}
          transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
          className={this.props.className}
          role="alert"
        >
          <div className="glass flex flex-col items-center gap-4 rounded-[28px] border-zuca-brand/25 px-6 py-12 text-center sm:px-10">
            <div className="flex size-16 items-center justify-center rounded-2xl bg-zuca-brand/12 text-zuca-brand-soft">
              {exhausted ? (
                <ShieldAlert className="size-7" aria-hidden />
              ) : (
                <PlugZap className="size-7" aria-hidden />
              )}
            </div>

            <div>
              <h3 className="text-xl font-bold text-white">
                {exhausted
                  ? "Este módulo continua indisponível"
                  : "Ops! Esta seção tropeçou"}
              </h3>
              <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-white/55">
                {exhausted
                  ? "Tentamos recarregar algumas vezes sem sucesso. O restante da ZUCA continua funcionando normalmente — você pode voltar ao início e tentar mais tarde."
                  : "Um erro inesperado impediu esta seção de ser exibida. Nada foi perdido: seus favoritos e seu histórico estão salvos."}
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3">
              <ZButton
                variant="primary"
                onClick={this.reset}
                icon={<RefreshCw className="size-4" aria-hidden />}
              >
                {exhausted ? "Recarregar mais uma vez" : "Recarregar seção"}
              </ZButton>
              <ZButton variant="glass" onClick={() => window.location.assign("/")}>
                Voltar ao início
              </ZButton>
            </div>

            <p className="font-mono text-[11px] text-white/28">
              {error.name}: {error.message.slice(0, 140)}
            </p>
          </div>
        </motion.div>
      </AnimatePresence>
    );
  }
}
