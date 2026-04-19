# Spec: Refactoring Mosaic — Páginas Internas

**Data:** 2026-04-19  
**Âmbito:** Standardizar todas as páginas internas ao padrão visual do `DashboardClient.tsx`  
**Nível de fidelidade:** A — Standardize (dashboard como fonte da verdade)

---

## Contexto

O dashboard (`src/app/dashboard/DashboardClient.tsx`) foi o primeiro módulo a receber o design system Mosaic. As restantes páginas internas foram implementadas antes ou independentemente, resultando em inconsistências de header, cards, tipografia e tabelas.

Este refactoring não introduz novos componentes Mosaic nem redesenha layouts — apenas alinha cada página ao padrão já estabelecido.

---

## Padrão de Referência

O padrão Mosaic definido no dashboard e a aplicar em todas as páginas desktop:

### 1. Wrapper global

```tsx
<div className="px-4 sm:px-6 lg:px-8 py-8 w-full max-w-9xl mx-auto">
```

### 2. Page Header

```tsx
<div className="sm:flex sm:justify-between sm:items-center mb-8">
  <div className="mb-4 sm:mb-0">
    <h1 className="text-2xl md:text-3xl text-gray-800 dark:text-gray-100 font-bold">
      Título
    </h1>
    <p className="text-sm text-gray-500 mt-1 uppercase tracking-wider font-semibold">
      Subtítulo descritivo · contexto
    </p>
  </div>
  <div className="grid grid-flow-col sm:auto-cols-max justify-start sm:justify-end gap-2">
    {/* Botões de acção */}
  </div>
</div>
```

### 3. Section Cards

```tsx
className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700/60 p-6"
```

Rótulo de secção interno:
```tsx
<p className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-4">
  Rótulo
</p>
```

### 4. Tabelas de dados

- `<thead>`: `bg-gray-50/50 dark:bg-gray-900/50 border-b border-gray-100 dark:border-gray-700/60`
- `<th>`: `text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider px-6 py-3`
- `<tbody>`: `divide-y divide-gray-100 dark:divide-gray-700/50`
- `<tr>` hover: `hover:bg-gray-50 dark:hover:bg-gray-700/20 transition-colors`

### 5. Status badges (pills)

```tsx
// Crítico
"bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-500/20"
// Médio
"bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-500/20"
// Sucesso / Concluído
"bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20"
```

Sempre `rounded-full text-[10px] font-bold uppercase px-2 py-0.5`.

### 6. Botões de acção

- Primário: `bg-primary hover:bg-primary/90 text-white rounded-lg font-semibold text-sm px-4 py-2 shadow-sm transition-colors`
- Secundário: `bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700/60 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-lg font-semibold text-sm px-4 py-2`

---

## Âmbito por Fase

### Fase 1 — Simples (header + wrapper apenas)

| Ficheiro | Alterações |
|---|---|
| `src/app/admin/page.tsx` | Aplicar wrapper + header padrão |
| `src/app/perfil/PerfilClient.tsx` | Aplicar wrapper + header padrão |
| `src/app/admin/api-keys/page.tsx` | Aplicar wrapper + header padrão + badges |

**Critério de conclusão:** header idêntico ao dashboard, wrapper correcto, type-check limpo.

### Fase 2 — Médio (header + cards + tabelas)

| Ficheiro | Alterações |
|---|---|
| `src/app/admin/scoring/page.tsx` | Header + cards de configuração + tabela de resultados |
| `src/modules/ingestao/components/ImportarDados.tsx` | Header (já tem "use client"), cards de tipo + upload + historico |
| `src/app/admin/utilizadores/UtilizadoresClient.tsx` | Header + tabela de utilizadores |
| `src/app/admin/configuracao/page.tsx` | Header + cards de configuração por secção |

**Critério de conclusão:** cards e tabelas no padrão, sem classes ad-hoc de cores.

### Fase 3 — Complexo (header + filtros + tabelas avançadas)

| Ficheiro | Alterações |
|---|---|
| `src/app/alertas/page.tsx` + `_components/` | Header + filtros inline + tabela paginada + badges |
| `src/app/relatorios/RelatoriosClient.tsx` | Header + tabs + cards de KPI + tabela de subestações |

**Critério de conclusão:** filtros alinhados ao padrão `DropdownFilter`, paginação consistente.

### Fase 4 — Mobile (tokens apenas, sem mudança estrutural)

| Ficheiro | Alterações |
|---|---|
| `src/modules/mobile/components/RoteiroDia.tsx` | Border-radius, badges de risco, `text-primary` em vez de azuis hardcoded |
| `src/modules/mobile/components/FichaInteligencia.tsx` | Mesmos tokens |
| `src/modules/mobile/components/RelatorioInspecao.tsx` | Mesmos tokens |

**Restrições:**
- Não alterar estrutura de layout (bottom-nav, offline banner, scroll behaviour)
- Não alterar lógica de negócio (IndexedDB, GPS, câmara)
- 19 testes do `RoteiroDia` devem continuar a passar após as alterações

---

## Regras de Implementação

1. **Nunca usar `inline styles`** — só classes Tailwind
2. **Nunca usar `any`** — tipos explícitos
3. **Sem imports não usados** — limpar ao modificar cada ficheiro
4. **`try/finally` em todos os handlers com `setLoading`** — padrão já em vigor
5. **Verificar type-check após cada fase** com `npm run type-check`
6. **Correr 318 testes após Fase 4** com `npm test` — todos devem passar

---

## Verificações Finais

- [ ] `npm run type-check` — zero erros
- [ ] `npm test` — 318/318 passing
- [ ] Playwright E2E — smoke tests nas rotas principais

---

## O que está fora de âmbito

- Novos componentes Mosaic (DashboardCard*, charts)
- Alterações à lógica de negócio de qualquer módulo
- Alterações ao schema da base de dados
- Alterações ao motor de scoring (`engine.ts`)
- Redesign das páginas mobile além de tokens

---

## Referências

- Padrão de referência: `src/app/dashboard/DashboardClient.tsx`
- Componentes Mosaic disponíveis: `src/components/mosaic/`
- Design mockups: `stitch_fiskix/` (nível de fidelidade A — não replicar literalmente)
