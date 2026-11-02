# App Academia

PWA para registrar treinos de musculação: catálogo de exercícios (wger), fichas, cargas, séries e repetições. Funciona offline e guarda os dados só no seu aparelho.

## Comandos

| Comando | O que faz |
|---|---|
| `npm run dev -- --host` | Servidor de desenvolvimento. Abra no celular em `http://<IP-do-PC>:5173` (mesmo Wi-Fi). |
| `npm run build` | Checa tipos e gera a versão de produção em `dist/`. |
| `npm run preview` | Serve o `dist/` (aqui o modo offline/PWA funciona de verdade). |
| `npm test` | Testes do banco, do seed e dos repositórios (Vitest). |
| `npm run lint` | Análise estática (oxlint). |
| `npm run import:wger` | Rebaixa o catálogo da wger (ver abaixo). |

## Arquitetura

```
Telas (src/pages) → Repositórios (src/db/repositories) → Dexie/IndexedDB (src/db/db.ts)
```

- `src/db/types.ts`: tipos `Exercise`, `WorkoutTemplate`, `WorkoutSession`, `SetLog`.
- `src/db/seed.ts`: importa o catálogo para o banco (merge por `wgerUuid`, sem duplicar).
- `src/db/templates.seed.ts`: fichas prontas (ABC, Push/Pull/Legs, Full Body).
- `src/store/restTimer.ts`: estado do cronômetro de descanso (Zustand).
- `scripts/import-wger.mjs`: baixa exercícios e imagens da wger → `src/data/exercises.pt.json` e `public/exercise-images/`.
- `scripts/make-icons.mjs`: gera os ícones PNG do PWA.

## Catálogo (wger)

O catálogo é gerado **uma vez** no PC e empacotado no app, então o celular não consulta a API.
Para atualizar: `npm run import:wger` (as imagens já baixadas são reaproveitadas).

Conteúdo da wger sob licença **CC-BY-SA**; os autores aparecem na tela *Créditos*.

## Próximos passos

1. Gráficos de evolução de carga e recordes pessoais (PR).
2. Exportar/importar backup em JSON.
3. Android com Capacitor (`npm i @capacitor/core @capacitor/cli @capacitor/android`, `npx cap add android`).
