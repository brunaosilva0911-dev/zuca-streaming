"use client";

import { memo, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import * as Dialog from "@radix-ui/react-dialog";
import * as Switch from "@radix-ui/react-switch";
import { AnimatePresence, motion } from "framer-motion";
import {
  Baby,
  Check,
  Heart,
  Lock,
  LogOut,
  MonitorSmartphone,
  Pencil,
  Plus,
  ShieldCheck,
  Sparkles,
  Trash2,
  UserRound,
  Users,
} from "lucide-react";

import { ChannelCard } from "@/components/catalog/ChannelRail";
import {
  EmptyState,
  ErrorState,
  GridSkeleton,
  SectionHeading,
  Skeleton,
  ZButton,
} from "@/components/ui/primitives";
import {
  useChannels,
  useCreateProfile,
  useDeleteProfile,
  useLibrary,
  useProfiles,
  useUpdateProfile,
} from "@/hooks/use-zuca-queries";
import { avatarGradient, cn, initialsOf } from "@/lib/utils";
import { useAppStore } from "@/stores/app-store";
import { usePlayerStore } from "@/stores/player-store";

/* ------------------------------------------------------------------ */
/*  Seleção de perfil                                                  */
/* ------------------------------------------------------------------ */

function ProfileChooser() {
  const { data: profiles, isPending, isError, refetch } = useProfiles();
  const setActiveProfile = useAppStore((state) => state.setActiveProfile);
  const setProfiles = useAppStore((state) => state.setProfiles);
  const [pinTarget, setPinTarget] = useState<{ id: string; name: string } | null>(null);
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState<string | null>(null);

  useEffect(() => {
    if (profiles) setProfiles(profiles);
  }, [profiles, setProfiles]);

  const choose = useCallback(
    (profile: { id: string; name: string; pin: string | null }) => {
      if (profile.pin) {
        setPinTarget({ id: profile.id, name: profile.name });
        setPin("");
        setPinError(null);
        return;
      }
      setActiveProfile(profile.id);
    },
    [setActiveProfile],
  );

  const submitPin = useCallback(() => {
    const target = profiles?.find((profile) => profile.id === pinTarget?.id);
    if (!target) return;
    if (pin === target.pin) {
      setActiveProfile(target.id);
      setPinTarget(null);
    } else {
      setPinError("PIN incorreto. Tente novamente.");
      setPin("");
    }
  }, [pin, pinTarget, profiles, setActiveProfile]);

  if (isPending) {
    return (
      <div className="flex flex-col items-center gap-8 py-16">
        <Skeleton className="h-8 w-72 rounded-full" />
        <div className="flex gap-6">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="size-28 rounded-3xl" />
          ))}
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <ErrorState
        title="Não foi possível carregar os perfis"
        description="Verifique sua conexão e tente novamente. Seus dados continuam salvos."
        onRetry={() => void refetch()}
      />
    );
  }

  return (
    <div className="flex flex-col items-center gap-9 py-10 sm:py-16">
      <div className="text-center">
        <h1 className="text-2xl font-extrabold tracking-tight text-white sm:text-4xl">
          Quem está assistindo?
        </h1>
        <p className="mt-2.5 text-[13.5px] text-white/48">
          Escolha um perfil para personalizar favoritos, histórico e recomendações.
        </p>
      </div>

      <div className="flex flex-wrap items-start justify-center gap-5 sm:gap-7">
        {(profiles ?? []).map((profile, index) => (
          <motion.button
            key={profile.id}
            type="button"
            onClick={() => choose(profile)}
            initial={{ opacity: 0, y: 18, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ delay: Math.min(index * 0.07, 0.4), type: "spring", stiffness: 320, damping: 26 }}
            whileHover={{ scale: 1.05, y: -4 }}
            className="focusable group flex w-28 flex-col items-center gap-3 sm:w-36"
            aria-label={`Entrar no perfil ${profile.name}`}
          >
            <span
              className="relative flex aspect-square w-full items-center justify-center rounded-3xl ring-1 ring-white/12 transition group-hover:ring-white/60"
              style={{ backgroundImage: avatarGradient(profile.avatarSeed) }}
            >
              <span className="font-display text-3xl font-black text-white/95 sm:text-4xl">
                {initialsOf(profile.name)}
              </span>
              {profile.isKids ? (
                <span className="absolute -bottom-2 -right-2 flex size-8 items-center justify-center rounded-xl bg-zuca-void ring-2 ring-white/15">
                  <Baby className="size-4 text-zuca-accent" aria-hidden />
                </span>
              ) : null}
              {profile.pin ? (
                <span className="absolute -top-2 -right-2 flex size-8 items-center justify-center rounded-xl bg-zuca-void ring-2 ring-white/15">
                  <Lock className="size-4 text-zuca-gold" aria-hidden />
                </span>
              ) : null}
            </span>
            <span className="text-[13.5px] font-semibold text-white/72 transition group-hover:text-white">
              {profile.name}
            </span>
          </motion.button>
        ))}

        <Link
          href="/perfil?novo=1"
          className="focusable group flex w-28 flex-col items-center gap-3 sm:w-36"
          aria-label="Adicionar novo perfil"
        >
          <span className="flex aspect-square w-full items-center justify-center rounded-3xl border border-dashed border-white/22 bg-white/4 transition group-hover:border-white/55 group-hover:bg-white/8">
            <Plus className="size-9 text-white/45 transition group-hover:text-white" aria-hidden />
          </span>
          <span className="text-[13.5px] font-semibold text-white/55 transition group-hover:text-white">
            Adicionar perfil
          </span>
        </Link>
      </div>

      <Dialog.Root open={Boolean(pinTarget)} onOpenChange={(open) => !open && setPinTarget(null)}>
        <Dialog.Portal>
          <AnimatePresence>
            {pinTarget ? (
              <>
                <Dialog.Overlay asChild>
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[80] bg-black/72 backdrop-blur-sm"
                  />
                </Dialog.Overlay>
                <Dialog.Content asChild>
                  <motion.div
                    initial={{ opacity: 0, scale: 0.94, y: 18 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.94, y: 18 }}
                    transition={{ type: "spring", stiffness: 320, damping: 28 }}
                    className="glass-strong fixed left-1/2 top-1/2 z-[81] w-[min(24rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-3xl p-6"
                  >
                    <Dialog.Title className="text-lg font-bold text-white">
                      Perfil protegido
                    </Dialog.Title>
                    <Dialog.Description className="mt-1.5 text-[13px] text-white/52">
                      Digite o PIN de 4 dígitos para entrar em {pinTarget.name}.
                    </Dialog.Description>
                    <input
                      type="password"
                      inputMode="numeric"
                      pattern="\d{4}"
                      maxLength={4}
                      value={pin}
                      autoFocus
                      onChange={(event) => {
                        setPin(event.target.value.replace(/\D/g, ""));
                        setPinError(null);
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") submitPin();
                      }}
                      aria-label="PIN do perfil"
                      aria-invalid={Boolean(pinError)}
                      className="mt-5 h-14 w-full rounded-2xl border border-white/14 bg-black/40 text-center font-mono text-2xl tracking-[0.6em] text-white focus:border-white/55 focus:outline-none"
                      placeholder="••••"
                    />
                    {pinError ? (
                      <p className="mt-2 text-center text-[12.5px] font-semibold text-zuca-brand-soft" role="alert">
                        {pinError}
                      </p>
                    ) : null}
                    <div className="mt-5 flex gap-3">
                      <ZButton variant="glass" className="flex-1" onClick={() => setPinTarget(null)}>
                        Cancelar
                      </ZButton>
                      <ZButton
                        variant="primary"
                        className="flex-1"
                        onClick={submitPin}
                        disabled={pin.length !== 4}
                      >
                        Entrar
                      </ZButton>
                    </div>
                  </motion.div>
                </Dialog.Content>
              </>
            ) : null}
          </AnimatePresence>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Preferências                                                       */
/* ------------------------------------------------------------------ */

function SettingRow({
  title,
  description,
  checked,
  onCheckedChange,
  locked = false,
  icon,
}: {
  title: string;
  description: string;
  checked: boolean;
  onCheckedChange?: (checked: boolean) => void;
  locked?: boolean;
  icon: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-white/6 px-4 py-3.5 last:border-b-0">
      <div className="flex min-w-0 items-start gap-3">
        <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-white/6 text-white/62">
          {icon}
        </span>
        <div className="min-w-0">
          <p className="text-[13.5px] font-bold text-white/90">{title}</p>
          <p className="mt-0.5 text-[12px] leading-relaxed text-white/45">{description}</p>
        </div>
      </div>
      <Switch.Root
        checked={checked}
        onCheckedChange={locked ? undefined : onCheckedChange}
        disabled={locked}
        aria-label={title}
        className={cn(
          "focusable relative h-7 w-12 shrink-0 rounded-full border transition-colors",
          locked ? "cursor-not-allowed border-zuca-accent/40 bg-zuca-accent/20" : "border-white/14 bg-white/10 data-[state=checked]:bg-zuca-brand",
          checked ? "border-transparent" : "",
        )}
        style={checked && locked ? { backgroundColor: "rgba(0,229,195,0.35)" } : undefined}
      >
        <Switch.Thumb
          className="block size-5 translate-x-1 rounded-full bg-white shadow transition-transform data-[state=checked]:translate-x-6"
        />
      </Switch.Root>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Painel do perfil ativo                                             */
/* ------------------------------------------------------------------ */

function ActiveProfilePanel() {
  const activeProfileId = useAppStore((state) => state.activeProfileId);
  const profiles = useAppStore((state) => state.profiles);
  const setActiveProfile = useAppStore((state) => state.setActiveProfile);
  const setProfileUnlocked = useAppStore((state) => state.setProfileUnlocked);

  const safeAreaEnabled = useAppStore((state) => state.safeAreaEnabled);
  const setSafeAreaEnabled = useAppStore((state) => state.setSafeAreaEnabled);
  const spatialEnabled = useAppStore((state) => state.spatialEnabled);
  const setSpatialEnabled = useAppStore((state) => state.setSpatialEnabled);
  const reducedMotion = useAppStore((state) => state.reducedMotion);
  const setReducedMotion = useAppStore((state) => state.setReducedMotion);
  const dataSaver = useAppStore((state) => state.dataSaver);
  const setDataSaver = useAppStore((state) => state.setDataSaver);

  const ambientByDefault = useAppStore((state) => state.ambientByDefault);
  const setAmbientByDefault = useAppStore((state) => state.setAmbientByDefault);
  const setAmbientEnabled = usePlayerStore((state) => state.setAmbientEnabled);

  const profile = useMemo(
    () => profiles.find((item) => item.id === activeProfileId) ?? null,
    [activeProfileId, profiles],
  );

  const { data: library, isPending: libraryPending } = useLibrary(activeProfileId);
  const { data: catalog, isPending: catalogPending } = useChannels({});
  const deleteProfile = useDeleteProfile();
  const [editing, setEditing] = useState(false);
  const [nameDraft, setNameDraft] = useState(profile?.name ?? "");
  const updateProfile = useUpdateProfile();

  useEffect(() => {
    setNameDraft(profile?.name ?? "");
  }, [profile]);

  useEffect(() => {
    setAmbientEnabled(ambientByDefault);
  }, [ambientByDefault, setAmbientEnabled]);

  const favorites = library?.favorites ?? [];
  const favoriteChannels = useMemo(() => {
    const byId = new Map((catalog?.channels ?? []).map((channel) => [channel.id, channel]));
    return favorites
      .map((entry) => byId.get(entry.channelId))
      .filter((channel): channel is NonNullable<typeof channel> => Boolean(channel));
  }, [catalog, favorites]);

  const saveName = useCallback(() => {
    if (!profile) return;
    updateProfile.mutate(
      { profileId: profile.id, name: nameDraft.trim() },
      { onSuccess: () => setEditing(false) },
    );
  }, [nameDraft, profile, updateProfile]);

  if (!profile) {
    return <ProfileChooser />;
  }

  return (
    <div className="flex flex-col gap-9 pb-6 pt-2">
      {/* Cabeçalho do perfil */}
      <header className="glass flex flex-col gap-5 rounded-[28px] p-5 sm:flex-row sm:items-center sm:justify-between sm:p-7">
        <div className="flex min-w-0 items-center gap-4">
          <span
            className="flex size-16 shrink-0 items-center justify-center rounded-2xl ring-1 ring-white/14 sm:size-20"
            style={{ backgroundImage: avatarGradient(profile.avatarSeed) }}
          >
            <span className="font-display text-2xl font-black text-white/95 sm:text-3xl">
              {initialsOf(profile.name)}
            </span>
          </span>
          <div className="min-w-0">
            {editing ? (
              <div className="flex items-center gap-2">
                <input
                  value={nameDraft}
                  onChange={(event) => setNameDraft(event.target.value)}
                  maxLength={24}
                  aria-label="Nome do perfil"
                  className="h-11 w-full max-w-xs rounded-xl border border-white/16 bg-black/40 px-3 text-[15px] font-bold text-white focus:border-white/50 focus:outline-none"
                />
                <ZButton variant="accent" size="sm" onClick={saveName} loading={updateProfile.isPending}>
                  Salvar
                </ZButton>
                <ZButton variant="ghost" size="sm" onClick={() => setEditing(false)}>
                  Cancelar
                </ZButton>
              </div>
            ) : (
              <>
                <h1 className="truncate text-xl font-extrabold tracking-tight text-white sm:text-2xl">
                  {profile.name}
                </h1>
                <p className="mt-1 flex flex-wrap items-center gap-2 text-[12.5px] text-white/45">
                  {profile.isKids ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-zuca-accent/12 px-2.5 py-0.5 font-semibold text-zuca-accent">
                      <Baby className="size-3.5" aria-hidden /> Perfil infantil
                    </span>
                  ) : null}
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5">
                    <Heart className="size-3.5" aria-hidden /> {favorites.length} favoritos
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5">
                    <UserRound className="size-3.5" aria-hidden /> desde{" "}
                    {new Date(profile.createdAt).getFullYear()}
                  </span>
                </p>
              </>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <ZButton variant="glass" onClick={() => setEditing((value) => !value)} icon={<Pencil className="size-4" aria-hidden />}>
            Editar nome
          </ZButton>
          <ZButton
            variant="glass"
            onClick={() => {
              setActiveProfile(null);
              setProfileUnlocked(false);
            }}
            icon={<Users className="size-4" aria-hidden />}
          >
            Trocar de perfil
          </ZButton>
          <ZButton
            variant="danger"
            onClick={() => {
              deleteProfile.mutate(profile.id, {
                onSuccess: () => {
                  setActiveProfile(null);
                  setProfileUnlocked(false);
                },
              });
            }}
            loading={deleteProfile.isPending}
            icon={<Trash2 className="size-4" aria-hidden />}
          >
            Excluir
          </ZButton>
        </div>
      </header>

      {/* Favoritos */}
      <section aria-label="Canais favoritos">
        <SectionHeading
          title="Meus favoritos"
          subtitle={favoriteChannels.length > 0 ? `${favoriteChannels.length} canais salvos neste perfil` : undefined}
          icon={<Heart className="size-4" aria-hidden />}
        />
        {libraryPending || catalogPending ? (
          <GridSkeleton count={6} />
        ) : favoriteChannels.length > 0 ? (
          <div className="no-scrollbar snap-x-carousel -mx-1 flex gap-3.5 overflow-x-auto px-1 pb-2">
            {favoriteChannels.map((channel, index) => (
              <ChannelCard key={channel.id} channel={channel} priority={index} group="favoritos" />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={<Heart className="size-7" aria-hidden />}
            title="Nenhum favorito ainda"
            description="Toque no coração dentro do player para salvar um canal. Ele aparece aqui em todos os seus dispositivos."
            action={<ZButton variant="primary" onClick={() => window.location.assign("/canais")}>Explorar canais</ZButton>}
          />
        )}
      </section>

      {/* Preferências */}
      <section aria-label="Preferências do dispositivo">
        <SectionHeading
          title="Preferências"
          subtitle="Ajustes aplicados a este dispositivo e salvos localmente"
          icon={<MonitorSmartphone className="size-4" aria-hidden />}
        />
        <div className="glass overflow-hidden rounded-3xl">
          <SettingRow
            icon={<ShieldCheck className="size-4" aria-hidden />}
            title="Curadoria familiar (SFW)"
            description="Bloqueio automático de qualquer conteúdo adulto no catálogo, na grade e nos eventos. Este controle é permanente e não pode ser desativado."
            checked
            locked
          />
          <SettingRow
            icon={<Sparkles className="size-4" aria-hidden />}
            title="Brilho ambiente cinematográfico"
            description="Projeta as cores das bordas do vídeo ao redor do player para uma imersão mais ampla."
            checked={ambientByDefault}
            onCheckedChange={(checked) => {
              setAmbientByDefault(checked);
              setAmbientEnabled(checked);
            }}
          />
          <SettingRow
            icon={<MonitorSmartphone className="size-4" aria-hidden />}
            title="Áreas de segurança da TV (overscan)"
            description="Adiciona margens globais para evitar cortes de interface em televisores antigos."
            checked={safeAreaEnabled}
            onCheckedChange={setSafeAreaEnabled}
          />
          <SettingRow
            icon={<Check className="size-4" aria-hidden />}
            title="Navegação espacial (D-Pad)"
            description="Habilita o foco animado por controle remoto: setas, Enter e voltar."
            checked={spatialEnabled}
            onCheckedChange={setSpatialEnabled}
          />
          <SettingRow
            icon={<LogOut className="size-4" aria-hidden />}
            title="Economia de dados"
            description="Reduz buffer, desativa consulta pesada da grade e prioriza qualidades menores em redes limitadas."
            checked={dataSaver}
            onCheckedChange={setDataSaver}
          />
          <SettingRow
            icon={<Sparkles className="size-4" aria-hidden />}
            title="Reduzir animações"
            description="Desliga transições e micro-interações. Respeita automaticamente a preferência do sistema."
            checked={reducedMotion}
            onCheckedChange={setReducedMotion}
          />
        </div>
      </section>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Raiz                                                               */
/* ------------------------------------------------------------------ */

function ProfileManagerComponent() {
  const activeProfileId = useAppStore((state) => state.activeProfileId);
  const unlocked = useAppStore((state) => state.profileUnlocked);

  return activeProfileId && unlocked ? <ActiveProfilePanel /> : <ProfileChooser />;
}

export const ProfileManager = memo(ProfileManagerComponent);
