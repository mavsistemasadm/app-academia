import type { RegistroIndicador } from '@/lib/utils/indicadores'

export type Role = 'aluno' | 'professor' | 'familiar'

export type AvatarCondicao =
  | 'diabetico'
  | 'hipertenso'
  | '60+'
  | 'colesterol'
  | 'menopausa'
  | 'performance'
  | 'adolescente'
  | 'gestante'
  | 'cardiopata'
  | 'obesidade'

export type SemaforoStatus = 'verde' | 'amarelo' | 'vermelho'

export type HumorTipo =
  | 'otimo'
  | 'disposto'
  | 'cansado'
  | 'dormiu_mal'
  | 'enfermo'
  | 'ansioso'

export type IndicadorTipo =
  | 'glicemia'
  | 'pressao'
  | 'peso'
  | 'fc'
  | 'saturacao'

export type IndicadorMomento =
  | 'jejum'
  | 'pos_refeicao'
  | 'pre_treino'
  | 'pos_treino'
  | 'repouso'

export type MedicamentoStatus = 'tomou' | 'nao_tomou' | 'adiou'

export type AlertaTipo =
  | 'indicador_vermelho'
  | 'medicamento_nao_tomado'
  | 'humor_ruim'
  | 'sem_treinar'

// ── Database types ──────────────────────────────────────────────

export interface Profile {
  id: string
  nome: string
  email: string
  telefone?: string
  foto_url?: string
  data_nascimento?: string
  role: Role
  /** Lista: diabético + hipertenso + 60+ é a combinação mais comum da casa. */
  avatar_condicao?: AvatarCondicao[]
  observacoes_clinicas?: string
  familiar_nome?: string
  familiar_telefone?: string
  medico_nome?: string
  medico_telefone?: string
  meta_agua_ml?: number
  ativo?: boolean
  push_subscription?: PushSubscriptionJSON
  created_at: string
}

export interface Treino {
  id: string
  professor_id: string
  aluno_id: string
  nome: string
  descricao?: string
  dia_semana: string[]
  ativo: boolean
  created_at: string
  exercicios?: Exercicio[]
}

export interface Exercicio {
  id: string
  treino_id: string
  nome: string
  series?: number
  repeticoes?: string
  carga?: string
  descanso?: string
  video_url?: string
  ordem: number
  observacoes?: string
}

export interface TreinoExecucao {
  id: string
  treino_id: string
  aluno_id: string
  data: string
  concluido: boolean
  esforco_percebido?: number
  observacao?: string
  created_at: string
  /** Migração 008 — primeira série marcada. Ausente antes de aplicar. */
  iniciado_em?: string | null
  /** Migração 008 — quando o aluno concluiu o treino. */
  concluido_em?: string | null
  /** Migração 008 — concluido_em - iniciado_em, em segundos. */
  duracao_segundos?: number | null
}

export interface Medicamento {
  id: string
  aluno_id: string
  nome: string
  dose?: string
  horarios: string[]
  dias_semana?: string[]
  condicao?: string
  foto_url?: string
  ativo: boolean
  created_at: string
}

export interface MedicamentoConfirmacao {
  id: string
  medicamento_id: string
  aluno_id: string
  data_hora: string
  /** Dia da academia, `YYYY-MM-DD`. */
  data: string
  /** Horário previsto da dose, `HH:MM` — é o que identifica a dose. */
  horario?: string
  status: MedicamentoStatus
  motivo?: string
}

export interface Indicador {
  id: string
  aluno_id: string
  tipo: IndicadorTipo
  valor_principal: number
  valor_secundario?: number
  unidade?: string
  momento?: IndicadorMomento
  status_semaforo?: SemaforoStatus
  alerta_enviado: boolean
  observacao?: string
  created_at: string
}

export interface HumorDiario {
  id: string
  aluno_id: string
  data: string
  humor: HumorTipo
  qualidade_sono?: number
  observacao?: string
  created_at: string
}

export interface Evento {
  id: string
  professor_id: string
  titulo: string
  descricao?: string
  data_inicio: string
  data_fim?: string
  para_todos: boolean
  avatar_condicao?: AvatarCondicao[]
  created_at: string
}

export interface Mensagem {
  id: string
  de: string
  para: string
  texto?: string
  audio_url?: string
  lida: boolean
  created_at: string
  perfil_de?: Profile
}

export interface AvaliacaoFisica {
  id: string
  aluno_id: string
  professor_id: string
  data: string
  peso?: number
  altura?: number
  imc?: number
  percentual_gordura?: number
  massa_muscular?: number
  circunferencia_cintura?: number
  circunferencia_quadril?: number
  teste_forca?: string
  observacoes?: string
  created_at: string
}

export interface AlertaProfessor {
  id: string
  professor_id: string
  aluno_id: string
  tipo: AlertaTipo
  mensagem: string
  dados?: Record<string, unknown>
  resolvido: boolean
  created_at: string
  aluno?: PerfilResumo
}

/**
 * O tanto de perfil que os joins trazem — as telas de lista só precisam de
 * nome e foto, e pedir a linha inteira exporia dados clínicos sem motivo.
 */
export type PerfilResumo = Pick<Profile, 'id' | 'nome'> &
  Partial<Pick<Profile, 'foto_url' | 'avatar_condicao'>>

/** Uma série concluída — o granular que `treino_execucoes` não guarda. */
export interface ExercicioExecucao {
  id: string
  execucao_id: string
  exercicio_id: string
  aluno_id: string
  serie: number
  carga?: string
  repeticoes?: string
  created_at: string
}

export interface Checkin {
  id: string
  aluno_id: string
  data: string
  entrada: string
  saida?: string
  origem?: string
  aluno?: PerfilResumo
}

export type FamiliarStatus = 'pendente' | 'ativo' | 'revogado'

export interface FamiliarAcesso {
  id: string
  aluno_id: string
  familiar_id?: string
  nome: string
  email: string
  parentesco?: string
  codigo: string
  status: FamiliarStatus
  created_at: string
  aceito_em?: string
  aluno?: PerfilResumo
}

export interface Anamnese {
  id: string
  aluno_id: string
  doencas?: string[]
  cirurgias?: string
  lesoes?: string
  alergias?: string
  medicamentos_uso?: string
  historico_familiar?: string
  pratica_atividade?: string
  fumante?: boolean
  consumo_alcool?: string
  qualidade_sono?: string
  objetivo?: string
  restricoes_medicas?: string
  liberado_por_medico?: boolean
  observacoes?: string
  /** Migração 011: chave = id da pergunta em `anamnese_perguntas`. */
  respostas?: Record<string, unknown>
  atualizado_em: string
  created_at: string
}

export interface HidratacaoRegistro {
  id: string
  aluno_id: string
  data: string
  quantidade_ml: number
  created_at: string
}

export interface AlunoConquista {
  aluno_id: string
  chave: string
  conquistada_em: string
  vista: boolean
}

export interface Notificacao {
  id: string
  professor_id: string
  titulo: string
  corpo: string
  para_todos: boolean
  avatar_condicao?: AvatarCondicao[]
  created_at: string
}

export interface EventoConfirmacao {
  evento_id: string
  aluno_id: string
  confirmado: boolean
}

export type ExameTipo =
  | 'laboratorial'
  | 'ressonancia'
  | 'ultrassom'
  | 'raio_x'
  | 'tomografia'
  | 'eletrocardiograma'
  | 'ecocardiograma'
  | 'densitometria'
  | 'outros'

/** Exame enviado pelo aluno (migração 007). O arquivo mora no bucket privado `exames`. */
export interface Exame {
  id: string
  aluno_id: string
  tipo: ExameTipo
  /** Obrigatório quando `tipo = 'outros'`. */
  tipo_outro?: string | null
  titulo?: string | null
  /** `YYYY-MM-DD`. */
  data_exame: string
  /** Caminho dentro do bucket: `<aluno_id>/<uuid>-<nome>`. */
  arquivo_path: string
  arquivo_nome?: string | null
  mime?: string | null
  tamanho_bytes?: number | null
  observacao?: string | null
  created_at: string
}

/** Link público com prazo que o aluno manda ao médico. */
export interface ExameCompartilhamento {
  id: string
  aluno_id: string
  token: string
  criado_em: string
  expira_em?: string | null
  revogado: boolean
}

// ── UI types ────────────────────────────────────────────────────

export interface SaudacaoData {
  saudacao: string
  frase: string
  alertas: string[]
}

export interface DashboardAlunoData {
  profile: Profile
  treinoHoje?: Treino
  /**
   * O mais recente de cada tipo, já resumido: o peso precisa vir com o
   * semáforo do IMC, e não com o verde que o gatilho do banco grava.
   */
  indicadores: Partial<Record<IndicadorTipo, RegistroIndicador>>
  medicamentosPendentes: Medicamento[]
  humorHoje?: HumorDiario
  treinosNaSemana: number
}

export interface DashboardProfessorAluno {
  profile: Profile
  status: SemaforoStatus
  treinouHoje: boolean
  humorHoje?: HumorDiario
  ultimoIndicador?: Indicador
  medicamentoConfirmado: boolean | null
  alertas: AlertaProfessor[]
}
