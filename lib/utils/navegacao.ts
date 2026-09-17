import {
  Activity,
  CalendarDays,
  ClipboardList,
  Droplets,
  Dumbbell,
  FileHeart,
  Heart,
  HeartHandshake,
  Home,
  LayoutDashboard,
  LineChart,
  MessageSquare,
  Pill,
  Sparkles,
  Flame,
  Trophy,
  User,
  Users,
  type LucideIcon,
} from 'lucide-react'

export interface ItemNav {
  href: string
  label: string
  icone: LucideIcon
}

/**
 * Barra inferior do celular: as 4 telas do dia a dia. A quinta posição é o
 * botão "Mais", que abre a folha com todo o resto (ver BottomNav).
 */
export const NAV_MOBILE: ItemNav[] = [
  { href: '/home', label: 'Início', icone: Home },
  { href: '/treino', label: 'Treino', icone: Dumbbell },
  { href: '/indicadores', label: 'Saúde', icone: Activity },
  { href: '/medicamentos', label: 'Medicamentos', icone: Pill },
]

const TITULOS: Record<string, string> = {
  '/home': 'Início',
  '/treino': 'Treino',
  '/indicadores': 'Indicadores',
  '/medicamentos': 'Medicamentos',
  '/evolucao': 'Evolução',
  '/exames': 'Exames',
  '/humor': 'Meu humor',
  '/hidratacao': 'Hidratação',
  '/bem-estar': 'Bem-estar',
  '/conquistas': 'Conquistas',
  '/desafios': 'Desafios',
  '/agenda': 'Agenda',
  '/chat': 'Conversas',
  '/anamnese': 'Anamnese',
  '/perfil': 'Perfil',
  '/familiares': 'Dar acesso à família',
  '/acompanhar': 'Acompanhar um familiar',
  '/relatorio': 'Relatório',
}

/** Título curto da tela para a barra de topo do celular. */
export function tituloDaRota(pathname: string): string {
  return TITULOS[`/${pathname.split('/')[1] ?? ''}`] ?? 'Atitude Vital'
}

/** Sidebar do desktop — agrupada em seções. */
export const NAV_DESKTOP: { secao: string; itens: ItemNav[] }[] = [
  {
    secao: 'Principal',
    itens: [
      { href: '/home', label: 'Início', icone: Home },
      { href: '/treino', label: 'Meu treino', icone: Dumbbell },
      { href: '/indicadores', label: 'Indicadores', icone: Activity },
      { href: '/medicamentos', label: 'Medicamentos', icone: Pill },
    ],
  },
  {
    secao: 'Saúde',
    itens: [
      { href: '/evolucao', label: 'Evolução', icone: LineChart },
      { href: '/exames', label: 'Exames', icone: FileHeart },
      { href: '/humor', label: 'Meu humor', icone: Heart },
      { href: '/hidratacao', label: 'Hidratação', icone: Droplets },
      { href: '/bem-estar', label: 'Bem-estar', icone: Sparkles },
      { href: '/conquistas', label: 'Conquistas', icone: Trophy },
      { href: '/desafios', label: 'Desafios', icone: Flame },
    ],
  },
  {
    secao: 'Centro',
    itens: [
      { href: '/agenda', label: 'Agenda', icone: CalendarDays },
      { href: '/chat', label: 'Chat', icone: MessageSquare },
      { href: '/anamnese', label: 'Anamnese', icone: ClipboardList },
    ],
  },
  {
    secao: 'Conta',
    itens: [
      { href: '/perfil', label: 'Perfil', icone: User },
      { href: '/familiares', label: 'Dar acesso à família', icone: Users },
      { href: '/acompanhar', label: 'Acompanhar um familiar', icone: HeartHandshake },
    ],
  },
]

/** Abas do painel do professor. */
export const NAV_PROFESSOR: ItemNav[] = [
  { href: '/dashboard', label: 'Painel', icone: LayoutDashboard },
  { href: '/alunos', label: 'Alunos', icone: Users },
  { href: '/treinos', label: 'Treinos', icone: Dumbbell },
  { href: '/agenda-professor', label: 'Agenda', icone: CalendarDays },
  { href: '/desafios-professor', label: 'Desafios', icone: Trophy },
  { href: '/presenca', label: 'Presença', icone: Activity },
]
