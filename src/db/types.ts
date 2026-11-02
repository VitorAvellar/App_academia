// Tipos do domínio. Ficam num arquivo único e sem dependências para que
// qualquer camada (banco, repositórios, telas) possa importá-los.

/** Um exercício do catálogo (vindo da wger ou criado por você). */
export interface Exercise {
  /** UUID gerado no cliente — facilita sincronizar com a nuvem no futuro. */
  id: string
  /** UUID do exercício na wger. Usado para fazer "merge" ao reimportar o catálogo. */
  wgerUuid?: string
  name: string
  /** Grupo muscular em português (Peito, Costas, Pernas...). */
  muscleGroup: string
  musclesPrimary: string[]
  musclesSecondary: string[]
  equipment: string[]
  description: string
  /** Caminho relativo à pasta public/, ex.: "exercise-images/abc.jpg". */
  imagePath?: string
  source: 'wger' | 'custom'
  /** Crédito exigido pela licença CC-BY-SA (tela "Créditos"). */
  licenseAuthor?: string
  license?: string
}

/** Item de uma ficha: qual exercício e a meta de séries/repetições/carga. */
export interface TemplateItem {
  exerciseId: string
  targetSets: number
  /** Texto livre, ex.: "8-12" ou "10". */
  targetReps: string
  /** Carga planejada em kg (opcional, ex.: 60 ou 22.5). */
  targetWeightKg?: number
}

/** Ficha de treino (ex.: "Treino A – Peito/Tríceps"). */
export interface WorkoutTemplate {
  id: string
  name: string
  description?: string
  items: TemplateItem[]
  createdAt: number
}

/** Um treino realizado (uma ida à academia). */
export interface WorkoutSession {
  id: string
  templateId?: string
  /** Nome copiado da ficha, para o histórico continuar legível mesmo se a ficha mudar. */
  name: string
  /** Exercícios adicionados durante o treino (fora da ficha, ou todos, no treino livre). */
  extraExerciseIds?: string[]
  /** Exercícios da ficha pulados ou substituídos apenas nesta sessão. */
  skippedExerciseIds?: string[]
  startedAt: number
  finishedAt?: number
}

/** Uma série executada: peso x repetições. */
export interface SetLog {
  id: string
  sessionId: string
  exerciseId: string
  setNumber: number
  weightKg: number
  reps: number
  note?: string
  /** Quando a série foi registrada (ms desde 1970). */
  loggedAt: number
}

/** Formato dos itens em src/data/exercises.pt.json (gerado pelo importador). */
export type CatalogEntry = Omit<Exercise, 'id' | 'source'>

