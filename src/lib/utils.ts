/** Gera um id único no navegador (UUID v4). Não depende de servidor. */
export const newId = (): string => crypto.randomUUID()

/**
 * Normaliza texto para comparação: minúsculas, sem acentos e sem pontuação.
 * "Supino Inclinado com Halteres." e "supino inclinado com halteres" viram iguais.
 */
export function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove os acentos separados pelo NFD
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

