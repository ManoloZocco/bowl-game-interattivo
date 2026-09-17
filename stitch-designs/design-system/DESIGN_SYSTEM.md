# Design System: Eco-Tech Culinary Experience

## Brand & Style

The design system blends botanical warmth with rigorous scientific transparency. Developed for an interactive serious game on food climate footprints, it balances approachable culinary tactile cues with precise ecological metric feedback. The visual environment evokes freshness, curiosity, and empowerment rather than ecological guilt or clinical austerity.

The design movement is **Tactile Warm Modernism** layered over clean informational structures. It combines soft porcelain ground planes, crisp elevated ingredient tiles, organic curves, and dynamic visual indicators that translate complex life-cycle assessments into immediate, gamified clarity.

## Layout & Spacing

The system runs on an 8pt modular grid with a fluid response tailored for tablet kiosks, mobile handheld interactions, and desktop web configurations:

- **Desktop & Landscape Tablet**: 12-column grid with a sticky dual-pane structure. The left pane (7 columns) hosts ingredient category tabs and ingredient cards. The right pane (5 columns) houses the real-time "Bowl Canvas," the live carbon odometer, and ecological metric comparisons.
- **Mobile**: Single-column vertical stream. The carbon odometer collapses into an elevated bottom summary bar, maintaining thumb accessibility for ingredient additions.
- Outer padding adapts from `margin` on mobile devices to `margin-desktop` on wide-screen configurations to create an airy culinary magazine feel.

## Elevation & Depth

Surfaces rely on subtle ambient shadows tinted with deep forest tone (`#1B4D3E`) rather than harsh blacks, preserving a natural paper-and-ceramic sensation:

- **Base Layer (Level 0)**: Background `#F9F8F6` canvas with zero shadow.
- **Surface Cards (Level 1)**: Crisp `#FFFFFF` surfaces with `0 2px 8px -2px rgba(27, 77, 62, 0.06), 0 1px 3px 0 rgba(27, 77, 62, 0.04)`. Border: 1px solid `rgba(27, 77, 62, 0.08)`.
- **Active / Interactive Hover (Level 2)**: Elevated ingredient cards when picked or hovered: `0 12px 24px -6px rgba(27, 77, 62, 0.10), 0 4px 8px -2px rgba(27, 77, 62, 0.04)`. Slight negative Y translate (-2px).
- **Persistent Metric Sheets / Overlays (Level 3)**: Modals, tooltips, and floating odometer decks: `0 20px 32px -8px rgba(15, 23, 42, 0.12), 0 8px 16px -4px rgba(15, 23, 42, 0.06)`.

## Components

### Buttons
- **Primary Action**: Deep Forest Sage (`#1B4D3E`) background, pure white text, 12px vertical by 24px horizontal padding, 12px radius. On hover, deepens tone with a subtle upward spring.
- **Secondary Action**: Warm porcelain background with a 1.5px border in `#1B4D3E`, dark slate text.
- **Interactive Game Action**: Fresh Mint (`#10B981`) pill button with bold white text for "Aggiungi alla Bowl" (Add to Bowl) state.

### Interactive Ingredient Chips & Cards
- **Base State**: Pure white background, 16-20px rounded corners, subtle inner border. Displays a high-resolution food illustration or bold emoji badge, ingredient name in `title-md`, portion gram weight, and the carbon pill tag.
- **Selected State**: Outlined with a 2px active border in `#10B981` and a soft background wash of `#E8F5E9`. Shows an animated checkmark counter badge in the top right.

### Carbon Footprint Pill Tags
- Compact full-radius tags placed on cards and list entries.
- Format: `[Dot Indicator] [CO₂e Value] [Tier Label]`.
- Low: `#E8F5E9` background, `#166534` text.
- Medium: `#FEF3C7` background, `#B45309` text.
- High: `#FEE2E2` background, `#B91C1C` text.

### Real-Time Odometer & Metric Deck
- Displays cumulative $g\text{CO}_2\text{e}$ and water/land usage metrics.
- Uses large tabular figures with rolling mechanical counter transitions upon ingredient selection.
- Features a dynamic gradient meter (Mint to Coral) showing proximity to the target sustainable meal budget (e.g., `< 600g CO₂e`).

### Form Controls & Switches
- **Checkboxes & Radios**: 20px rounded elements with a 2px stroke in `#1B4D3E`. Active fill transitions to Fresh Mint with clean white vector marks.
- **Search & Filter Inputs**: 48px height, 12px corner radius, warm white background, `#0F172A` text, and a focused outline of 2px in `#10B981`.

## Color Tokens

```json
{}
```

## Typography

```json
{}
```

## Spacing & Metrics

```json
{}
```
