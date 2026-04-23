# EthicalHackingBot — Dashboard Redesign Plan

> Document de référence pour la refonte complète du dashboard.
> Basé sur l'analyse consolidée de 15 agents (5 d'architecture + 10 de duplication/dead code).
> Stack cible : Next.js 16, React 19, Prisma 6, Tailwind 4, shadcn/ui, PostgreSQL.

---

## 1. Objectifs

1. **Simplifier** — passer de 9 pages mal découpées à 5 pages cohérentes
2. **Éliminer les doublons** — 3 launchers de scan différents → 1 seul
3. **Éliminer le dead code** — /terminal, /reports, routes API orphelines
4. **Standardiser** — design system shadcn/ui, tokens Tailwind centralisés, composants réutilisables
5. **Fluidifier** — chaque workflow core atteignable en ≤ 2 clics

---

## 2. État actuel — diagnostic

### Métriques de complexité
| Page | Lignes | Santé |
|------|--------|-------|
| `/programs` | 1076 | Critique — monolithe |
| `/monitor` | 1004 | Critique — monolithe |
| `/mission` | 553 | Gros, doublonne /monitor |
| `/terminal` | 507 | À supprimer |
| `/analytics` | 386 | Doublonne /overview |
| `/findings` | 358 | OK mais incomplet |
| `/new-scan` | 335 | Doublonne /mission |
| `/overview` | 289 | OK |

### Problèmes structurels
- **Types dupliqués** dans chaque page (Finding, Scan, ScanConfig) — pas de `src/types/` centralisé
- **Fetch brut** sans abstraction (pas de SWR, pas de TanStack Query)
- **Pas de design system** — tokens CSS dispersés dans `globals.css`, pas de `tailwind.config.ts`
- **Pas d'error boundaries** — catch muets partout
- **4 pages affichent des findings** sans composant partagé → code dupliqué
- **3 launchers de scan** différents (mission / monitor / new-scan) → UX concurrents
- **Auth stub** — routes `/api/auth` existent mais session management absent

### Dead code confirmé
- `/terminal` + routes `/api/ollama/*` — playground Ollama, aucune infra déployée, zéro nav vers elle
- `/reports` — item sidebar qui renvoie 404 (page n'existe pas)
- Topbar notification bell sans handler
- `/api/scans/[id]` (GET/DELETE) — jamais appelée
- `/api/scans/[id]/report` — endpoint existe mais aucun bouton UI ne l'appelle
- `/api/ollama/files`, `/api/ollama/actions` — accès fichiers/actions non utilisé, risqué

---

## 3. Nouvelle architecture — 5 pages

```
┌─────────────────────────────────────┐
│  Sidebar (5 items)                  │
├─────────────────────────────────────┤
│  🏠  Dashboard                       │
│  🎯  Programs                        │
│  ⚡  Scans                           │
│  🔔  Findings                        │
│  ⚙️   Settings                       │
└─────────────────────────────────────┘
```

### 3.1 `/dashboard` (remplace /overview + /analytics)

Tabs :
- **Today** — KPIs live, bot status banner, scans en cours, findings critiques du jour, auto-refresh 10s
- **Historical** — time range (7d/30d/90d/all), bounties cumulés, revenue, scan success rate, top modules, top vulnerabilities, platform breakdown

### 3.2 `/programs`

Route racine : liste des programmes DB synced + filtres + actions.

Sous-routes :
- `/programs` — liste DB (filtres compliance, bounty, industry, safe harbour, sort)
- `/programs/[id]` — détail d'un programme (scope, ROE, bounty range, safe harbour, action "scan")
- `/programs/live` — feed Intigriti temps réel (read-only)

Tabs internes de la racine :
- **Synced** (default) — programmes DB
- **Activities** — feed scope/rule changes (déplacé depuis l'actuel /programs)
- **Payouts** — historique bounties Intigriti

### 3.3 `/scans` (fusion de /mission + /monitor + /new-scan)

Tabs :
- **Compose** — formulaire full de création (target, scope, modules, depth, rate limit, safe harbour gate)
- **Active** — queue + running + system metrics + logs live filtrables
- **History** — complete/error/cancelled + actions relaunch/resume/delete/view findings

Détail scan : `/scans/[id]` avec progress, phases, logs, compliance modal réutilisable.

### 3.4 `/findings`

Améliorations vs. l'existant :
- **Bulk actions** — checkboxes, mass update status, mass mark FP
- **Notes editor** — le champ DB existe, il faut juste l'exposer
- **Generate Report** — bouton qui appelle `/api/scans/[id]/report` (endpoint orphelin aujourd'hui)
- **Finding detail view** — drawer latéral plutôt qu'accordion
- **Filtres** : severity, status, module, scan, program, search libre

### 3.5 `/settings`

Nouveau, pour plus tard. Minimum viable :
- Intigriti API key (affichée masquée, actions : rotate, test connection)
- Notifications (webhooks Slack/Discord à venir)
- Auto-sync schedule (cron : sync Intigriti tous les X heures)

---

## 4. Suppression — à dégager définitivement

| Élément | Raison |
|---------|--------|
| `/terminal` (507L) | Playground Ollama, pas d'infra déployée, zéro usage |
| `/api/ollama/route.ts` | Dépendance Ollama morte |
| `/api/ollama/files/route.ts` | Accès filesystem risqué, non utilisé |
| `/api/ollama/actions/route.ts` | Proxy dashboard via LLM, non utilisé |
| `/reports` (sidebar entry) | Page n'existe pas, 404 garanti |
| `/api/scans/[id]` GET/DELETE | Jamais appelée |
| `/api/scans/[id]/report` | Sera re-câblée dans /findings |

Estimation : **-800 à -1200 lignes** de code mort.

---

## 5. Design system

### 5.1 Principes

- **Dark mode only** — outil de sécurité opéré 24/7
- **Densité data** — typo compacte, padding serré, information first
- **Sobre et pro** — inspiration Linear, Vercel, Tailscale admin
- **Zéro emoji décoratif** — icônes Lucide uniquement
- **Réactivité immédiate** — transitions courtes (150ms max), pas d'animations superflues

### 5.2 Tokens

**Palette** :
- Background : `#0b0d11` (base) / `#131620` (surface) / `#1a1f2e` (surface elevated)
- Borders : `zinc-800/40`
- Text : `zinc-300` (primary) / `zinc-400` (secondary) / `zinc-500` (muted)
- Accent : `#22d97a` (vert, primary actions, OK status)
- Severity :
  - Critical : `#ef4444` (red-500)
  - High : `#f59e0b` (amber-500)
  - Medium : `#a855f7` (purple-500)
  - Low : `#3b82f6` (blue-500)
  - Info : `#06b6d4` (cyan-500)

**Typo** :
- Font : `Geist` ou `Inter` (via `next/font/google`)
- Scale : xs 11px / sm 13px / base 14px / lg 16px / xl 18px / 2xl 22px / 3xl 28px
- Weights : 400 regular / 500 medium / 600 semibold / 700 bold

**Spacing** :
- Grille 4px : 1=4, 2=8, 3=12, 4=16, 5=20, 6=24, 8=32, 10=40, 12=48
- Container : `max-w-7xl`, padding responsive 20px mobile / 32px desktop
- Border radius : `md 6px` / `lg 8px` / `xl 12px` / `2xl 16px`

### 5.3 `tailwind.config.ts` cible

```ts
import type { Config } from "tailwindcss"

export default {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: { DEFAULT: "#0b0d11", surface: "#131620", elevated: "#1a1f2e" },
        accent: { DEFAULT: "#22d97a", hover: "#1cb567" },
        severity: {
          critical: "#ef4444",
          high: "#f59e0b",
          medium: "#a855f7",
          low: "#3b82f6",
          info: "#06b6d4",
        },
      },
      fontFamily: { sans: ["Geist", "Inter", "system-ui"] },
      borderRadius: { md: "6px", lg: "8px", xl: "12px" },
    },
  },
  plugins: [],
} satisfies Config
```

### 5.4 Composants à standardiser (shadcn/ui)

Ordre d'installation recommandé :
1. `Button` — variants : default, secondary, ghost, danger, icon
2. `Card` — bg-surface, border zinc-800/40, radius lg, padding 4
3. `Badge` — variants severity (5) + status (6)
4. `Input` / `Textarea` / `Select`
5. `Table` — headers sticky, hover rows, striped false
6. `Dialog` (Modal)
7. `Sheet` (Drawer latéral — pour finding detail)
8. `Toast` — bottom-right, auto-dismiss 4s
9. `Tabs`
10. `DropdownMenu`
11. `Checkbox` (pour bulk actions findings)
12. `Tooltip`

Composants métier (sur shadcn) :
- `SeverityBadge` — déjà existant, à migrer sur nouveau tokens
- `StatusBadge` — new/confirmed/false_positive/fixed/accepted/reported
- `StatCard` — déjà existant, à généraliser
- `EmptyState` — icon + text + optional CTA
- `ComplianceCard` — safe harbour + automated tooling + scope summary (réutilisé partout)
- `ScanProgressStepper` — 5 phases (Init → Recon → Scan → Analysis → Report)
- `FindingRow` / `FindingDetail` — utilisé dans /findings et dans /scans/[id]
- `LogStream` — terminal-like, auto-scroll, filter par level

---

## 6. User workflows — 4 parcours critiques

### 6.1 Lancer un scan compliant

1. `/programs` → sélectionner un program compliant (badge vert "Automated OK + Safe Harbour")
2. Clic "Scan this program" → redirect vers `/scans?tab=compose&program={id}`
3. Form pré-rempli (scope auto, rules attachées) → ajuster modules/depth → submit
4. Redirect auto vers `/scans?tab=active` → voir le scan en running

**Hard blocks** : automated tooling ≠ "allowed" OU safe harbour absent → 403 immédiat avec message clair.

### 6.2 Triage findings

1. `/dashboard` (Today) → card "X critical findings" → clic
2. Redirect `/findings?severity=CRITICAL&status=NEW`
3. Expand finding (drawer latéral) → évaluer evidence + CVSS
4. Action : Confirm / False Positive / Add Note
5. Bouton "Generate Report" → markdown ready to submit à Intigriti

### 6.3 Gérer les programmes

1. `/programs` → "Sync Intigriti" → progress bar → "X synced, Y compliant"
2. Filtre : Automated OK + Safe Harbour → liste réduite
3. Clic sur un program → `/programs/[id]` → scope tier + ROE détaillé + actions

### 6.4 Monitorer un scan live

1. `/scans?tab=active` → voir scan running
2. Progress stepper (phase) + module courant + endpoints discovered/scanned
3. Live findings count par sévérité
4. Live logs filtrables (ERROR / WARN / INFO)
5. Actions : Cancel / Resume (si checkpoint) / View Partial Findings

---

## 7. Migration — 4 phases shippables

### Phase 1 — Cleanup (1 session)
- Supprimer `/terminal`, `/api/ollama/*`, item `/reports` sidebar, routes API orphelines
- Créer `src/types/` centralisé (Finding, Scan, Program, Scope, Rule)
- Livrer : -800L, zéro risque, rollback trivial

### Phase 2 — Fondations design system (3-4 sessions)
- Setup shadcn/ui
- Créer `tailwind.config.ts` avec les tokens
- Migrer 5 composants core : Button, Card, Badge, Dialog, Sheet
- Error boundaries à chaque route principale
- Auth propre (NextAuth v5 ou token-based avec middleware)
- **Zéro impact UI visible** — invisible mais débloquant

### Phase 3 — Refonte pages core (4-5 sessions)
- Fusion `/overview` + `/analytics` → `/dashboard` avec tabs
- Fusion `/mission` + `/monitor` + `/new-scan` → `/scans` avec tabs
- Décomposition `/programs` en 3 routes
- `/findings` enrichi (bulk + report + notes + drawer)
- Migration polling → SSE pour monitor live

### Phase 4 — Polish & decommission (2-3 sessions)
- Search global (cmd+K)
- Export CSV/PDF findings
- Settings page minimum viable
- Décommission finale legacy `dashboard_v3.py` sur le VPS
- Feature flag `FEATURE_NEW_DASHBOARD` retiré

### Stratégie de cohabitation

- Feature flag côté middleware : `FEATURE_NEW_DASHBOARD=true` (default) vs legacy routes
- Rollout page par page : on merge Phase 3 route par route, pas d'un coup
- Rollback safe à chaque step : revert la route concernée sans toucher au reste

---

## 8. Décisions techniques

| Sujet | Décision | Justification |
|-------|----------|---------------|
| UI lib | shadcn/ui | Headless, zéro lock-in, s'adapte au design existant |
| State mgmt | React Context (auth/theme) + URL params (filtres) | Pas de Redux, cohérent avec stack actuelle |
| Fetch | TanStack Query | Cache, retry, invalidation — remplace les fetch bruts |
| Realtime | SSE (pas WebSocket) | Simple, compatible Next.js route handlers, suffisant pour nos besoins |
| Forms | react-hook-form + zod | Validation client + types auto |
| Icons | Lucide (déjà en place) | Rien à changer |
| Auth | NextAuth.js v5 ou JWT cookie custom | À décider Phase 2 selon les contraintes Intigriti |
| DB | Prisma + Postgres (déjà en place) | Zéro changement |

---

## 9. Critères de succès

- ✅ 5 pages de nav max
- ✅ Aucune page > 300 lignes (hors composants extraits)
- ✅ Zéro route API morte
- ✅ Zéro lien cassé / dead end UI
- ✅ Aucun composant dupliqué entre pages
- ✅ 100% des strings UI via des constants (prépare i18n futur)
- ✅ Design system documenté dans `src/components/ui/`
- ✅ Chaque workflow core < 2 clics
- ✅ Score Lighthouse > 90
- ✅ Tous les workflows testés manuellement sur mobile + desktop

---

## 10. Figma Make — Prompts prêts à coller, phase par phase

### Pipeline de design

1. Tu récupères ce fichier depuis GitHub (`design.md` sur `master`)
2. Tu copies le prompt de la phase en cours
3. Tu le colles dans **Figma Make** (Figma Desktop)
4. Figma génère les frames
5. Tu partages le fichier Figma (accès lecture au compte Atlas)
6. Atlas se connecte via Figma Remote MCP (`https://mcp.figma.com/mcp`) et lit les frames
7. Atlas code les composants React en consommant ces frames

### Règles communes à tous les prompts

Ces constantes doivent être appliquées à CHAQUE prompt — ne pas les répéter inutilement dans Figma Make si les tokens sont déjà publiés.

- **Mode** : dark only — `#0b0d11` base / `#131620` surface / `#1a1f2e` elevated
- **Accent** : `#22d97a` (vert) / hover `#1cb567`
- **Severity** : Critical `#ef4444` / High `#f59e0b` / Medium `#a855f7` / Low `#3b82f6` / Info `#06b6d4`
- **Font** : Geist (fallback Inter)
- **Typo scale** : 11 / 13 / 14 / 16 / 18 / 22 / 28 px
- **Weights** : 400 / 500 / 600 / 700
- **Border radius** : 6 / 8 / 12 / 16 px
- **Spacing** : grille 4px (4 / 8 / 12 / 16 / 20 / 24 / 32 / 40 / 48)
- **Densité serrée** — outil de sécurité, data-first, pas d'espaces vides inutiles
- **Icônes** : Lucide
- **Zéro emoji décoratif**
- **A11y** : contraste WCAG AA minimum, focus visible, aria labels sur tous les interactifs

---

### Prompt P2.1 — Design System (tokens + composants atomiques)

**Objectif** : produire le fichier Figma `EHB Design System` avec tous les tokens publiés et 6 composants de base avec leurs états.

```
Crée un design system Figma pour un dashboard de bug bounty scanner (outil de sécurité pro). Dark mode uniquement, inspiration Linear, Vercel, Tailscale admin.

TOKENS DE COULEUR à publier comme variables Figma
- bg/base : #0b0d11
- bg/surface : #131620
- bg/elevated : #1a1f2e
- border/default : rgba(39, 39, 42, 0.4) (zinc-800/40)
- text/primary : #d4d4d8 (zinc-300)
- text/secondary : #a1a1aa (zinc-400)
- text/muted : #71717a (zinc-500)
- accent/default : #22d97a
- accent/hover : #1cb567
- severity/critical : #ef4444
- severity/high : #f59e0b
- severity/medium : #a855f7
- severity/low : #3b82f6
- severity/info : #06b6d4

TYPOGRAPHIE à publier
- Font : Geist (ou Inter)
- Sizes : xs 11, sm 13, base 14, lg 16, xl 18, 2xl 22, 3xl 28
- Weights : 400, 500, 600, 700

SPACING : grille 4px (4, 8, 12, 16, 20, 24, 32, 40, 48)
RADIUS : md 6, lg 8, xl 12, 2xl 16

COMPOSANTS À PRODUIRE (chacun avec tous les états, publiés comme Main Components)

1. Button
   - Variants : primary (fond accent, text noir), secondary (border zinc-800, bg transparent), ghost (hover bg zinc-800/30), danger (fond severity/critical), icon-only (carré, 1 icône centrée)
   - Sizes : sm (h 28), md (h 36), lg (h 44)
   - States : default, hover, active, disabled (opacity 40), loading (spinner Lucide Loader2 qui tourne)

2. Card
   - Fond bg/surface, border border/default, radius lg (8), padding 16
   - Variants : default, hover (border accent/20 + lift shadow subtil), selected (border accent)

3. Badge
   - Sizes : sm (h 20, px 8, text xs), md (h 24, px 10, text sm)
   - Variants severity (5) : fond couleur à 15% opacity + text 100% opacity + pastille 6px à gauche
   - Variants status (6) : NEW (info), CONFIRMED (high), FALSE_POSITIVE (muted), FIXED (accent), ACCEPTED (medium), REPORTED (info)

4. Input
   - Fond bg/surface, border border/default, h 36, radius md, padding horizontal 12, text sm
   - Variants : default, focus (border accent + ring accent/20), error (border severity/critical), disabled, with icon (left ou right)
   - Types : text, password (avec toggle reveal), search (icon Lucide Search gauche)

5. Dialog (Modal)
   - Overlay : fond noir opacity 60 + backdrop-blur 4px
   - Container : centré, max-width 480, padding 24, radius xl, fond bg/elevated, border border/default
   - Structure : header (title 2xl semibold + close X icon-only button), body (gap 16), footer (flex justify-end gap 8)

6. Empty state
   - Container vertical centered, padding 48
   - Icon Lucide 48px text/muted
   - Title text 2xl semibold text/primary
   - Description text sm text/muted, max-width 320
   - Optional CTA button primary

LIVRABLES
- 1 frame "Tokens" avec color swatches nommés + echantillons typo + spacing ruler
- 6 frames "Component: [Nom]" avec tous les états visibles en grille horizontale
- Tous les composants publiés comme Main Components pour réutilisation

NE PAS inclure : logo, branding, marketing.
```

---

### Prompt P3.1 — Dashboard (Overview + Analytics en tabs)

```
Crée la page "/dashboard" d'un dashboard bug bounty scanner. Utilise le fichier EHB Design System (tokens + composants publiés).

LAYOUT GLOBAL (appliqué à toutes les pages du projet)
- Sidebar gauche fixe 240px (collapsed 64px) avec 5 items nav : Dashboard (actif), Programs, Scans, Findings, Settings. Logo en haut, user menu en bas.
- Topbar h 56px : search bar globale au centre (placeholder "Search scans, findings, programs... (⌘K)"), icône notification bell à droite, avatar user
- Content area : padding 32, max-width 1440 centered

STRUCTURE DE LA PAGE
- Header : titre "Dashboard" (text 3xl bold) + date du jour (muted) + bouton "Sync Programs" primary à droite
- Tabs horizontales sous le header : "Today" (actif), "Historical"

TAB TODAY
- Banner status bot : si online → card verte compacte "Bot online — last scan 14 min ago" / si offline → card rouge
- Grille 4 colonnes de StatCard :
  - "Total Scans today" (chiffre 2xl + delta 24h en petit)
  - "Active Scans" (chiffre + spinner inline si > 0)
  - "New Findings" (chiffre + 5 micro badges severity en footer)
  - "Critical Findings" (chiffre 3xl en severity/critical)
- Grille 2 colonnes de Card :
  - Card "Severity distribution" : horizontal bar chart 5 sévérités (Critical → Info), chaque barre avec count + pourcentage
  - Card "Recent scans" : liste 10 derniers scans, colonnes target / status badge / duration / findings count

TAB HISTORICAL
- Filtre time range en haut à droite du tab content : pills 7d / 30d / 90d / All (active filled accent)
- Grille 4 StatCard (scope filtré par range) : Total Bounties / Revenue EUR / Targets Scanned / Success Rate %
- Grille 2x2 de charts dans des Card :
  - Scans per month (bar chart)
  - Revenue per month (bar chart)
  - Top 10 Modules by findings (horizontal bars)
  - Platform Performance (mini table : platform / scans / findings / reported / accepted / bounty)

ÉTATS À PRODUIRE
- Default (avec data mock cohérente)
- Loading (skeleton sur les cards, shimmer animation)
- Empty (pas encore de scans : CTA "Run your first scan" → /scans?tab=compose)
- Error (bot unreachable : card rouge avec message + retry button)
```

---

### Prompt P3.2 — Scans (Compose + Active + History en tabs)

```
Crée la page "/scans" d'un dashboard bug bounty scanner. Utilise EHB Design System. Même layout global que Dashboard.

STRUCTURE DE LA PAGE
- Header : titre "Scans" + stats mini en pills (Queued 3 / Running 1 / Completed today 12)
- Tabs : "Compose" (actif), "Active", "History"

TAB COMPOSE (formulaire nouveau scan)
- Layout 2 colonnes : form à gauche (flex 2), preview compliance à droite (flex 1, sticky top 88)
- Form sections dans des Card séparées :
  1. "Target" — input domain + toggle "Use program scope" (si ON, désactive la section 2 et pré-remplit)
  2. "Scope entries" — liste dynamique (add/remove), chaque row : input URL + type dropdown (wildcard/exact/IP) + button remove
  3. "Modules" — grid 4 colonnes de checkboxes : IDOR, Access Control, Info Disclosure, XSS, SQLi, CSRF, SSRF, Differential (chacun avec description tooltip)
  4. "Config" — depth slider (quick/standard/deep), rate limit slider (1-60 req/min)
  5. "Compliance gate" (card obligatoire, bordée accent) :
     - Safe Harbour checkbox avec texte légal complet en dessous (text sm muted, max-height 80 scrollable)
     - Display Program Compliance : badge green "Automated OK" OU red "Automated tooling not allowed" OU yellow "Conditional"
     - Si red : error banner "Cannot launch — this program forbids automated tooling" + bouton Launch disabled
- Bouton Launch Scan en bas, primary lg, disabled tant que form invalide (tooltip raison)

Panel compliance preview (colonne droite) :
- Card "Program info" : name, bounty range, industry, safe harbour ✓/✗
- Card "Scope enforcement" : N entries authorized, aperçu liste (5 premières)
- Card "Rules of Engagement" : User-Agent, Request Header requirements

TAB ACTIVE (queue + running + metrics + logs)
- Section "System metrics" : grid 4 StatCard (CPU % / RAM % / Disk GB used / Uptime)
- Section "Queued" : liste de scans QUEUED, chaque row : target, program, created at, bouton Start primary
- Section "Running" (centrale) : pour chaque scan RUNNING
  - Card expandable avec phase stepper (Init → Recon → Scan → Analysis → Report, phase active mise en avant)
  - Row info : module courant, endpoints discovered/scanned/%
  - Findings live count : 5 micro badges severity
  - Elapsed + ETA à droite
  - Actions : Cancel (danger ghost) / Expand logs (chevron)
- Section "Live logs" en bas (full width) :
  - Terminal-like : fond zinc-950, font JetBrains Mono, text 12
  - Filters toolbar : level multi-select (ERROR/WARN/INFO/DEBUG), module dropdown, search
  - Auto-scroll, max 200 entries visibles, older entries virtualized
  - Chaque ligne : timestamp muted / level colored / module muted / message

TAB HISTORY
- Filtres toolbar : status multi (COMPLETE/ERROR/CANCELLED), program dropdown, date range picker
- Table virtualized : target / program / started-at / duration / findings count per sev (5 mini badges) / status badge / actions menu (⋯)
- Actions menu : View findings → /findings?scan=X / Relaunch (ouvre Compose pré-rempli) / Delete (confirm modal)

ÉTATS
- Tab Active empty (no running scans) : illustration Lucide ShieldCheck + "All clear — queue a new scan"
- Tab Active scan error : card rouge avec error message + bouton "Resume from checkpoint" si dispo
- Tab History empty : "No scan history yet"
- Compose form invalid : inline errors sous chaque champ concerné
```

---

### Prompt P3.3 — Programs (racine + detail + live + tabs activities/payouts)

```
Crée la page "/programs" d'un dashboard bug bounty scanner. Utilise EHB Design System. Même layout global.

STRUCTURE DE LA PAGE
- Header : titre "Programs" + bouton "Sync Intigriti" primary + "Last sync: 12 min ago" muted à droite
- Tabs : "Synced" (actif, DB), "Live (Intigriti)", "Activities", "Payouts"

TAB SYNCED
- Filter sidebar gauche 280px (collapsible avec bouton):
  - Input search "Program name"
  - Group "Compliance" : checkboxes (Automated Allowed, Conditional, Not Allowed)
  - Group "Safe Harbour" : radio (Yes / No / All)
  - Group "Bounty type" : radio (Has Bounty / Responsible Disclosure / All)
  - Group "Industry" : multi-select dropdown dynamique
  - Group "Confidentiality" : radio (Public / Application Only / All)
  - Group "Sort by" : radio (Recently Synced / Highest Bounty / Name A-Z)
  - Bouton "Reset filters" ghost en bas
- Grid 3 colonnes de ProgramCard :
  - Header row : Program name (text lg semibold) + logo Intigriti small à droite
  - Compliance traffic light : grosse pastille green/red/yellow + label
  - Bounty range : min - max EUR (ou "Responsible Disclosure" si pas de bounty)
  - Tags : industry, confidentiality
  - Safe Harbour row : ✓ ou ✗ avec label
  - Footer : button "Scan" primary (disabled si not_allowed, tooltip raison) + button "Details" ghost

PAGE DETAIL (/programs/[id])
Peut être implémentée comme route dédiée OU comme Sheet drawer latéral. Préférer Sheet pour rapidité.
- Header : program name + logo + lien "View on Intigriti" external
- Sections scrollables :
  1. Compliance card : Safe Harbour, Automated Tooling (badge), User-Agent required, Request Header required
  2. Scope table : Tier (In Scope / Out of Scope) / Endpoint / Type / Description
  3. Bounty : range + 5 dernières payouts (mini list)
  4. Rules of Engagement : texte markdown rendu, collapsed à 200px avec "Read more"
- Footer actions sticky : "Scan now" primary / "Open in Intigriti" secondary / "Disable" danger ghost

TAB LIVE (Intigriti feed real-time, read-only)
- Même grid card layout que Synced mais data directe de /api/intigriti/programs
- Sur chaque card : bouton "Import to DB" au lieu de "Scan"
- Badge "Not synced" si pas encore en DB

TAB ACTIVITIES
- Liste chronologique des events scope/rule changes
- Chaque row : timestamp + icon event type + program name + diff (ex: "Added *.toyota.com to scope")
- Filtres : program, event type

TAB PAYOUTS
- Table : amount EUR + currency / status badge (Paid/Pending) / awarded date / program / scan reference link
- Bouton "Export CSV" en haut à droite
- Total revenue en grande card en haut

ÉTATS
- Loading : skeleton cards
- Sync en cours : progress bar full width "Syncing... 45/120 programs"
- Error Intigriti API down : banner rouge en haut + retry
- Empty Synced : "No programs synced yet — click Sync Intigriti"
- Empty after filters : "No programs match your filters" + reset CTA
```

---

### Prompt P3.4 — Findings (liste + drawer detail + bulk actions)

```
Crée la page "/findings" d'un dashboard bug bounty scanner. Utilise EHB Design System. Même layout global.

STRUCTURE DE LA PAGE
- Header : titre "Findings" + stats mini pills (Total 247 / Critical 3 / New 12)
- Toolbar sticky :
  - Input search (placeholder "Search title, description, URL...")
  - Filter chips multi-select : Severity (5 levels), Status (6 statuses), Module, Scan, Program
  - Sort dropdown : Severity desc (default) / Date desc / CVSS desc
  - Reset filters (visible si filtres actifs)
- Bulk actions bar (apparaît quand selection ≥ 1, remplace la toolbar avec animation) :
  - "N selected" label
  - Buttons : Mark Confirmed / Mark FP / Generate Report / Export / Delete
  - Bouton Cancel (clear selection)

- Table findings (virtualized si > 100 rows) :
  - Column 1 : Checkbox (header = select all on page)
  - Column 2 : Severity badge
  - Column 3 : Status badge
  - Column 4 : Title (text sm medium, truncate)
  - Column 5 : Module (text xs muted)
  - Column 6 : URL (text xs muted, truncate 40 chars)
  - Column 7 : CVSS score (mono)
  - Column 8 : Date (relative : "2h ago")
  - Row click → ouvre Sheet drawer latéral droit (sans quitter la page)
  - Row hover : background zinc-800/30

DRAWER DETAIL (Sheet component, width 640)
- Header sticky : severity badge + title (text xl semibold) + status dropdown + close X
- Sections scrollables :
  1. Meta grid 2 cols : URL (copyable, link external) / CWE / CVSS / Confidence / First seen / Scan link
  2. Description : markdown rendu (padding Card)
  3. Evidence : JSON viewer (syntax highlight, copyable)
  4. Remediation : markdown rendu
  5. Notes : textarea editable (auto-save on blur), timestamp de dernière modif
- Footer sticky actions :
  - "Mark Confirmed" primary
  - "Mark False Positive" secondary
  - "Generate Report" ghost → télécharge markdown
  - "Delete" danger ghost (confirm modal)

ÉTATS
- Loading : skeleton rows (10 rows)
- Empty no findings : illustration Lucide ShieldCheck (80px text/accent) + "No vulnerabilities detected — your scans are clean"
- Empty after filters : "No findings match your filters" + CTA Reset filters
- Error : banner rouge en haut + retry
- Bulk action confirmation : modal avec count et preview action
```

---

### Prompt P3.5 — Settings (minimum viable, optionnel en Phase 4)

```
Crée la page "/settings" d'un dashboard bug bounty scanner. Utilise EHB Design System. Même layout global.

STRUCTURE
- Header : titre "Settings"
- Layout 2 colonnes : nav verticale gauche 200px + content area

Nav items (Card items verticaux, item actif fond bg/elevated + border-left accent 2px) :
- General, Intigriti, Notifications, API, Danger Zone

TAB GENERAL
- Card "Account" : email readonly, name input editable, timezone dropdown, Save button
- Card "Appearance" : theme locked "Dark" (toggle disabled avec tooltip "Light mode coming soon")

TAB INTIGRITI
- Card "API Key" :
  - Input masked (••••••••1234) avec boutons Reveal (eye icon) / Copy / Rotate (confirm modal) / Test connection (affiche green ✓ ou red ✗ inline)
- Card "Auto-sync" :
  - Toggle enable
  - Interval dropdown (Off / Hourly / Every 6h / Daily) — disabled si toggle off
  - Last sync info (muted)

TAB NOTIFICATIONS
- Card "Channels" : Telegram webhook URL input / Slack webhook URL input / Discord webhook URL input (chacun avec Test button)
- Card "Events" : checkboxes (New critical finding / Scan complete / Sync complete / Compliance violation / Scan error)

TAB API
- Card "Webhook endpoint (inbound)" : URL read-only copyable + explication courte
- Card "API Tokens" : liste existants (name / created / last used / Revoke button) + bouton "Create new token" (ouvre modal avec scopes)

TAB DANGER ZONE
- Card bordée severity/critical :
  - "Purge all findings" danger ghost (confirm modal : type nom projet pour confirmer)
  - "Delete account" danger (confirm modal : type email)

ÉTATS
- Save success : toast bas-droite vert "Saved" auto-dismiss 3s
- Save error : toast rouge avec message
- Test connection loading : spinner dans le bouton
- Test connection OK : badge green inline "Connected"
- Test connection KO : badge red inline "Failed: [reason]"
```

---

### Ordre d'exécution recommandé

1. **P2.1 Design System** → atomiques en premier, réutilisés partout, débloque tout le reste
2. **P3.1 Dashboard** → page la plus simple, bon warmup pour valider le flow Figma Make → MCP → code
3. **P3.4 Findings** → cœur du workflow user (triage)
4. **P3.2 Scans** → le plus complexe (3 tabs, forms, live logs)
5. **P3.3 Programs** → data-heavy mais pattern proche de Findings une fois le drawer standardisé
6. **P3.5 Settings** → moins prioritaire, peut glisser en Phase 4 polish

Une fois chaque frame prêt côté Figma, tu me partages le fichier (accès lecture) et tu me donnes les liens des frames concernés. Je lis via MCP et je code les composants/pages React correspondants.

---

## 11. Next steps

1. Je commit ce `design.md` sur `master` — tu le récupères sur GitHub
2. Phase 1 cleanup en parallèle (supprimer `/terminal`, `/reports`, routes API mortes) — sans risque, peut tourner pendant que tu designs
3. Tu attaques P2.1 dans Figma Make sur ton laptop
4. Quand le design system est prêt, tu me donnes l'accès au fichier Figma + les liens des frames
5. Je setup le Figma Remote MCP côté VPS (une commande), je lis les frames, je code les composants dans `src/components/ui/`
6. On enchaîne page par page : chaque phase P3.x que tu valides dans Figma → je code direct

---

*Document v1 — 2026-04-23. À updater à chaque fin de phase.*
