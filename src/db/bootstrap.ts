import { seedExercises } from './seed'
import { seedTemplates } from './templates.seed'
import { db } from './db'
import type { CatalogEntry } from './types'

/**
 * Prepara o banco na abertura do app: importa o catálogo (se mudou) e cria as fichas
 * prontas (só na primeira vez). É rápido nas aberturas seguintes graças à "assinatura".
 */
export async function bootstrap(): Promise<void> {
  // import() dinâmico: o JSON grande do catálogo vira um arquivo separado (chunk),
  // baixado só quando esta função roda, em vez de engordar o JavaScript principal.
  const { default: catalog } = await import('../data/exercises.pt.json')
  await seedExercises(db, catalog as CatalogEntry[])
  await seedTemplates(db)
  // Pede ao navegador para NÃO apagar os dados do app por falta de espaço.
  // Em HTTP na rede local (fora de HTTPS/localhost), `navigator.storage` pode não existir.
  try {
    await navigator.storage?.persist?.()
  } catch {
    // Ignora caso o navegador recuse em contexto não-seguro.
  }
}
