import {
  HeartPulse,
  Syringe,
  Scale,
  Baby,
  Milk,
  Images,
  CalendarDays,
  Bell,
  Wallet,
  ShoppingBasket,
  Star,
  Sparkles,
  Users,
  Download,
  Settings2,
  Home,
  Bath,
  UtensilsCrossed,
  ShieldCheck,
  HandCoins,
  Camera,
  type LucideProps,
} from "lucide-react";
import { PawIcon } from "./PawIcon";

/**
 * Ícones de UI do cuidadim — v2.
 *
 * O que mudou desde a v1:
 *  - IconPets agora usa a patinha própria (PawIcon), não mais o gato do
 *    Lucide — ver PawIcon.tsx pra entender o porquê.
 *  - +5 ícones pra módulos que apareceram nos PRs/migrations do repo e
 *    não estavam listados antes: higiene, alimentação, protocolo
 *    preventivo, plano de saúde/copay, fotos do pet.
 *
 * Regra de cor continua a mesma (ver lib/brand/colors.ts):
 * stroke sempre roxo, dourado só via prop `active`.
 */

const DEFAULT_PROPS: Partial<LucideProps> = {
  strokeWidth: 2,
  size: 20,
  color: "#2A1F2F", // cuidadim.roxo
};

type IconProps = LucideProps & { active?: boolean };

function withActiveColor({ active, color, ...props }: IconProps) {
  return {
    ...DEFAULT_PROPS,
    ...props,
    color: color ?? (active ? "#CCA863" /* cuidadim.dourado */ : DEFAULT_PROPS.color),
  };
}

// --- já existiam na v1 ---
export const IconHome = (props: IconProps) => <Home {...withActiveColor(props)} />;
export const IconSaude = (props: IconProps) => <HeartPulse {...withActiveColor(props)} />;
export const IconVacina = (props: IconProps) => <Syringe {...withActiveColor(props)} />;
export const IconPeso = (props: IconProps) => <Scale {...withActiveColor(props)} />;
export const IconNeonatal = (props: IconProps) => <Baby {...withActiveColor(props)} />;
export const IconMamada = (props: IconProps) => <Milk {...withActiveColor(props)} />;
export const IconMemorias = (props: IconProps) => <Images {...withActiveColor(props)} />;
export const IconAgenda = (props: IconProps) => <CalendarDays {...withActiveColor(props)} />;
export const IconLembrete = (props: IconProps) => <Bell {...withActiveColor(props)} />;
export const IconDespesas = (props: IconProps) => <Wallet {...withActiveColor(props)} />;
export const IconCompras = (props: IconProps) => <ShoppingBasket {...withActiveColor(props)} />;
export const IconAvaliacao = (props: IconProps) => <Star {...withActiveColor(props)} />;
export const IconAssistente = (props: IconProps) => <Sparkles {...withActiveColor(props)} />;
export const IconFamilia = (props: IconProps) => <Users {...withActiveColor(props)} />;
export const IconExportar = (props: IconProps) => <Download {...withActiveColor(props)} />;
export const IconSettings = (props: IconProps) => <Settings2 {...withActiveColor(props)} />;

// --- trocado na v2 ---
/** Pets — agora a patinha própria, não o gato genérico do Lucide. */
export const IconPets = ({ active, color, size, strokeWidth, ...rest }: IconProps) => {
  const p = withActiveColor({ active, color, size, strokeWidth, ...rest });
  return <PawIcon color={p.color as string} size={p.size as number} strokeWidth={p.strokeWidth as number} />;
};

// --- novos na v2, achados nos PRs/migrations do repo ---
/** Higiene do pet (banho, tosa, escovação). */
export const IconHigiene = (props: IconProps) => <Bath {...withActiveColor(props)} />;
/** Alimentação (migration 0036, separado do neonatal). */
export const IconAlimentacao = (props: IconProps) => <UtensilsCrossed {...withActiveColor(props)} />;
/** Protocolo preventivo — vacinas core + overrides por pet (migration 0029). */
export const IconProtocolo = (props: IconProps) => <ShieldCheck {...withActiveColor(props)} />;
/** Plano de saúde / guia de coparticipação (PR #18). */
export const IconPlanoSaude = (props: IconProps) => <HandCoins {...withActiveColor(props)} />;
/** Foto de perfil do pet (memory_media é outra coisa — isso é a foto de capa). */
export const IconFotoPet = (props: IconProps) => <Camera {...withActiveColor(props)} />;
