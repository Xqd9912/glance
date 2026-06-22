## ADDED Requirements

### Requirement: Browser preview shows an element legend

The frontend SHALL show a read-only element legend when a valid structure scene
is loaded. The legend SHALL derive one entry per unique element from the loaded
scene atoms, using the first occurrence order from the scene. Each legend entry
SHALL show the element symbol in the app's sans font at regular weight and a
fixed-size sphere marker using that element's scene color. The legend container
SHALL use a capsule shape.

#### Scenario: Show legend for a loaded scene

- **WHEN** the frontend receives a successful structure scene containing atoms
  for multiple elements
- **THEN** the preview shows one legend entry per unique element
- **AND** each entry shows the element symbol and the corresponding atom color

#### Scenario: Preserve element ordering

- **WHEN** the scene atoms contain repeated elements
- **THEN** the legend lists each element only once
- **AND** the legend order follows the first time each element appears in the
  scene atom list

#### Scenario: Hide legend without a valid scene

- **WHEN** no structure is loaded or the current upload failed to parse
- **THEN** the preview does not show an element legend

### Requirement: Preview layout preserves full-bleed canvas with overlay safe areas

The frontend SHALL keep the structure preview canvas full-window and SHALL NOT
draw a visible canvas frame. When a scene is loaded, the preview layout SHALL
reserve screen-space safe areas for the left interaction card and the bottom
element legend so the primary structure view is not intentionally placed beneath
those overlays.
The bottom legend SHALL be horizontally centered within the available preview
area after those safe areas are applied.

#### Scenario: Canvas remains full-window

- **WHEN** the structure preview is displayed
- **THEN** the canvas fills the preview workspace
- **AND** the UI does not add a visible border or framed image container around
  the canvas

#### Scenario: Structure avoids overlay regions

- **WHEN** a loaded scene is framed for preview
- **THEN** the primary structure view is positioned within the available preview
  area outside the left card and bottom legend safe areas

#### Scenario: Legend aligns to available preview area

- **WHEN** a loaded scene shows the element legend
- **THEN** the legend's horizontal position is centered within the available
  preview area outside the left card and right margin safe areas

### Requirement: Legend is part of future figure export semantics

The system SHALL treat a visible element legend as figure content for future
GUI exports. Export implementation is outside this change, but later export
work SHALL compose the legend relative to an explicit export frame rather than
using the browser window size as the final figure boundary.

#### Scenario: Export design preserves visible legend intent

- **WHEN** a future GUI export is implemented
- **THEN** the export behavior includes the visible element legend by default
- **AND** the legend position is resolved relative to the export figure frame
