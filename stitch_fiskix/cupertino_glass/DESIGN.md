# Design System Specification: Premium Minimalism & Tonal Depth

## 1. Overview & Creative North Star: "The Digital Curator"
The Creative North Star for this design system is **"The Digital Curator."** We are moving away from the "app-as-a-tool" mentality toward "app-as-a-gallery." This system is rooted in premium minimalism, where every element is treated as a curated artifact. 

We break the "standard template" look through **intentional asymmetry** and **tonal layering**. Rather than using rigid boxes to contain information, we use white space as a structural element. The goal is a high-density environment that feels paradoxically breathable—much like a high-end editorial spread or a physical architectural space.

---

## 2. Colors & Surface Architecture

### The "No-Line" Rule
To achieve a signature, high-end feel, **1px solid borders are strictly prohibited for sectioning.** Physical boundaries must be defined solely through background color shifts or tonal transitions. Use `surface_container_low` sections sitting on a `surface` background to create distinct zones without the "clutter" of lines.

### Surface Hierarchy & Nesting
Treat the UI as a series of physical layers—like stacked sheets of fine vellum.
- **Base Layer:** `surface` (#f9f9fe) or `surface_container_lowest` (#ffffff).
- **Secondary Sectioning:** `surface_container_low` (#f3f3f8).
- **Interactive Containers:** `surface_container` (#ededf2).
- **Nested Detail:** `surface_container_high` (#e8e8ed) or `highest` (#e2e2e7).

### The "Glass & Gradient" Rule
For floating elements (modals, navigation bars, tooltips), use **Glassmorphism**. Combine `surface` colors at 70-80% opacity with a `backdrop-blur` (20px-40px). This allows the background to bleed through, softening the interface. Use subtle linear gradients for primary actions, transitioning from `primary` (#0058bc) to `primary_container` (#0070eb) to give buttons a "tactile soul."

---

## 3. Typography: The Editorial Scale
We use **Inter** as our typographic backbone. It mimics the functional clarity of San Francisco while providing a more contemporary, open-source flexibility.

| Role | Token | Font | Size | Weight | Tracking |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Display** | `display-lg` | Inter | 3.5rem | 700 (Bold) | -0.02em |
| **Headline** | `headline-md`| Inter | 1.75rem | 600 (Semi-Bold) | -0.01em |
| **Title** | `title-md` | Inter | 1.125rem | 500 (Medium) | 0 |
| **Body** | `body-md` | Inter | 0.875rem | 400 (Regular) | +0.01em |
| **Label** | `label-md` | Inter | 0.75rem | 600 (Semi-Bold) | +0.05em (Caps) |

**Editorial Direction:** Use `display-lg` for impactful entry points. Create asymmetry by pairing a large display heading on the left with a `body-md` paragraph pushed to a specific column on the right, leaving intentional "dead space" to focus the eye.

---

## 4. Elevation & Depth

### The Layering Principle
Depth is achieved by "stacking" surface tiers. Place a `surface_container_lowest` card on a `surface_container_low` background to create a soft, natural lift.

### Ambient Shadows
When an element must "float" (e.g., a primary card or a dropdown):
- **Blur:** 32px to 64px.
- **Opacity:** 4% to 8%.
- **Color:** Use a tinted version of `on_surface` (e.g., a deep navy-grey) rather than pure black. This mimics natural ambient light.

### The "Ghost Border" Fallback
If accessibility requires a container boundary, use a **Ghost Border**: `outline_variant` at 15% opacity. Never use 100% opaque borders for decorative containment.

---

## 5. Components

### Buttons
- **Primary:** Gradient from `primary` to `primary_container`. Corner radius: `lg` (1rem). High-contrast `on_primary` text.
- **Secondary:** `surface_container_high` background with `primary` text. No border.
- **Tertiary:** Pure text with `primary` color; uses `surface_container_low` on hover.

### Input Fields
- **Style:** Background `surface_container_lowest` with a 1px `outline_variant` at 20% opacity.
- **Interaction:** On focus, the border disappears and is replaced by a 2px `primary` glow with a soft ambient shadow.

### Cards & Lists
- **The Divider Rule:** Forbid the use of divider lines. Separate list items using `16px` of vertical white space or by alternating background tones (`surface` to `surface_container_low`).
- **Rounding:** All cards must use `xl` (1.5rem) for outer corners and `lg` (1rem) for nested elements.

### Glass Navigation Bar
- **Style:** `surface` at 80% opacity, `backdrop-blur: 30px`.
- **Positioning:** Floating 24px from the screen bottom, rather than pinned, to enhance the "curated artifact" feel.

---

## 6. Do's and Don'ts

### Do
- **Do** use aggressive white space. If a section feels crowded, double the padding rather than adding a border.
- **Do** use tonal shifts to indicate interactivity. A button that is "pressed" should move from `surface_container` to `surface_container_high`.
- **Do** align text to a strict baseline grid to maintain the editorial feel despite the asymmetrical layout.

### Don't
- **Don't** use pure black (#000000) for text. Use `on_surface` (#1a1c1f) to maintain a premium, ink-on-paper look.
- **Don't** use standard "drop shadows" with 0 blur or high opacity. It breaks the "Digital Curator" illusion.
- **Don't** use dividers to separate content. If the hierarchy is clear, the white space will do the work for you.