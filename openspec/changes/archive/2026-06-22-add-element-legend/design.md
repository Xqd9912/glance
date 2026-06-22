## Context

The current structure preview renders a full-window Three.js canvas with one
left floating interaction card. The Python scene response already includes each
atom's element symbol, radius, and color, so the frontend can explain element
colors without asking the backend for new data.

The frontend direction is a modern tool surface: the scene stays full-bleed,
the UI stays restrained, and implemented interactions stay in the left card.
The element legend is not an interaction; it is a figure annotation shown over
the preview.

## Goals / Non-Goals

**Goals:**

- Show a larger bottom element legend when a valid structure scene is loaded.
- Derive unique legend entries from the loaded atoms in first-seen element
  order.
- Use the existing element symbol and atom color for each legend item.
- Keep the canvas full-window and avoid a visible canvas frame.
- Reserve preview safe areas so the structure and legend are framed within the
  available preview region rather than the full browser window.
- Record the export direction: a visible legend is part of the future exported
  figure, but export composition is handled by a later change.

**Non-Goals:**

- No legend settings, color pickers, element count controls, or user-facing
  visual-control panel.
- No PNG export implementation in this change.
- No Python API or scene contract changes unless implementation reveals that the
  existing atom fields are insufficient.

## Decisions

### Derive legend entries in the frontend

The legend should be computed from `scene.atoms`: keep the first occurrence of
each element, and read that atom's color. This avoids duplicating element/color
tables in TypeScript and avoids a backend change for data the scene already
contains.

Alternative considered: add a backend `legend` field. That could be useful once
legend labels need richer chemistry data, but it is unnecessary for symbol plus
color.

### Use fixed-size sphere legend markers inside a capsule container

The legend container should use a capsule shape. Individual legend markers
should remain compact shaded spheres. Their displayed size should be fixed and
intentionally larger than ordinary UI status dots, without becoming as visually
heavy as atom geometry. The legend explains color and element identity; using
actual atomic radii would make the row uneven and could make small atoms hard to
read.

Legend labels should use the app's sans font at regular weight rather than the
mono font or bold text. Element symbols here are figure labels, not code-like
values.

Alternative considered: scale markers by atom radius. That would communicate
size, but this change is only about color-to-element meaning and should stay
compact.

### Treat the legend as a figure overlay, not a control

The legend should sit near the bottom center of the available preview area as a
screen-space overlay. Its horizontal center should account for the left card and
right margin safe areas rather than using the full browser window center. It
should not live inside the left card, and it should not be part of the 3D world.
It must not rotate with the camera or be hidden behind atoms.

Alternative considered: draw the legend inside the Three.js canvas. That would
make canvas-only export simpler later, but text layout and responsive wrapping
are better handled as normal interface layout for this first step.

### Keep the canvas full-bleed and add safe-area layout

The visible canvas remains full-window because it matches the product's modern
preview feel. Instead of putting a border around the canvas, the preview should
reserve safe areas for overlays:

```text
full workspace
┌─────────────────────────────────────┐
│ left card          preview content   │
│ ┌────────┐        ┌───────────────┐ │
│ │ file   │        │ structure     │ │
│ └────────┘        └───────────────┘ │
│                                     │
│                    element legend   │
└─────────────────────────────────────┘
```

The current change only needs a simple safe-area margin so the first loaded
scene and legend align to the same usable preview region. Future camera and
export work can make this more exact.

### Keep future export frame separate from preview size

Preview fills the browser window, but exported figures need their own frame,
such as a fixed pixel size or aspect ratio. When export is implemented, the
exporter should compose the scene and visible legend relative to that export
frame rather than assuming the browser window is the final figure size.

## Risks / Trade-offs

- Legend overlay may cover very wide structures -> reserve bottom safe area and
  visually verify representative structures.
- Many distinct elements may overflow the bottom row -> allow wrapping or
  compact spacing, and keep labels short.
- HTML overlay is not automatically included in canvas-only export -> record
  this as an export-composition requirement for the later export change.
- Safe-area framing can become overfit to the current card size -> keep the
  first implementation simple and avoid turning it into a general layout-control
  system.
