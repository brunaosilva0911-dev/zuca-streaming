import type { Metadata } from "next";

import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import { ProfileManager } from "@/components/profile/ProfileManager";

export const metadata: Metadata = {
  title: "Perfis e preferências",
  description:
    "Gerencie os perfis da sua casa, favoritos, histórico e as preferências de acessibilidade da ZUCA — incluindo navegação por controle remoto e áreas de segurança da TV.",
};

export const dynamic = "force-dynamic";

export default function PerfilPage() {
  return (
    <ErrorBoundary label="gerenciador-de-perfis">
      <ProfileManager />
    </ErrorBoundary>
  );
}
