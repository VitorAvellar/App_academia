// Gera os ícones do app (PNG) sem depender de nenhuma biblioteca de imagem.
// Desenha um haltere branco sobre fundo azul-escuro, pixel a pixel, e grava como PNG
// (PNG = cabeçalho + dados comprimidos com zlib + CRC). Rode: `node scripts/make-icons.mjs`
import { writeFileSync, mkdirSync } from 'node:fs'
import { deflateSync } from 'node:zlib'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const publicDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'public')
mkdirSync(publicDir, { recursive: true })

const BG = [15, 23, 42] // slate-900
const FG = [248, 250, 252] // slate-50
const ACCENT = [34, 197, 94] // green-500

// ---- PNG mínimo (RGBA, 8 bits) ----
const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})
const crc32 = (buf) => {
  let c = 0xffffffff
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
const chunk = (type, data) => {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}
function encodePng(size, pixel) {
  const raw = Buffer.alloc((size * 4 + 1) * size)
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0 // filtro "nenhum" no início de cada linha
    for (let x = 0; x < size; x++) {
      const [r, g, b] = pixel(x / size, y / size)
      const o = y * (size * 4 + 1) + 1 + x * 4
      raw[o] = r
      raw[o + 1] = g
      raw[o + 2] = b
      raw[o + 3] = 255
    }
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // profundidade de bits
  ihdr[9] = 6 // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

// ---- Desenho do haltere em coordenadas 0..1 (independe do tamanho) ----
const inRect = (x, y, x0, y0, x1, y1) => x >= x0 && x <= x1 && y >= y0 && y <= y1
function pixel(x, y) {
  // Mantém tudo dentro da "zona segura" central (ícone maskable é cortado nas bordas).
  const bar = inRect(x, y, 0.3, 0.47, 0.7, 0.53)
  const innerPlates = inRect(x, y, 0.24, 0.34, 0.31, 0.66) || inRect(x, y, 0.69, 0.34, 0.76, 0.66)
  const outerPlates = inRect(x, y, 0.17, 0.4, 0.24, 0.6) || inRect(x, y, 0.76, 0.4, 0.83, 0.6)
  if (innerPlates) return ACCENT
  if (bar || outerPlates) return FG
  return BG
}

for (const size of [192, 512]) {
  writeFileSync(path.join(publicDir, `icon-${size}.png`), encodePng(size, pixel))
  console.log(`icon-${size}.png`)
}

