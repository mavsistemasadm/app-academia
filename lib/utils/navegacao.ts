import {
  Activity,
  CalendarDays,
  ClipboardList,
  Droplets,
  Dumbbell,
  Heart,
  HeartHandshake,
  Home,
  LayoutDashboard,
  LineChart,
  MessageSquare,
  Pill,
  Sparkles,
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

/** Barra inferior do mobile — 5 abas, conforme o mockup. */
export const NAV_MOBILE: ItemNav[] = [
  { href: '/home', label: 'Início', icone: Home },
  { href: '/treino', label: 'Treino', icone: Dumbbell },
  { href: '/indicadores', label: 'Saúde', icone: Activity },
  { href: '/remedios', label: 'Remédios', icone: Pill },
  { href: '/perfil', label: 'Perfil', icone: User },
]

/** Sidebar do desktop — agrupada em seções. */
export const NAV_DESKTOP: { secao: string; itens: ItemNav[] }[] = [
  {
    secao: 'Principal',
    itens: [
      { href: '/home', label: 'Início', icone: Home },
      { href: '/treino', label: 'Meu treino', icone: Dumbbell },
      { href: '/indicadores', label: 'Indicadores', icone: Activity },
      { href: '/remedios', label: 'Remédios', icone: Pill },
    ],
  },
  {
    secao: 'Saúde',
    itens: [
      { href: '/evolucao', label: 'Evolução', icone: LineChart },
      { href: '/humor', label: 'Meu humor', icone: Heart },
      { href: '/hidratacao', label: 'Hidratação', icone: Droplets },
      { href: '/bem-estar', label: 'Bem-estar', icone: Sparkles },
      { href: '/conquistas', label: 'Conquistas', icone: Trophy },
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
      { href: '/familiares', label: 'Familiares', icone: Users },
      { href: '/acompanhar', label: 'Acompanhar alguém', icone: HeartHandshake },
    ],
  },
]

/** Abas do painel do professor. */
export const NAV_PROFESSOR: ItemNav[] = [
  { href: '/dashboard', label: 'Painel', icone: LayoutDashboard },
  { href: '/alunos', label: 'Alunos', icone: Users },
  { href: '/treinos', label: 'Treinos', icone: Dumbbell },
  { href: '/agenda-professor', label: 'Agenda', icone: CalendarDays },
  { href: '/presenca', label: 'Presença', icone: Activity },
]
