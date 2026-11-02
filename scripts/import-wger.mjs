// Importador do catálogo de exercícios da wger (https://wger.de).
//
// Por que um script e não uma chamada ao vivo no app?
//   - O app precisa funcionar OFFLINE na academia (sinal ruim).
//   - Rodamos isto UMA vez no PC: ele gera um JSON + imagens que entram no app.
//   - Para atualizar o catálogo, basta rodar de novo: `npm run import:wger`.
//
// Usamos o `fetch` nativo do Node (>= 18), que decodifica UTF-8 corretamente.

import { mkdir, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const API = 'https://wger.de/api/v2'
const PT_LANGUAGE_ID = 7 // idioma "pt" na wger (descoberto em /api/v2/language/)
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const IMAGES_DIR = path.join(root, 'public', 'exercise-images')
const OUT_JSON = path.join(root, 'src', 'data', 'exercises.pt.json')

// Categoria da wger (inglês) -> grupo muscular em português usado no app.
const CATEGORY_PT = {
  Legs: 'Pernas',
  Back: 'Costas',
  Arms: 'Braços',
  Shoulders: 'Ombros',
  Abs: 'Abdômen',
  Chest: 'Peito',
  Cardio: 'Cardio',
  Calves: 'Panturrilha',
}

// Equipamento da wger (inglês) -> português.
const EQUIPMENT_PT = {
  'none (bodyweight exercise)': 'Peso do corpo',
  Dumbbell: 'Halteres',
  'Cable machine': 'Polia',
  Barbell: 'Barra',
  Bench: 'Banco',
  'Pull-up bar': 'Barra fixa',
  'Resistance band': 'Elástico',
  'Incline bench': 'Banco inclinado',
  'SZ-Bar': 'Barra W',
  Kettlebell: 'Kettlebell',
  'Gym mat': 'Colchonete',
  'Swiss Ball': 'Bola suíça',
}

/**
 * Alguns exercícios na wger (ex.: "Leg press", "Cadeira extensora", "Supino declinado na Hammer")
 * vêm com `equipment: []`. Quando a lista vem vazia, inferimos pelo nome em português.
 */
function inferEquipmentFromName(name) {
  const inferred = []
  if (/m[aáã]quina|leg press|hack|extensora|flexora|hammer|smith|peck|voador|adutora|abdutora|graviton/i.test(name)) {
    inferred.push('Máquina')
  }
  if (/halter/i.test(name)) inferred.push('Halteres')
  if (/barra fixa/i.test(name)) {
    inferred.push('Barra fixa')
  } else if (/\bbarra\b/i.test(name)) {
    inferred.push('Barra')
  }
  if (/polia|cabo|cross[- ]?over/i.test(name)) inferred.push('Polia')
  if (/kettlebell/i.test(name)) inferred.push('Kettlebell')
  if (/anilha/i.test(name)) inferred.push('Anilha')
  if (/el[aá]stico|banda/i.test(name)) inferred.push('Elástico')
  if (/banco/i.test(name)) inferred.push('Banco')
  return inferred
}

// Músculos (nome em inglês da wger, campo `name_en`) -> português.
const MUSCLE_PT = {
  Abs: 'Abdômen',
  'Serratus anterior': 'Serrátil anterior',
  'Obliquus externus abdominis': 'Oblíquos',
  Shoulders: 'Ombros',
  Glutes: 'Glúteos',
  Quads: 'Quadríceps',
  Trapezius: 'Trapézio',
  Soleus: 'Sóleo',
  Hamstrings: 'Posteriores de coxa',
  Calves: 'Panturrilhas',
  Lats: 'Dorsais',
  Biceps: 'Bíceps',
  Triceps: 'Tríceps',
  Chest: 'Peitoral',
  Brachialis: 'Braquial',
}
const muscleName = (m) => MUSCLE_PT[m.name_en] ?? MUSCLE_PT[m.name] ?? m.name_en ?? m.name

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/** fetch com tentativas: APIs públicas às vezes falham ou limitam requisições. */
async function fetchRetry(url, tries = 4) {
  for (let i = 1; i <= tries; i++) {
    try {
      const res = await fetch(url)
      if (res.ok) return res
      throw new Error(`HTTP ${res.status}`)
    } catch (err) {
      if (i === tries) throw new Error(`Falhou ao buscar ${url}: ${err.message}`)
      await sleep(1000 * i)
    }
  }
}

/** Converte o HTML da descrição (<ol><li>…) em texto simples. */
function htmlToText(html) {
  return html
    .replace(/<li>/gi, '• ')
    .replace(/<\/(li|p|ol|ul)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/** Percorre todas as páginas do endpoint (a API pagina com `next`). */
async function fetchAllExercises() {
  const all = []
  let url = `${API}/exerciseinfo/?limit=100`
  while (url) {
    const data = await (await fetchRetry(url)).json()
    all.push(...data.results)
    console.log(`  baixados ${all.length}/${data.count}`)
    url = data.next
    await sleep(300) // gentileza com o servidor público
  }
  return all
}

async function downloadImage(url, dest) {
  if (existsSync(dest)) return // já baixada: não repete
  const buf = Buffer.from(await (await fetchRetry(url)).arrayBuffer())
  await writeFile(dest, buf)
}

async function main() {
  await mkdir(IMAGES_DIR, { recursive: true })
  await mkdir(path.dirname(OUT_JSON), { recursive: true })

  console.log('Buscando exercícios na wger...')
  const raw = await fetchAllExercises()

  const exercises = []
  let imageCount = 0

  for (const ex of raw) {
    const pt = ex.translations.find((t) => t.language === PT_LANGUAGE_ID)
    if (!pt || !pt.name?.trim()) continue // só exercícios traduzidos

    // Imagem principal (se houver); usamos a miniatura "medium" (400px) para economizar espaço.
    const img = ex.images.find((i) => i.is_main) ?? ex.images[0]
    let imagePath
    if (img) {
      const src = img.thumbnails?.medium ?? img.image
      const ext = path.extname(new URL(src).pathname) || '.png'
      const file = `${ex.uuid}${ext}`
      try {
        await downloadImage(src, path.join(IMAGES_DIR, file))
        imagePath = `exercise-images/${file}`
        imageCount++
      } catch (err) {
        console.warn(`  imagem ignorada (${pt.name}): ${err.message}`)
      }
    }

    exercises.push({
      wgerUuid: ex.uuid,
      name: pt.name.trim(),
      muscleGroup: CATEGORY_PT[ex.category?.name] ?? ex.category?.name ?? 'Outros',
      musclesPrimary: ex.muscles.map(muscleName),
      musclesSecondary: ex.muscles_secondary.map(muscleName),
      equipment:
        ex.equipment.length > 0
          ? ex.equipment.map((e) => EQUIPMENT_PT[e.name] ?? e.name)
          : inferEquipmentFromName(pt.name),
      description: htmlToText(pt.description ?? ''),
      imagePath,
      // CC-BY-SA exige crédito: guardamos autor e licença para a tela "Créditos".
      licenseAuthor: pt.license_author || ex.license_author || undefined,
      license: ex.license?.short_name,
    })
  }

  exercises.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
  await writeFile(OUT_JSON, JSON.stringify(exercises, null, 2) + '\n', 'utf8')

  console.log(`\nPronto: ${exercises.length} exercícios, ${imageCount} imagens.`)
  console.log(`JSON: ${path.relative(root, OUT_JSON)}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

