# Fiskix UI Refactor — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adoptar shadcn/ui com tema Slate & Indigo, redesenhar dashboard em 2 colunas, migrar modal de alertas para Sheet lateral, e actualizar PWA mobile com card hero.

**Architecture:** Instalar shadcn/ui (copy-paste approach) em `src/components/ui/`. Criar componentes partilhados `ScoreBadge` e `StatusBadge`. Actualizar sidebar para dark, dashboard para layout 2 colunas, alertas para Sheet lateral, e roteiro mobile para card hero com barra de progresso.

**Tech Stack:** Next.js 15, React 19, Tailwind v4, shadcn/ui, Sonner (toasts), Lucide React

---

## File Map

**Criar:**
- `src/components/ui/` — componentes shadcn gerados via CLI
- `src/components/ui/score-badge.tsx` — badge de score reutilizável (CRÍTICO/MÉDIO/BAIXO)
- `src/components/ui/status-badge.tsx` — badge de status de alerta reutilizável
- `src/components/ui/empty-state.tsx` — estado vazio genérico
- `src/modules/alertas/components/AlertaSheet.tsx` — sheet lateral de detalhe de alerta
- `src/modules/dashboard/components/AlertasCriticosPanel.tsx` — painel top 5 alertas críticos

**Modificar:**
- `src/app/globals.css` — novos CSS vars Slate & Indigo
- `src/app/layout.tsx` — adicionar `<Toaster />` (Sonner)
- `src/components/Sidebar.tsx` — sidebar dark slate-900
- `src/modules/dashboard/components/KPICards.tsx` — shadcn Card + delta mês anterior
- `src/app/dashboard/DashboardClient.tsx` — layout 2 colunas
- `src/modules/dashboard/components/TabelaAlertas.tsx` — substituir AlertaDetalheModal por AlertaSheet
- `src/app/alertas/page.tsx` — substituir feedback inline por Sonner + usar AlertaSheet
- `src/modules/mobile/components/RoteiroDia.tsx` — card hero + progress bar

**Apagar (após migração):**
- `src/modules/dashboard/components/AlertaDetalheModal.tsx`

---

## Task 1: Instalar shadcn/ui e configurar tema Slate & Indigo

**Files:**
- Create: `components.json`
- Modify: `src/app/globals.css`
- Modify: `package.json` (dependências adicionadas automaticamente)

- [ ] **Step 1: Inicializar shadcn/ui**

```bash
npx shadcn@latest init --defaults
```

Quando o CLI perguntar:
- Style: `Default`
- Base color: `Slate`
- CSS variables: `yes`

- [ ] **Step 2: Verificar que `components.json` foi criado**

```bash
cat components.json
```

Deve conter `"baseColor": "slate"` e `"cssVariables": true`.

- [ ] **Step 3: Instalar componentes base de uma vez**

```bash
npx shadcn@latest add button badge card table sheet dialog input select tabs skeleton progress
```

Confirmar que criou `src/components/ui/` com os ficheiros correspondentes.

- [ ] **Step 4: Instalar Sonner para toasts**

```bash
npx shadcn@latest add sonner
```

- [ ] **Step 5: Actualizar CSS vars para Slate & Indigo em `src/app/globals.css`**

Substituir apenas os tokens de primary e adicionar tokens de sidebar. Manter os tokens `--fiskix-*` intactos:

```css
@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 222.2 84% 4.9%;
    --card: 0 0% 100%;
    --card-foreground: 222.2 84% 4.9%;
    --popover: 0 0% 100%;
    --popover-foreground: 222.2 84% 4.9%;
    --primary: 239 84% 67%;
    --primary-foreground: 0 0% 100%;
    --secondary: 210 40% 96.1%;
    --secondary-foreground: 222.2 47.4% 11.2%;
    --muted: 210 40% 96.1%;
    --muted-foreground: 215.4 16.3% 46.9%;
    --accent: 210 40% 96.1%;
    --accent-foreground: 222.2 47.4% 11.2%;
    --destructive: 0 84.2% 60.2%;
    --destructive-foreground: 210 40% 98%;
    --border: 214.3 31.8% 91.4%;
    --input: 214.3 31.8% 91.4%;
    --ring: 239 84% 67%;
    --radius: 0.5rem;
    /* Sidebar */
    --sidebar: 222 47% 11%;
    --sidebar-foreground: 215 16% 47%;
    --sidebar-active: 239 84% 67%;
    --sidebar-active-foreground: 0 0% 100%;
    /* Fiskix brand */
    --fiskix-navy: 220 60% 23%;
    --fiskix-blue: 214 84% 40%;
    --fiskix-cyan: 199 89% 48%;
    --fiskix-danger: 0 72% 51%;
    --fiskix-warning: 38 92% 50%;
    --fiskix-success: 142 71% 45%;
  }
}
```

- [ ] **Step 6: Verificar que os testes passam após instalação**

```bash
npm run test
```

Expected: todos os 300 testes passam. shadcn/ui não altera lógica de negócio.

- [ ] **Step 7: Commit**

```bash
git add components.json src/components/ui/ src/app/globals.css package.json package-lock.json
git commit -m "feat(ui): instalar shadcn/ui com tema Slate & Indigo"
```

---

## Task 2: Criar ScoreBadge e StatusBadge

**Files:**
- Create: `src/components/ui/score-badge.tsx`
- Create: `src/components/ui/status-badge.tsx`
- Create: `src/__tests__/components/score-badge.test.tsx`
- Create: `src/__tests__/components/status-badge.test.tsx`

- [ ] **Step 1: Escrever os testes de ScoreBadge**

```tsx
// src/__tests__/components/score-badge.test.tsx
import { render, screen } from "@testing-library/react";
import { ScoreBadge } from "@/components/ui/score-badge";

describe("ScoreBadge", () => {
  it("mostra CRÍTICO e classe vermelha para score >= 75", () => {
    render(<ScoreBadge score={91} />);
    expect(screen.getByText("CRÍTICO")).toBeInTheDocument();
    const badge = screen.getByText("CRÍTICO").closest("span")!;
    expect(badge.className).toContain("red");
  });

  it("mostra MÉDIO e classe amarela para score entre 50 e 74", () => {
    render(<ScoreBadge score={68} />);
    expect(screen.getByText("MÉDIO")).toBeInTheDocument();
    const badge = screen.getByText("MÉDIO").closest("span")!;
    expect(badge.className).toContain("amber");
  });

  it("mostra o número do score quando showScore=true", () => {
    render(<ScoreBadge score={91} showScore />);
    expect(screen.getByText("91")).toBeInTheDocument();
    expect(screen.getByText("CRÍTICO")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Correr para verificar que falha**

```bash
npm run test -- --reporter=verbose src/__tests__/components/score-badge.test.tsx
```

Expected: FAIL — `ScoreBadge` não existe.

- [ ] **Step 3: Implementar ScoreBadge**

```tsx
// src/components/ui/score-badge.tsx
import { cn } from "@/lib/utils";

interface ScoreBadgeProps {
  score: number;
  showScore?: boolean;
  className?: string;
}

export function ScoreBadge({ score, showScore = false, className }: ScoreBadgeProps) {
  const isCritico = score >= 75;
  const isMedio = score >= 50 && score < 75;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold",
        isCritico && "bg-red-100 text-red-700",
        isMedio && "bg-amber-100 text-amber-700",
        !isCritico && !isMedio && "bg-green-100 text-green-700",
        className
      )}
    >
      {showScore && <span className="font-bold">{score}</span>}
      {isCritico ? "CRÍTICO" : isMedio ? "MÉDIO" : "BAIXO"}
    </span>
  );
}
```

- [ ] **Step 4: Escrever testes de StatusBadge**

```tsx
// src/__tests__/components/status-badge.test.tsx
import { render, screen } from "@testing-library/react";
import { StatusBadge } from "@/components/ui/status-badge";

describe("StatusBadge", () => {
  it("renderiza label correcto para Pendente", () => {
    render(<StatusBadge status="Pendente" />);
    expect(screen.getByText("Pendente")).toBeInTheDocument();
  });

  it("renderiza label correcto para Fraude_Confirmada", () => {
    render(<StatusBadge status="Fraude_Confirmada" />);
    expect(screen.getByText("Fraude Confirmada")).toBeInTheDocument();
  });

  it("renderiza label correcto para Pendente_Inspecao", () => {
    render(<StatusBadge status="Pendente_Inspecao" />);
    expect(screen.getByText("Em Inspeção")).toBeInTheDocument();
  });
});
```

- [ ] **Step 5: Implementar StatusBadge**

```tsx
// src/components/ui/status-badge.tsx
import { cn } from "@/lib/utils";

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  Pendente: { label: "Pendente", className: "bg-slate-100 text-slate-700" },
  Notificado_SMS: { label: "SMS Enviado", className: "bg-blue-100 text-blue-700" },
  Pendente_Inspecao: { label: "Em Inspeção", className: "bg-amber-100 text-amber-700" },
  Inspecionado: { label: "Inspecionado", className: "bg-green-100 text-green-700" },
  Fraude_Confirmada: { label: "Fraude Confirmada", className: "bg-red-100 text-red-700" },
  Anomalia_Tecnica: { label: "Anomalia Técnica", className: "bg-orange-100 text-orange-700" },
  Falso_Positivo: { label: "Falso Positivo", className: "bg-slate-100 text-slate-400" },
};

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status] ?? { label: status, className: "bg-slate-100 text-slate-600" };
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium",
        config.className,
        className
      )}
    >
      {config.label}
    </span>
  );
}
```

- [ ] **Step 6: Correr testes**

```bash
npm run test -- --reporter=verbose src/__tests__/components/
```

Expected: 6 testes passam.

- [ ] **Step 7: Commit**

```bash
git add src/components/ui/score-badge.tsx src/components/ui/status-badge.tsx src/__tests__/components/
git commit -m "feat(ui): adicionar ScoreBadge e StatusBadge partilhados"
```

---

## Task 3: Actualizar Sidebar para dark slate-900

**Files:**
- Modify: `src/components/Sidebar.tsx`

- [ ] **Step 1: Substituir as classes de cor na Sidebar**

Em `src/components/Sidebar.tsx`, substituir as classes de cor do aside e sidebarContent. As únicas partes que mudam são cores — a lógica permanece idêntica.

Alterações no elemento `<aside>` (desktop):
```tsx
// Antes
className={`hidden lg:flex flex-col fixed top-0 left-0 bottom-0 z-40 bg-white border-r border-slate-200 ...`}

// Depois
className={`hidden lg:flex flex-col fixed top-0 left-0 bottom-0 z-40 bg-[hsl(var(--sidebar))] border-r border-slate-700/50 ...`}
```

Alterações no logo:
```tsx
// Antes: <p className="font-bold text-slate-900 ...">Fiskix</p>
// Depois: <p className="font-bold text-white ...">Fiskix</p>

// Antes: <p className="text-[10px] text-slate-400 ...">Electra Cabo Verde</p>
// Depois: <p className="text-[10px] text-slate-400 ...">Electra Cabo Verde</p>  (igual)
```

Alterações no `NavLink` (dentro de `Sidebar.tsx`):
```tsx
// Antes (active):
"bg-blue-50 text-blue-700"
// Depois (active):
"bg-indigo-600 text-white"

// Antes (inactivo):
"text-slate-600 hover:bg-slate-100 hover:text-slate-900"
// Depois (inactivo):
"text-slate-400 hover:bg-slate-800 hover:text-slate-100"

// Antes (active bar):
"bg-blue-600"
// Depois (active bar):
"bg-white"
```

Alterações no ícone do NavLink:
```tsx
// Antes (active): "text-blue-700"
// Depois (active): "text-white"

// Antes (inactivo): "text-slate-500 group-hover:text-slate-700"
// Depois (inactivo): "text-slate-400 group-hover:text-slate-200"
```

Alterações na secção "Administração":
```tsx
// Antes: "text-[10px] font-semibold text-slate-400 ..."
// Depois: "text-[10px] font-semibold text-slate-500 ..."  (igual)

// Antes: "my-3 border-t border-slate-100"
// Depois: "my-3 border-t border-slate-700/50"
```

Alterações no footer do utilizador:
```tsx
// Antes: "border-t border-slate-100"
// Depois: "border-t border-slate-700/50"

// Antes (avatar): "bg-blue-100 ... text-blue-700"
// Depois (avatar): "bg-indigo-500/20 ... text-indigo-300"

// Antes (nome): "text-slate-900"
// Depois (nome): "text-slate-100"

// Antes (role): "text-slate-400"
// Depois (role): "text-slate-500"

// Antes (logout): "hover:bg-red-50 text-slate-400 hover:text-red-500"
// Depois (logout): "hover:bg-red-900/30 text-slate-500 hover:text-red-400"
```

Alterações no botão de colapso:
```tsx
// Antes: "hover:bg-slate-100 text-slate-400 hover:text-slate-600"
// Depois: "hover:bg-slate-800 text-slate-500 hover:text-slate-300"
```

- [ ] **Step 2: Verificar visualmente**

```bash
npm run dev
```

Abre http://localhost:3000/dashboard — a sidebar deve estar em slate-900 com items indigo activos.

- [ ] **Step 3: Correr testes**

```bash
npm run test
```

Expected: 300 testes passam (sidebar não tem testes unitários, mas confirmar que nada quebrou).

- [ ] **Step 4: Commit**

```bash
git add src/components/Sidebar.tsx
git commit -m "feat(ui): sidebar dark slate-900 com active state indigo"
```

---

## Task 4: Dashboard — layout 2 colunas + KPI Cards com delta

**Files:**
- Modify: `src/modules/dashboard/components/KPICards.tsx`
- Create: `src/modules/dashboard/components/AlertasCriticosPanel.tsx`
- Modify: `src/app/dashboard/DashboardClient.tsx`
- Modify: `src/modules/dashboard/hooks/useKPIs.ts` (adicionar delta e alertas críticos)

- [ ] **Step 1: Verificar o hook useKPIs actual**

```bash
cat src/modules/dashboard/hooks/useKPIs.ts
```

Verificar quais campos retorna `KPIData`. Precisamos de `perda_mes_anterior` e `alertas_criticos` (top 5).

- [ ] **Step 2: Estender KPIData e useKPIs para incluir alertas_criticos**

O hook já tem `variacao_perda_pct` (calculado vs mês anterior). Só falta adicionar `alertas_criticos`.

Em `src/modules/dashboard/types.ts`, adicionar ao tipo `KPIData`:

```ts
export interface KPIData {
  perda_cve_total: number;
  clientes_risco_critico: number;
  ordens_pendentes: number;
  receita_recuperada_ytd: number;
  variacao_perda_pct: number;
  alertas_criticos: Array<{            // ← novo
    id: string;
    score_risco: number;
    status: string;
    cliente: { nome_titular: string; numero_contador: string };
    subestacao: { zona_bairro: string };
  }>;
}
```

Em `src/modules/dashboard/hooks/useKPIs.ts`, adicionar a query de alertas críticos após a query de alertas existente (dentro da função `load()`), com suporte ao filtro de zona:

```ts
// Query alertas críticos (top 5, score >= 75)
let criticosQuery = supabase
  .from("alertas_fraude")
  .select(`id, score_risco, status,
    clientes!inner(nome_titular, numero_contador,
      subestacoes!inner(zona_bairro))`)
  .eq("mes_ano", mesAno)
  .gte("score_risco", 75)
  .order("score_risco", { ascending: false })
  .limit(5);

if (zona) {
  criticosQuery = (criticosQuery as typeof criticosQuery).eq("clientes.subestacoes.zona_bairro", zona);
}

const { data: criticosData } = await criticosQuery;

const alertas_criticos = (criticosData ?? []).map((r) => {
  const c = r.clientes as { nome_titular: string; numero_contador: string; subestacoes: { zona_bairro: string } };
  return {
    id: r.id,
    score_risco: r.score_risco,
    status: r.status,
    cliente: { nome_titular: c.nome_titular, numero_contador: c.numero_contador },
    subestacao: { zona_bairro: c.subestacoes.zona_bairro },
  };
});
```

Adicionar `alertas_criticos` ao `setData({ ... })` existente no final do hook.

- [ ] **Step 3: Actualizar KPICards para usar shadcn Card + delta**

```tsx
// src/modules/dashboard/components/KPICards.tsx
"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCVE } from "@/lib/utils";
import { TrendingDown, AlertTriangle, ClipboardList, TrendingUp } from "lucide-react";
import type { KPIData } from "../types";

interface KPICardsProps {
  data: KPIData | null;
  loading: boolean;
}

function DeltaBadge({ pct }: { pct: number }) {
  if (pct === 0) return null;
  const isWorse = pct > 0;
  return (
    <span className={`text-xs font-medium ${isWorse ? "text-red-600" : "text-emerald-600"}`}>
      {isWorse ? "↑" : "↓"} {Math.abs(pct).toFixed(1)}% vs mês ant.
    </span>
  );
}

function KPICard({
  title, value, icon: Icon, iconClass, sub, delta, loading,
}: {
  title: string;
  value: string;
  icon: React.ElementType;
  iconClass: string;
  sub?: React.ReactNode;
  delta?: React.ReactNode;
  loading: boolean;
}) {
  return (
    <Card>
      <CardContent className="pt-5">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium text-muted-foreground">{title}</span>
          <div className={`p-2 rounded-lg ${iconClass}`}>
            <Icon className="w-4 h-4" />
          </div>
        </div>
        {loading ? (
          <Skeleton className="h-8 w-3/4" />
        ) : (
          <div className="text-2xl font-bold text-foreground">{value}</div>
        )}
        {!loading && (delta || sub) && (
          <p className="text-xs text-muted-foreground mt-1">{delta ?? sub}</p>
        )}
      </CardContent>
    </Card>
  );
}

export function KPICards({ data, loading }: KPICardsProps) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <KPICard
        title="Perda Estimada"
        value={data ? formatCVE(data.perda_cve_total) : "—"}
        icon={TrendingDown}
        iconClass="bg-red-100 text-red-600"
        delta={data ? <DeltaBadge pct={data.variacao_perda_pct} /> : undefined}
        loading={loading}
      />
      <KPICard
        title="Risco Crítico"
        value={data ? `${data.clientes_risco_critico} clientes` : "—"}
        icon={AlertTriangle}
        iconClass="bg-amber-100 text-amber-600"
        sub="score ≥ 75 este mês"
        loading={loading}
      />
      <KPICard
        title="Ordens Pendentes"
        value={data ? `${data.ordens_pendentes} ordens` : "—"}
        icon={ClipboardList}
        iconClass="bg-indigo-100 text-indigo-600"
        sub="aguardam inspeção física"
        loading={loading}
      />
      <KPICard
        title="Receita Recuperada"
        value={data ? formatCVE(data.receita_recuperada_ytd) : "—"}
        icon={TrendingUp}
        iconClass="bg-emerald-100 text-emerald-600"
        sub="fraudes confirmadas YTD"
        loading={loading}
      />
    </div>
  );
}
```

- [ ] **Step 4: Criar AlertasCriticosPanel**

```tsx
// src/modules/dashboard/components/AlertasCriticosPanel.tsx
"use client";

import Link from "next/link";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ScoreBadge } from "@/components/ui/score-badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { AlertTriangle, ChevronRight } from "lucide-react";
import type { KPIData } from "../types";

interface AlertasCriticosPanelProps {
  alertas: KPIData["alertas_criticos"] | undefined;
  loading: boolean;
  mesAno: string;
}

export function AlertasCriticosPanel({ alertas, loading, mesAno }: AlertasCriticosPanelProps) {
  return (
    <Card className="flex flex-col h-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-red-500" />
          Alertas Críticos
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 space-y-2">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))
        ) : !alertas || alertas.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            Sem alertas críticos este mês
          </p>
        ) : (
          alertas.map((a) => (
            <div
              key={a.id}
              className="flex items-center gap-2 py-2 border-b border-border last:border-0"
            >
              <ScoreBadge score={a.score_risco} showScore className="shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-foreground truncate">
                  {a.cliente.nome_titular}
                </p>
                <p className="text-xs text-muted-foreground">
                  {a.subestacao.zona_bairro.replace(/_/g, " ")}
                </p>
              </div>
              <StatusBadge status={a.status} className="shrink-0" />
            </div>
          ))
        )}
        <Link
          href={`/alertas?mes=${mesAno}&min_score=75`}
          className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 pt-1 font-medium"
        >
          Ver todos <ChevronRight className="w-3 h-3" />
        </Link>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 5: Actualizar DashboardClient para layout 2 colunas**

Em `src/app/dashboard/DashboardClient.tsx`, substituir a secção do mapa + tabela pelo novo layout:

```tsx
// Adicionar imports no topo:
import { AlertasCriticosPanel } from "@/modules/dashboard/components/AlertasCriticosPanel";

// Substituir a área principal (após KPICards) por:
{/* 2-column: mapa + alertas críticos */}
<div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
  <div className="lg:col-span-3 h-80">
    <HeatMap mesAno={mesAno} zona={zona} />
  </div>
  <div className="lg:col-span-2">
    <AlertasCriticosPanel
      alertas={kpis?.alertas_criticos}
      loading={kpisLoading}
      mesAno={mesAno}
    />
  </div>
</div>

{/* Tendência + Top5 a largura completa */}
<TendenciaPerdas mesAno={mesAno} zona={zona} />
<Top5Transformadores mesAno={mesAno} zona={zona} />
```

- [ ] **Step 6: Correr testes**

```bash
npm run test
```

Expected: 300 testes passam.

- [ ] **Step 7: Commit**

```bash
git add src/modules/dashboard/ src/app/dashboard/
git commit -m "feat(dashboard): layout 2 colunas, KPI cards com delta, painel alertas críticos"
```

---

## Task 5: Criar AlertaSheet e migrar TabelaAlertas + página /alertas

**Files:**
- Create: `src/modules/alertas/components/AlertaSheet.tsx`
- Modify: `src/modules/dashboard/components/TabelaAlertas.tsx`
- Modify: `src/app/alertas/page.tsx`
- Delete: `src/modules/dashboard/components/AlertaDetalheModal.tsx` (após migração)

- [ ] **Step 1: Verificar o conteúdo actual do AlertaDetalheModal**

```bash
cat src/modules/dashboard/components/AlertaDetalheModal.tsx
```

Mapear que props recebe e que informação mostra — o AlertaSheet deve expor as mesmas props.

- [ ] **Step 2: Criar AlertaSheet**

```tsx
// src/modules/alertas/components/AlertaSheet.tsx
"use client";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ScoreBadge } from "@/components/ui/score-badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { MessageSquare, ClipboardList, MapPin } from "lucide-react";

export interface AlertaSheetData {
  id: string;
  score_risco: number;
  status: string;
  mes_ano: string;
  resultado: string | null;
  motivo: Array<{ regra: string; pontos: number; descricao: string }>;
  cliente: {
    numero_contador: string;
    nome_titular: string;
    morada: string;
    tipo_tarifa: string;
    telemovel: string | null;
  };
  subestacao: { nome: string; zona_bairro: string };
}

interface AlertaSheetProps {
  alerta: AlertaSheetData | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEnviarSMS?: (alertaId: string) => Promise<void>;
  onGerarOrdem?: (alertaId: string) => Promise<void>;
  actionLoading?: string | null;
}

export function AlertaSheet({
  alerta,
  open,
  onOpenChange,
  onEnviarSMS,
  onGerarOrdem,
  actionLoading,
}: AlertaSheetProps) {
  if (!alerta) return null;

  const motivosPontuados = alerta.motivo.filter((m) => m.pontos > 0);
  const podeEnviarSMS = alerta.cliente.telemovel && alerta.status === "Pendente";
  const podeGerarOrdem = !["Inspecionado", "Fraude_Confirmada", "Anomalia_Tecnica", "Falso_Positivo"].includes(alerta.status);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[420px] sm:w-[420px] overflow-y-auto">
        <SheetHeader className="mb-4">
          <SheetTitle className="text-base">{alerta.cliente.nome_titular}</SheetTitle>
          <p className="text-sm text-muted-foreground">
            Contador #{alerta.cliente.numero_contador} · {alerta.subestacao.zona_bairro.replace(/_/g, " ")}
          </p>
        </SheetHeader>

        {/* Score + Status */}
        <div className="flex items-center gap-2 mb-5">
          <ScoreBadge score={alerta.score_risco} showScore />
          <StatusBadge status={alerta.status} />
        </div>

        {/* Informação do cliente */}
        <div className="space-y-1 mb-5">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
            Cliente
          </h4>
          <p className="text-sm text-foreground flex items-start gap-1.5">
            <MapPin className="w-3.5 h-3.5 mt-0.5 text-muted-foreground shrink-0" />
            {alerta.cliente.morada}
          </p>
          <p className="text-sm text-muted-foreground">
            Tarifa: {alerta.cliente.tipo_tarifa}
          </p>
          {alerta.cliente.telemovel && (
            <p className="text-sm text-muted-foreground">
              Tel: {alerta.cliente.telemovel}
            </p>
          )}
        </div>

        {/* Motivos de scoring */}
        <div className="mb-5">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
            Motivos de Scoring
          </h4>
          {motivosPontuados.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem motivos registados</p>
          ) : (
            <ul className="space-y-2">
              {motivosPontuados.map((m) => (
                <li key={m.regra} className="flex items-start gap-2 text-sm">
                  <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded shrink-0 mt-0.5">
                    {m.regra}
                  </span>
                  <span className="text-foreground">{m.descricao}</span>
                  <span className="ml-auto text-muted-foreground shrink-0">+{m.pontos}pts</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Resultado se inspecionado */}
        {alerta.resultado && (
          <div className="mb-5">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              Resultado da Inspeção
            </h4>
            <StatusBadge status={alerta.resultado} />
          </div>
        )}

        {/* Acções */}
        {(podeEnviarSMS || podeGerarOrdem) && (
          <div className="space-y-2 pt-4 border-t border-border">
            {podeGerarOrdem && onGerarOrdem && (
              <Button
                className="w-full"
                onClick={() => onGerarOrdem(alerta.id)}
                disabled={actionLoading === alerta.id}
              >
                <ClipboardList className="w-4 h-4 mr-2" />
                {actionLoading === alerta.id ? "A criar..." : "Criar Ordem de Inspeção"}
              </Button>
            )}
            {podeEnviarSMS && onEnviarSMS && (
              <Button
                variant="outline"
                className="w-full"
                onClick={() => onEnviarSMS(alerta.id)}
                disabled={actionLoading === alerta.id}
              >
                <MessageSquare className="w-4 h-4 mr-2" />
                Enviar SMS
              </Button>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
```

- [ ] **Step 3: Migrar TabelaAlertas para usar AlertaSheet**

Em `src/modules/dashboard/components/TabelaAlertas.tsx`:

1. Remover o import dinâmico de `AlertaDetalheModal`
2. Adicionar import de `AlertaSheet` e `AlertaSheetData`
3. Trocar tipo de `alertaDetalhe` para `AlertaSheetData | null`
4. Substituir `<AlertaDetalheModal ... />` por `<AlertaSheet ... />`
5. Substituir spans de status por `<StatusBadge status={...} />`
6. Substituir spans de score por `<ScoreBadge score={...} showScore />`

Alteração do estado e render:
```tsx
// Remover:
import dynamic from "next/dynamic";
const AlertaDetalheModal = dynamic(...);

// Adicionar:
import { AlertaSheet, type AlertaSheetData } from "@/modules/alertas/components/AlertaSheet";
import { ScoreBadge } from "@/components/ui/score-badge";
import { StatusBadge } from "@/components/ui/status-badge";

// Estado (trocar tipo):
const [alertaDetalhe, setAlertaDetalhe] = useState<AlertaSheetData | null>(null);
const [sheetOpen, setSheetOpen] = useState(false);

// Abrir sheet (na linha da tabela):
onClick={() => { setAlertaDetalhe(alerta); setSheetOpen(true); }}

// Render do Sheet (no final do JSX):
<AlertaSheet
  alerta={alertaDetalhe}
  open={sheetOpen}
  onOpenChange={setSheetOpen}
  onEnviarSMS={enviarSMS}
  onGerarOrdem={gerarOrdem}
  actionLoading={actionLoading}
/>
```

- [ ] **Step 4: Migrar alertas/page.tsx para usar AlertaSheet + Sonner**

Em `src/app/alertas/page.tsx`:

1. Adicionar imports:
```tsx
import { AlertaSheet, type AlertaSheetData } from "@/modules/alertas/components/AlertaSheet";
import { ScoreBadge } from "@/components/ui/score-badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { toast } from "sonner";
```

2. Substituir estado de feedback:
```tsx
// Remover:
const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

// Adicionar:
const [alertaSheet, setAlertaSheet] = useState<AlertaSheetData | null>(null);
const [sheetOpen, setSheetOpen] = useState(false);
```

3. Substituir `setFeedback({ type: "success", ... })` por `toast.success("...")`
4. Substituir `setFeedback({ type: "error", ... })` por `toast.error("...")`
5. Remover o elemento JSX do feedback banner (bloco `{feedback && ...}`)
6. Nas linhas da tabela, substituir spans de score e status por `<ScoreBadge>` e `<StatusBadge>`
7. Adicionar click handler na linha: `onClick={() => { setAlertaSheet(alerta); setSheetOpen(true); }}`
8. Adicionar `<AlertaSheet>` no final do JSX

- [ ] **Step 5: Apagar AlertaDetalheModal**

```bash
rm src/modules/dashboard/components/AlertaDetalheModal.tsx
```

- [ ] **Step 6: Correr testes e type-check**

```bash
npm run type-check && npm run test
```

Expected: zero erros de tipos, 300 testes passam.

- [ ] **Step 7: Commit**

```bash
git add src/modules/alertas/ src/modules/dashboard/components/TabelaAlertas.tsx src/app/alertas/
git commit -m "feat(alertas): substituir modal por sheet lateral, badges partilhados"
```

---

## Task 6: Adicionar Sonner Toaster ao layout raiz

**Files:**
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: Verificar layout.tsx actual**

```bash
cat src/app/layout.tsx
```

- [ ] **Step 2: Adicionar Toaster**

```tsx
// Adicionar import:
import { Toaster } from "@/components/ui/sonner";

// Adicionar dentro de <body>, antes de fechar:
<Toaster position="bottom-right" richColors />
```

- [ ] **Step 3: Commit**

```bash
git add src/app/layout.tsx
git commit -m "feat(ui): adicionar Sonner Toaster ao layout raiz"
```

---

## Task 7: Mobile PWA — card hero + progress bar no RoteiroDia

**Files:**
- Modify: `src/modules/mobile/components/RoteiroDia.tsx`

- [ ] **Step 1: Adicionar imports necessários**

```tsx
// Adicionar no topo de RoteiroDia.tsx:
import { Progress } from "@/components/ui/progress";
import { ScoreBadge } from "@/components/ui/score-badge";
```

- [ ] **Step 2: Calcular valores para o card hero e progress bar**

Após `const mesAno = getCurrentMesAno();`, adicionar:

```tsx
const ordensPendentes = ordens.filter((o) => o.status === "Pendente_Inspecao");
const ordensConcluidas = ordens.filter((o) => o.status !== "Pendente_Inspecao");
const proximaOrdem = ordensPendentes[0] ?? null;
const progressoPct = ordens.length > 0 ? (ordensConcluidas.length / ordens.length) * 100 : 0;
```

- [ ] **Step 3: Substituir a lista actual pelo novo layout**

No JSX do `RoteiroDia`, substituir a secção `{/* Lista de ordens */}` completa:

```tsx
{/* Barra de progresso */}
{!loading && ordens.length > 0 && (
  <div className="px-4 pt-2 pb-1">
    <Progress value={progressoPct} className="h-1.5" />
    <p className="text-xs text-blue-300 mt-1 text-right">
      {ordensConcluidas.length} de {ordens.length} concluídas
    </p>
  </div>
)}

<div className="p-4 space-y-3">
  {loading ? (
    <>
      <div className="bg-indigo-600/40 rounded-2xl h-40 animate-pulse" />
      {Array.from({ length: 2 }).map((_, i) => (
        <div key={i} className="bg-white/10 rounded-2xl p-4 animate-pulse">
          <div className="h-4 bg-white/20 rounded w-3/4 mb-2" />
          <div className="h-3 bg-white/10 rounded w-1/2" />
        </div>
      ))}
    </>
  ) : ordens.length === 0 ? (
    <div className="bg-white rounded-2xl p-8 text-center">
      <ClipboardList className="w-10 h-10 text-slate-300 mx-auto mb-3" />
      <p className="text-slate-500 font-medium">Sem ordens para hoje</p>
      <p className="text-slate-400 text-sm mt-1">
        Toque em atualizar para verificar novamente
      </p>
    </div>
  ) : (
    <>
      {/* Card hero — próxima visita */}
      {proximaOrdem && (
        <Link href={`/mobile/${proximaOrdem.id}`} className="block">
          <div className="bg-gradient-to-br from-indigo-600 to-violet-700 rounded-2xl p-5 shadow-lg active:scale-98 transition-transform">
            <p className="text-indigo-200 text-xs font-semibold uppercase tracking-wider mb-2">
              A fazer agora
            </p>
            <p className="text-white font-bold text-lg leading-tight mb-0.5">
              {proximaOrdem.cliente.nome_titular}
            </p>
            <p className="text-indigo-200 text-sm mb-3">{proximaOrdem.cliente.morada}</p>
            <div className="flex items-center gap-2 mb-4">
              <ScoreBadge
                score={proximaOrdem.score_risco}
                showScore
                className="bg-white/20 text-white border-0"
              />
            </div>
            <div className="bg-white text-indigo-700 font-bold text-sm py-2.5 rounded-xl text-center">
              Iniciar inspeção →
            </div>
          </div>
        </Link>
      )}

      {/* Lista compacta — restantes */}
      {ordensPendentes.length > 1 && (
        <>
          <p className="text-xs text-slate-400 font-semibold uppercase tracking-wide px-1 pt-1">
            A seguir
          </p>
          <div className="bg-white rounded-2xl overflow-hidden shadow-sm divide-y divide-slate-100">
            {ordensPendentes.slice(1).map((ordem) => (
              <Link
                key={ordem.id}
                href={`/mobile/${ordem.id}`}
                className="flex items-center gap-3 px-4 py-3 active:bg-slate-50 transition-colors"
              >
                <ScoreBadge score={ordem.score_risco} showScore className="shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-900 truncate">
                    {ordem.cliente.nome_titular}
                  </p>
                  <p className="text-xs text-slate-400">{ordem.cliente.morada}</p>
                </div>
                <span className="text-slate-300 text-lg">›</span>
              </Link>
            ))}
          </div>
        </>
      )}

      {/* Concluídas */}
      {ordensConcluidas.length > 0 && (
        <>
          <p className="text-xs text-slate-400 font-semibold uppercase tracking-wide px-1 pt-1">
            Concluídas
          </p>
          <div className="bg-white/50 rounded-2xl overflow-hidden divide-y divide-slate-100 opacity-60">
            {ordensConcluidas.map((ordem) => (
              <div key={ordem.id} className="flex items-center gap-3 px-4 py-3">
                <span className="text-emerald-500 text-sm">✓</span>
                <p className="text-sm text-slate-500 truncate flex-1">
                  {ordem.cliente.nome_titular}
                </p>
              </div>
            ))}
          </div>
        </>
      )}
    </>
  )}
</div>
```

**Nota:** `OrdemFiscal` precisa de ter campo `status`. Verificar o tipo em `src/modules/mobile/types.ts` — se não tiver `status`, adicionar: `status: string`.

- [ ] **Step 4: Verificar tipos**

```bash
npm run type-check
```

Se houver erros de tipos no `OrdemFiscal`, actualizar `src/modules/mobile/types.ts` para incluir `status: string`.

- [ ] **Step 5: Correr testes**

```bash
npm run test
```

Expected: 300 testes passam.

- [ ] **Step 6: Commit**

```bash
git add src/modules/mobile/
git commit -m "feat(mobile): card hero para próxima visita, barra de progresso no roteiro"
```

---

## Task 8: Substituir skeletons manuais por shadcn Skeleton

**Files:**
- Modify: `src/app/dashboard/DashboardClient.tsx` (loadings dinâmicos)
- Modify: `src/modules/relatorios/components/*.tsx` (se tiverem animate-pulse)

- [ ] **Step 1: Encontrar todos os animate-pulse manuais**

```bash
grep -rn "animate-pulse" src/ --include="*.tsx"
```

Listar os ficheiros que precisam de actualização.

- [ ] **Step 2: Actualizar loadings em DashboardClient.tsx**

Substituir cada `<div className="h-64 bg-slate-100 rounded-xl animate-pulse" />` por:

```tsx
import { Skeleton } from "@/components/ui/skeleton";

// Para mapas/gráficos:
<Skeleton className="h-64 w-full rounded-xl" />
```

- [ ] **Step 3: Repetir para cada ficheiro identificado no Step 1**

Para cada animate-pulse encontrado, substituir pela forma equivalente com `Skeleton`.

- [ ] **Step 4: Correr testes**

```bash
npm run test
```

Expected: 300 testes passam.

- [ ] **Step 5: Commit**

```bash
git add src/
git commit -m "refactor(ui): substituir animate-pulse manual por shadcn Skeleton"
```

---

## Task 9: Adicionar Empty States

**Files:**
- Create: `src/components/ui/empty-state.tsx`
- Modify: `src/app/alertas/page.tsx`
- Modify: `src/modules/dashboard/components/TabelaAlertas.tsx`

- [ ] **Step 1: Criar EmptyState**

```tsx
// src/components/ui/empty-state.tsx
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center py-12 text-center", className)}>
      <div className="p-3 rounded-full bg-muted mb-4">
        <Icon className="w-6 h-6 text-muted-foreground" />
      </div>
      <h3 className="text-sm font-semibold text-foreground mb-1">{title}</h3>
      {description && (
        <p className="text-sm text-muted-foreground max-w-xs">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
```

- [ ] **Step 2: Usar EmptyState na página de Alertas**

Em `src/app/alertas/page.tsx`, quando `alertas.length === 0 && !loading`:

```tsx
import { EmptyState } from "@/components/ui/empty-state";
import { ShieldCheck } from "lucide-react";

// Substituir o bloco vazio actual por:
{alertas.length === 0 && !loading && (
  <EmptyState
    icon={ShieldCheck}
    title="Nenhum alerta encontrado"
    description="Não existem alertas para os filtros seleccionados. Tente alterar o mês ou os critérios de filtragem."
  />
)}
```

- [ ] **Step 3: Usar EmptyState em TabelaAlertas**

Em `src/modules/dashboard/components/TabelaAlertas.tsx`, o mesmo padrão quando `data.length === 0`:

```tsx
import { EmptyState } from "@/components/ui/empty-state";
import { ShieldCheck } from "lucide-react";

{data.length === 0 && !loading && (
  <EmptyState
    icon={ShieldCheck}
    title="Sem alertas este mês"
    description="Execute o motor de scoring para gerar alertas."
  />
)}
```

- [ ] **Step 4: Correr type-check e testes finais**

```bash
npm run type-check && npm run test
```

Expected: zero erros de tipos, 300 testes passam.

- [ ] **Step 5: Commit final**

```bash
git add src/components/ui/empty-state.tsx src/app/alertas/ src/modules/dashboard/
git commit -m "feat(ui): adicionar empty states na tabela de alertas e página /alertas"
```

---

## Verificação Final

- [ ] `npm run test` — 300 testes passam
- [ ] `npm run type-check` — zero erros
- [ ] `npm run build` — build de produção sem erros
- [ ] Verificar visualmente: dashboard, alertas (sheet), mobile roteiro
