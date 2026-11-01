"use client";

import { memo } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { AnimatePresence, motion } from "framer-motion";
import {
  Activity,
  CalendarClock,
  CircleDot,
  Gauge,
  Radio,
  SignalHigh,
  X,
} from "lucide-react";

import type { ConnectionState, Program } from "@/lib/types";
import { cn, formatDuration, formatRelative, formatTime } from "@/lib/utils";

interface LiveSidePanelProps {
  open: boolean;
  onClose: () => void;
  channelName: string;
  nowPlaying: Program | null;
  upNext: Program[];
  networkState: ConnectionState;
  statusLabel: string;
}

const NETWORK_COPY: Record<ConnectionState, { label: string; tone: string }> = {
  online: { label: "Conexão excelente", tone: "text-zuca-accent" },
  slow: { label: "Conexão limitada — qualidade reduzida", tone: "text-zuca-gold" },
  offline: { label: "Sem conexão — reproduzindo buffer", tone: "text-zuca-brand-soft" },
};

/**
 * Modo Ao Vivo Interativo.
 * Painel lateral sobreposto à transmissão com o programa atual, a fila de
 * "a seguir", telemetria de rede e ações rápidas — sem interromper o vídeo.
 */
function LiveSidePanelComponent({
  open,
  onClose,
  channelName,
  nowPlaying,
  upNext,
  networkState,
  statusLabel,
}: LiveSidePanelProps) {
  const network = NETWORK_COPY[networkState];

  return (
    <Dialog.Root open={open} onOpenChange={(next) => !next && onClose()}>
      <Dialog.Portal>
        <AnimatePresence>
          {open ? (
            <>
              <Dialog.Overlay asChild>
                <motion.div
                  key="painel-overlay"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.24 }}
                  className="fixed inset-0 z-[70] bg-black/45 backdrop-blur-[3px]"
                />
              </Dialog.Overlay>
              <Dialog.Content asChild>
                <motion.aside
                  key="painel-conteudo"
                  initial={{ opacity: 0, x: 60, scale: 0.98 }}
                  animate={{ opacity: 1, x: 0, scale: 1 }}
                  exit={{ opacity: 0, x: 60, scale: 0.98 }}
                  transition={{ duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
                  className="glass-strong fixed right-0 top-0 z-[71] flex h-dvh w-[min(26rem,100vw)] flex-col safe-area-y"
                  aria-describedby={undefined}
                >
                  <header className="flex items-center justify-between gap-3 border-b border-white/8 px-5 py-4">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-zuca-brand/16 text-zuca-brand-soft">
                        <Activity className="size-4.5" aria-hidden />
                      </span>
                      <div className="min-w-0">
                        <Dialog.Title className="truncate text-[15px] font-bold text-white">
                          Modo ao vivo
                        </Dialog.Title>
                        <Dialog.Description className="truncate text-[12px] text-white/45">
                          {channelName}
                        </Dialog.Description>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={onClose}
                      aria-label="Fechar painel ao vivo"
                      className="focusable inline-flex size-9 items-center justify-center rounded-xl border border-white/12 bg-white/6 text-white/70 transition hover:text-white"
                    >
                      <X className="size-4" aria-hidden />
                    </button>
                  </header>

                  <div className="thin-scrollbar flex-1 overflow-y-auto px-5 py-5">
                    {/* No ar agora */}
                    <section>
                      <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.24em] text-zuca-brand-soft">
                        <CircleDot className="size-3.5 animate-pulse" aria-hidden />
                        No ar agora
                      </p>
                      {nowPlaying ? (
                        <div className="glass mt-3 rounded-2xl p-4">
                          <h3 className="text-base font-bold leading-snug text-white">
                            {nowPlaying.title}
                          </h3>
                          <p className="mt-1 font-mono text-[11px] text-white/40">
                            {formatTime(nowPlaying.startsAt)} →{" "}
                            {formatTime(nowPlaying.endsAt)} ·{" "}
                            {formatDuration(nowPlaying.durationMs)}
                          </p>
                          <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-white/12">
                            <motion.div
                              className="h-full rounded-full bg-gradient-to-r from-zuca-brand to-zuca-accent"
                              initial={{ width: 0 }}
                              animate={{
                                width: `${Math.min(100, Math.max(2, nowPlaying.progress * 100))}%`,
                              }}
                              transition={{ duration: 0.7, ease: "easeOut" }}
                            />
                          </div>
                          <p className="mt-3 text-[13px] leading-relaxed text-white/62">
                            {nowPlaying.description}
                          </p>
                        </div>
                      ) : (
                        <div className="glass mt-3 rounded-2xl p-4">
                          <p className="text-[13px] text-white/55">
                            Sem informações de programação para este canal no momento.
                          </p>
                        </div>
                      )}
                    </section>

                    {/* A seguir */}
                    <section className="mt-7">
                      <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.24em] text-white/45">
                        <CalendarClock className="size-3.5" aria-hidden />
                        A seguir neste canal
                      </p>
                      {upNext.length > 0 ? (
                        <ul className="mt-3 space-y-2">
                          {upNext.map((program) => (
                            <li
                              key={`${program.channelId}-${program.startsAt}`}
                              className="glass-soft flex items-start gap-3 rounded-2xl px-3.5 py-3"
                            >
                              <span className="mt-0.5 shrink-0 rounded-lg bg-white/8 px-2 py-1 font-mono text-[11px] text-white/72">
                                {formatTime(program.startsAt)}
                              </span>
                              <div className="min-w-0">
                                <p className="truncate text-[13.5px] font-semibold text-white/88">
                                  {program.title}
                                </p>
                                <p className="mt-0.5 truncate text-[11.5px] text-white/42">
                                  {formatRelative(program.startsAt)} ·{" "}
                                  {formatDuration(program.durationMs)}
                                </p>
                              </div>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="glass-soft mt-3 rounded-2xl px-3.5 py-3 text-[13px] text-white/50">
                          A grade das próximas horas ainda não foi publicada pela emissora.
                        </p>
                      )}
                    </section>

                    {/* Telemetria */}
                    <section className="mt-7">
                      <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.24em] text-white/45">
                        <Gauge className="size-3.5" aria-hidden />
                        Status da transmissão
                      </p>
                      <dl className="glass mt-3 divide-y divide-white/8 rounded-2xl">
                        <div className="flex items-center justify-between gap-3 px-4 py-3">
                          <dt className="flex items-center gap-2 text-[13px] text-white/55">
                            <Radio className="size-3.5" aria-hidden /> Sinal
                          </dt>
                          <dd className="text-[13px] font-semibold text-white/88">
                            {statusLabel}
                          </dd>
                        </div>
                        <div className="flex items-center justify-between gap-3 px-4 py-3">
                          <dt className="flex items-center gap-2 text-[13px] text-white/55">
                            <SignalHigh className="size-3.5" aria-hidden /> Rede
                          </dt>
                          <dd className={cn("text-[13px] font-semibold", network.tone)}>
                            {network.label}
                          </dd>
                        </div>
                        <div className="flex items-center justify-between gap-3 px-4 py-3">
                          <dt className="text-[13px] text-white/55">Curadoria</dt>
                          <dd className="text-[13px] font-semibold text-zuca-accent">
                            Conteúdo familiar ativo
                          </dd>
                        </div>
                      </dl>
                    </section>
                  </div>
                </motion.aside>
              </Dialog.Content>
            </>
          ) : null}
        </AnimatePresence>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export const LiveSidePanel = memo(LiveSidePanelComponent);
