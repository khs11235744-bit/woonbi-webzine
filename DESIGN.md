# Design System: 웅비 — 포항고등학교 학생 웹진
**Authoritative styles:** `web/style.css`, `web/editorial-polish.css` and `web/newsroom-v04.css` through `web/newsroom-v06.css`.
**Goal:** A credible school publication that looks and reads like a meticulously art-directed literary magazine, not a corporate dashboard.

## 1. Visual Theme & Atmosphere
Restrained Korean literary journalism with generous editorial whitespace, a typographic masthead, factual photographs and a warm newsprint texture. Content quality and readers' attention are the visual center. The visual voice is modern, sober and editorial; reject generic AI design tropes, exaggerated gradients, decorative emojis and filler imagery.

## 2. Color Palette & Roles
The final editorial polish stylesheet overrides some base tokens; inspect CSS cascade before any changes.
- **Warm page paper** `#f8f6ef` — background (`--paper` in editorial-polish).
- **Deeper paper** `#eee9dd` — section separation (`--paper-deep`).
- **Dark ink** `#14232d` — reading text (`--ink`).
- **Editorial navy** `#14394f` — masthead and primary actions (`--navy`).
- **Terracotta red** `#a83d29` — eyebrows, issue and category accents (`--accent`).
- **Muted gray** `#6f7473` — metadata (`--muted`).
- **Fine border gray** `#d4d2ca` — rules/dividers (`--line`).
- **Pure white** `#ffffff` — controls and content surfaces.

## 3. Typography Rules
- Heads / large literary display: `"Noto Serif CJK KR", "Noto Serif KR", "Batang", Georgia, serif`.
- Navigation / body / tools: `"Pretendard", "Noto Sans CJK KR", "Malgun Gothic", Arial, sans-serif`.
- Text paragraphs must be read comfortably on phones; long-form reading measure around 720px (`--measure`).
- Balance Korean headline wrapping without erasing any original title, byline or quotation.
- Masthead large and editorial; do not turn every section into a bold dashboard card.

## 4. Component Stylings
- Thin horizontal rules, low-radius controls and restrained shadows.
- Editorial primary button navy-on-white text, base 44px minimum height for touch.
- Article lead with typographic headline, understated standfirst and dominant authentic photo.
- Article cards with consistent 4:3 and 3:2 thumbnail crops where already established; use careful captions and credits.
- Full articles favor readability and source context over decorative panels.
- Preserve explicit sample/placeholder badges; fake or synthetic photos must never masquerade as documentary images.

## 5. Editorial Layout
- Desktop: balanced hero + supporting story rail; modular grids underneath.
- Mobile: one-column hierarchy, no clipped masthead or off-screen navigation; maintain accessible text size and clickable actions.
- Print / magazine output must keep bylines, photo captions, issue identifiers, and editorial sequence coherent.
- Keep the existing newsroom editorial workflow: student edits -> editor review -> teacher approval -> publication.

## 6. Integrity, Accessibility & Privacy
- Do not invent student quotes, events, photos or newspaper metadata.
- Never publish a student name, photo or draft without verifying consent and editorial authorization.
- Visible keyboard focus and descriptive accessible controls.
- Respect the existing `AGENTS.md`: do not change branch or publication workflows incidentally.

## 7. How to Use in Stitch / Antigravity
Read this DESIGN.md alongside the stylesheets; it documents intent, not a new unimplemented CSS system. Generate designs in the existing editorial language; implement only after validating mobile, real article lengths, image credits, test suite and builds. Never silently publish.
