/**
 * Gera um id único no navegador (UUID v4) sem depender de servidor.
 *
 * Por que não chamar só `crypto.randomUUID()`?
 * Os navegadores bloqueiam `crypto.randomUUID()` fora de "Contexto Seguro" (HTTPS ou localhost).
 * Quando você abre o app no celular pelo IP da rede Wi-Fi (`http://192.168.x.x:5173`),
 * o navegador está em HTTP comum e `crypto.randomUUID` vira `undefined`.
 * Já `crypto.getRandomValues()` funciona mesmo em HTTP, então montamos o UUID v4 (RFC 4122)
 * a partir de 16 bytes aleatórios.
 */
export function newId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  const bytes = new Uint8Array(16)
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(bytes)
  } else {
    for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256)
  }
  // Ajusta os bits da versão 4 (0100xxxx) e da variante RFC 4122 (10xxxxxx).
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

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
