# App Academia

PWA offline-first para registrar treinos de musculação: catálogo de exercícios em português (wger), fichas prontas e personalizadas, registro de cargas/séries/repetições com observações, recordes pessoais (PR e 1RM estimado), gráficos de evolução e backup local em JSON.

## Comandos

| Comando | O que faz |
|---|---|
| `npm run dev -- --host` | Servidor de desenvolvimento. Abra no celular em `http://<IP-do-PC>:5173` (mesmo Wi-Fi). |
| `npm run build` | Checa tipos e gera a versão de produção em `dist/`. |
| `npm run preview -- --host` | Serve o `dist/` (modo produção/PWA). |
| `npm test` | Testes do banco, do seed, dos repositórios, evolução e backup (Vitest). |
| `npm run lint` | Análise estática (oxlint). |
| `npm run import:wger` | Rebaixa o catálogo da wger e infere equipamentos ausentes pelo nome. |

## Funcionalidades implementadas

### Fase 1 — MVP Offline-First
- **Catálogo wger empacotado:** 433 exercícios em português e 147 imagens locais (`public/exercise-images/`), funcionando 100% offline.
- **Inferência de equipamentos:** exercícios da wger que vinham sem equipamento cadastrado (como *Leg press*, *Cadeira extensora*, *Flexora*, *Hammer*) e exercícios criados pelo usuário recebem automaticamente o equipamento inferido pelo nome (`Máquina`, `Halteres`, `Barra`, `Polia`, `Anilha`, etc.).
- **Fichas prontas e editáveis (com Auto-save):** divisões **ABC (A/B/C)**, **Push / Pull / Legs** e **Full Body** criadas na primeira abertura, editor com **salvamento automático**, campos de **Séries, Reps e Peso (kg) planejado** por exercício e **criação rápida de exercícios fora da API** direto na montagem da ficha.
- **Treino ativo:** sugestão automática da última carga usada no exercício (ou peso da ficha), botões rápidos `-2,5` / `+2,5 kg` e cronômetro de descanso silencioso (visual + vibração).
- **Compatibilidade com rede local (HTTP):** gerador de UUID v4 (`newId()`) com fallback `crypto.getRandomValues` para funcionar tanto em `localhost`/HTTPS quanto pelo IP da rede Wi-Fi (`http://192.168.x.x:5173`).

### Fase 2 e 2.5 — Evolução, PRs, Backup e UX de Academia
- **Modo Sanfona (Accordion) e Barra de Progresso no Treino:** barra no topo mostrando a porcentagem de séries concluídas e recolhimento automático dos exercícios cuja meta de séries já foi atingida (`✓`), mantendo a tela limpa.
- **Substituir/Pular aparelho ocupado + Atualização automática da ficha:** botões `⇄ Trocar` e `Pular` para substituir ou remover um exercício apenas na sessão de hoje sem alterar sua ficha; e atualização automática do `targetWeightKg` da ficha ao finalizar o treino quando você supera a carga planejada.
- **Recordes Pessoais (PR) e 1RM estimado:** cálculo automático da maior carga histórica, melhor série e 1RM estimado pela fórmula de Epley ($\text{peso} \times (1 + \text{reps}/30)$), com destaque `🏆 PR` durante o treino.
- **Frequência Semanal + Aba "Minha Evolução" no Histórico:** calendário dos 7 dias da semana (`D S T Q Q S S`) marcando os dias treinados e aba dedicada com todos os exercícios já realizados, seus PRs e acesso direto ao gráfico SVG (`src/components/ProgressChart.tsx`).
- **Edição de séries, notas e exercícios próprios:** botão `✎` para editar peso, repetições ou observação (`note`) de qualquer série lançada, edição completa de exercícios próprios (`source: 'custom'`), ícones SVG na navegação inferior (`BottomNav.tsx`) e modais de confirmação próprios do app (`ConfirmDialog.tsx`).
- **Sugestão do próximo treino da sequência:** a tela inicial analisa o último treino finalizado e destaca automaticamente a próxima ficha da sua divisão (ex.: `ABC A → B → C → A`).
- **Backup em JSON:** exportação e importação completa dos dados locais na aba *Histórico*.

## Arquitetura

```
Telas (src/pages) → Repositórios (src/db/repositories) → Dexie/IndexedDB (src/db/db.ts)
```

## Deploy Automático no GitHub Pages (Etapa 2)

O projeto possui um workflow de CI/CD configurado em [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml):
- A cada `git push` na branch `main`, o GitHub Actions roda os testes (`npm test`), compila o PWA com `BASE_PATH: /App_academia/`, cria o fallback `404.html` para rotas do React Router e publica automaticamente no **GitHub Pages** com HTTPS gratuito.
- URL publicada: `https://vitoravellar.github.io/App_academia/`

## Próximas etapas planejadas

1. **Fase 3 — App Android (`.apk`) com Capacitor:** empacotar o `dist/` em um projeto Android nativo (`npx cap add android`).
2. **Fase 4 (Opcional) — Sincronização na nuvem com Supabase.**
