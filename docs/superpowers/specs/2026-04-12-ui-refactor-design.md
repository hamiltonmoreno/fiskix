# Fiskix UI Refactor — Design Spec
**Data:** 2026-04-12  
**Âmbito:** Refactor completo de UI/UX com shadcn/ui — desktop (gestor/diretor) e mobile PWA (fiscal)

---

## Contexto

O Fiskix está funcional com Fases 1 e 2 completas. A UI actual usa Tailwind puro com componentes dispersos sem padrão comum. O objectivo é adoptar shadcn/ui como base de componentes, actualizar a identidade visual para Slate & Indigo, e melhorar os fluxos críticos de gestor e fiscal.

---

## 1. Design System

### Biblioteca de componentes
Adoptar **shadcn/ui** (abordagem copy-paste — componentes ficam em `src/components/ui/`).

Componentes a instalar:
- `Button` — substitui todos os botões inline com classes Tailwind
- `Badge` — substitui spans de status/score manuais
- `Card` — substitui divs `bg-white rounded-xl border` nos KPIs e painéis
- `Table` — base para `TabelaAlertas` e todas as tabelas admin
- `Sheet` — painel lateral deslizante para detalhe de alertas
- `Dialog` — para confirmações destrutivas (ex: "Confirmar envio SMS?"). **Não** substitui `AlertaDetalheModal` — esse migra para Sheet (ver secção 3)
- `Input` e `Select` — formulários e filtros
- `Tabs` — página `/relatorios` e outras com tabs
- `Skeleton` — substitui todos os `animate-pulse` manuais
- `Toast` (Sonner) — feedback de acções (SMS enviado, ordem criada, etc.)
- `Progress` — barra de progresso do roteiro mobile

### Paleta de cores — Slate & Indigo
Actualizar `src/app/globals.css`:

| Token CSS | Valor actual | Novo valor |
|---|---|---|
| `--primary` | `221.2 83.2% 53.3%` (blue) | `239 84% 67%` (indigo `#4f46e5`) |
| `--primary-foreground` | `210 40% 98%` | `0 0% 100%` |
| `--sidebar-bg` | (não existe) | `222 47% 11%` (slate-900 `#0f172a`) |
| `--sidebar-fg` | (não existe) | `215 16% 47%` (slate-400) |
| `--sidebar-active-bg` | (não existe) | `239 84% 67%` (indigo) |

Manter os tokens Fiskix existentes (`--fiskix-danger`, `--fiskix-warning`, `--fiskix-success`) — são usados nos badges de score e status, não mudam.

### Ficheiro de componentes partilhados
```
src/components/ui/          ← componentes shadcn (gerados via CLI)
src/components/Sidebar.tsx  ← actualizar para sidebar dark
src/components/Breadcrumb.tsx ← actualizar com shadcn/ui se necessário
```

---

## 2. Dashboard (`/dashboard`)

### Layout actual
Stack vertical: KPIs → mapa (100%) → gráfico (100%) → tabela alertas.

### Novo layout
```
┌─────────────────────────────────────────────────┐
│  KPI Card  │  KPI Card  │  KPI Card  │  KPI Card │  ← 4 colunas, com delta ↑/↓
├─────────────────────────┬───────────────────────┤
│                         │  Alertas Críticos     │
│   Mapa React Leaflet    │  (lista top 5,        │  ← 60% / 40%
│   (interativo)          │   score ≥ 75)         │
├─────────────────────────┴───────────────────────┤
│   Gráfico TendenciaPerdas 12 meses (100%)        │
└─────────────────────────────────────────────────┘
```

### Alterações aos KPI Cards
- Adicionar linha de delta vs mês anterior (ex: `↑ +12% vs Mar`) com cor (vermelho se pior, verde se melhor)
- Usar `shadcn/ui Card` como base
- Skeleton de loading substitui `animate-pulse` manual

### Painel "Alertas Críticos" (novo)
- Lista dos top 5 alertas com score ≥ 75 do mês actual
- Cada item: nome cliente, score (Badge), status (Badge)
- Clicar navega para `/alertas` com filtro pré-aplicado
- Dados já disponíveis no hook `useDashboard` — sem nova query necessária

---

## 3. Alertas (`/alertas`)

### Padrão de interacção
Substituir o modal centrado (`AlertaDetalheModal`) por um **Sheet lateral** (shadcn/ui `Sheet`).

**Comportamento:**
- Clicar numa linha da tabela abre o Sheet à direita (largura: 420px desktop, full-width mobile)
- A tabela permanece visível e interagível atrás do Sheet
- Sheet fecha com ESC ou clique fora

**Conteúdo do Sheet:**
```
┌─────────────────────────────────┐
│ João Silva                [✕]   │
│ Contador #4821 · Zona Norte     │
│                                 │
│ [Score 91] [Pendente]           │
│                                 │
│ MOTIVOS DE SCORING              │
│ R1: queda −68% vs média 6m      │
│ R3: desvio cluster +42%         │
│ R7: reincidente (1 confirmado)  │
│                                 │
│ SCORE ML                        │
│ heuristic_v1: 0.87              │
│                                 │
│ [Criar Ordem Inspeção]          │
│ [Enviar SMS]  [Classificar]     │
└─────────────────────────────────┘
```

### Tabela de alertas
- Usar `shadcn/ui Table` como base
- Linha seleccionada: highlight indigo claro + borda esquerda indigo
- Badges de score: `variant="destructive"` (≥75) ou amarelo custom (50–74)
- Badges de status: cores semânticas consistentes em todo o app

| Status | Cor |
|---|---|
| Pendente | amarelo (`fef3c7` / `d97706`) |
| Pendente_Inspecao | azul (`dbeafe` / `2563eb`) |
| Fraude_Confirmada | vermelho (`fee2e2` / `dc2626`) |
| Anomalia_Tecnica | laranja (`ffedd5` / `ea580c`) |
| Sem_Anomalia | verde (`f0fdf4` / `16a34a`) |
| Arquivado | cinza (`f1f5f9` / `64748b`) |

---

## 4. Mobile PWA (`/mobile`)

### Roteiro (`/mobile`)
**Novo layout:**
1. **Card hero** no topo para a visita actual:
   - Background gradient indigo (`from-indigo-600 to-violet-700`)
   - Nome do cliente, endereço, score, badge CRÍTICO/MÉDIO
   - Botão CTA proeminente "Iniciar inspeção →"
2. **Barra de progresso** (shadcn `Progress`) — X de N visitas concluídas
3. **Lista compacta** abaixo para as visitas restantes e concluídas

**Regras de ordenação** (sem alteração à lógica existente):
- Visitas pendentes primeiro, ordenadas por score desc
- Visitas concluídas no fim, com opacidade reduzida

### Ficha de inspeção (`/mobile/[id]`)
- Sem alteração à estrutura ou lógica
- Actualizar estilos: tipografia Inter, espaçamentos consistentes com design system
- Botões de acção (câmara, GPS) usam `shadcn/ui Button variant="outline"`

### Relatório de inspeção (`/mobile/[id]/report`)
- Sem alteração à estrutura
- Actualizar estilos para consistência

---

## 5. Sidebar

**Actualização para dark sidebar:**
- Background: `slate-900` (`#0f172a`)
- Items inactivos: texto `slate-400`, hover `slate-800`
- Item activo: background `indigo-600`, texto branco
- Logo Fiskix: ícone ⚡ em `indigo-400`, texto branco
- Footer (utilizador): avatar com iniciais em `indigo-500/20`, nome em `slate-200`

A lógica de colapso e responsividade mantém-se sem alterações.

---

## 6. Estados globais (feedback ao utilizador)

### Loading states
- Todos os `animate-pulse` manuais substituídos por `shadcn/ui Skeleton`
- Skeletons com shape da UI real (não rectangulos genéricos)

### Toasts
- Instalar **Sonner** (recomendado pela shadcn)
- Substituir todos os `alert()` e estados de erro inline
- Posição: `bottom-right` desktop, `bottom-center` mobile
- Casos de uso: SMS enviado ✓, Ordem criada ✓, Erro de rede ✗, Scoring concluído ✓

### Estados vazios
- Páginas sem dados (ex: nenhum alerta no mês) recebem **empty state** com ícone + mensagem + CTA
- Exemplo alertas vazio: ícone `ShieldCheck`, "Nenhum alerta este mês", botão "Executar scoring"

---

## 7. O que NÃO muda

- Toda a lógica de negócio (scoring engine, RLS, hooks de dados)
- Estrutura de rotas
- Motor de scoring (`engine.ts`) — intocável
- Edge functions e migrations
- Testes existentes (300 Vitest + E2E Playwright) — devem continuar a passar

---

## Ordem de implementação sugerida

1. Instalar shadcn/ui + configurar tema Slate & Indigo
2. Criar componentes base em `src/components/ui/`
3. Actualizar Sidebar para dark
4. Migrar KPI Cards + Dashboard layout 2 colunas
5. Migrar tabela Alertas + implementar Sheet lateral
6. Actualizar Mobile PWA — card hero no roteiro
7. Substituir skeletons e adicionar Toasts (Sonner)
8. Adicionar empty states
9. Correr `npm run test` e `npm run type-check` — todos devem passar
