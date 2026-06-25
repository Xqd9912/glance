## MODIFIED Requirements

### Requirement: Preview provides a left tab panel for common controls

The frontend SHALL show a second left floating card below the structure summary card after a valid scene is loaded. The card SHALL use tabs for `Camera`, `Display`, `Style`, and `Export`; SHALL default to `Display`; SHALL show the active tab with icon plus full label; and SHALL show inactive tabs as icon-only controls with accessible labels and tooltips. The panel height SHALL follow the active tab content with a short transition and SHALL NOT use internal scrolling for common controls.

#### Scenario: Show tab panel after scene load

- **WHEN** a structure scene loads successfully
- **THEN** the left tab panel appears below the structure summary card
- **AND** the `Display` tab is selected by default
- **AND** all four tabs are present

#### Scenario: Switch tabs

- **WHEN** the user selects a different tab
- **THEN** the active tab shows its icon and full label
- **AND** inactive tabs remain icon-only with accessible labels and tooltips
- **AND** the card height transitions to the selected tab content height

#### Scenario: Show implemented and reserved pages

- **WHEN** the user opens `Display`, `Style`, or `Export`
- **THEN** the tab shows implemented controls for that tab
- **AND** it does not show a reserved-state message for implemented controls
- **WHEN** the user opens `Camera`
- **THEN** the tab shows a short reserved-state message
- **AND** it does not show disabled placeholder controls for features that are not implemented

## ADDED Requirements

### Requirement: Export tab controls figure export settings

The `Export` tab SHALL expose compact controls for output width, output height, aspect-ratio lock, supersampling factor, 3D mesh-detail preset, output format, and a single export action. Output format SHALL be selected as a setting, not by separate competing action buttons. The export action label SHALL reflect the selected output format.

#### Scenario: Show export controls

- **WHEN** a structure scene has loaded successfully and the user opens `Export`
- **THEN** the tab shows width and height controls
- **AND** it shows an aspect-ratio lock control between the size fields
- **AND** it shows a supersampling control
- **AND** it shows a 3D mesh-detail control with `Low`, `Medium`, `High`, and `XHigh`
- **AND** it shows a format control with `PNG` and `PDF`
- **AND** it shows one primary export action

#### Scenario: Format selection updates the action

- **WHEN** the user selects `PNG` as the output format
- **THEN** the primary action is labeled for PNG export
- **WHEN** the user selects `PDF` as the output format
- **THEN** the primary action is labeled for PDF export

### Requirement: Export size supports locked and unlocked tight-box aspect ratios

The frontend SHALL maintain export width and height as explicit pixel values. When aspect-ratio lock is enabled, editing either size field SHALL update the other size field using the projected tight-box aspect ratio for the current preview orientation and currently visible exported elements. The tight box SHALL reflect component visibility, including periodic-image visibility choices such as one-hop bonded atoms. When aspect-ratio lock is disabled, width and height SHALL be independently editable.

#### Scenario: Locked width edit updates height

- **GIVEN** aspect-ratio lock is enabled
- **WHEN** the user edits the export width to a valid positive value
- **THEN** the export height updates to preserve the current projected tight-box aspect ratio

#### Scenario: Locked height edit updates width

- **GIVEN** aspect-ratio lock is enabled
- **WHEN** the user edits the export height to a valid positive value
- **THEN** the export width updates to preserve the current projected tight-box aspect ratio

#### Scenario: Visible periodic images affect locked aspect ratio

- **GIVEN** aspect-ratio lock is enabled
- **WHEN** the user shows or hides one-hop bonded atoms
- **THEN** the projected tight box is recomputed from the visible exportable scene elements
- **AND** later locked size edits use the updated tight-box aspect ratio

#### Scenario: Unlocked size edits are independent

- **GIVEN** aspect-ratio lock is disabled
- **WHEN** the user edits the export width or export height to a valid positive value
- **THEN** the other size field keeps its current value

### Requirement: Export separates 2D output quality from 3D mesh detail

The frontend SHALL treat output size and supersampling as 2D export settings, and SHALL treat `Low`, `Medium`, `High`, and `XHigh` as 3D mesh-detail presets. Mesh-detail presets SHALL control atom and bond geometry detail together. Users SHALL NOT be required to configure separate atom and bond mesh-detail values for the first export slice.

#### Scenario: Supersampling is a 2D output setting

- **WHEN** the user chooses a supersampling factor
- **THEN** export uses that factor when rendering the raster image
- **AND** the selected supersampling factor does not change the preview scene

#### Scenario: Mesh detail is a 3D preset

- **WHEN** the user chooses a 3D mesh-detail preset
- **THEN** export uses the selected preset for atom and bond geometry detail
- **AND** the selected preset does not expose separate atom and bond mesh controls
- **AND** the selected preset does not change the preview scene

### Requirement: Export uses current orientation with an independent export frame

The frontend SHALL export the currently loaded visible structure scene using a camera-pose snapshot derived from the current preview orientation. Export SHALL use the explicit export frame size and projected tight-box fitting logic rather than the browser viewport size. Preview zoom SHALL NOT define the exported image pixel size.

#### Scenario: Export follows current orientation

- **WHEN** the user rotates the loaded preview and then exports a figure
- **THEN** the exported figure uses the current preview orientation
- **AND** the exported figure keeps the structure centered in the export frame
- **AND** fitting is based on a tight box around the currently visible exported scene elements

#### Scenario: Export size is independent from preview size

- **WHEN** the browser window size changes without changing export width or height
- **THEN** the next export keeps the configured export width and height

#### Scenario: Preview zoom does not set output dimensions

- **WHEN** the user changes preview zoom and then exports a figure
- **THEN** the exported file keeps the configured export width and height
- **AND** export fitting is resolved inside the export frame rather than by the preview canvas size

### Requirement: Export generates PNG and raster-backed PDF files with vector unit-cell boundary

The frontend SHALL generate PNG output directly from the export raster image. The frontend SHALL generate PDF output by placing the same raster image into a PDF page that matches the export frame. When the unit cell is visible, PDF output SHALL also draw the unit-cell boundary as vector PDF lines projected into the same export frame. PDF output SHALL NOT attempt to convert the full Three.js scene into vector geometry.

#### Scenario: Export PNG

- **WHEN** `PNG` is selected and the user activates the export action
- **THEN** the frontend downloads a PNG file generated from the current export settings
- **AND** the PNG pixel dimensions match the configured export width and height

#### Scenario: Export PDF with vector unit-cell boundary

- **WHEN** `PDF` is selected and the user activates the export action
- **THEN** the frontend downloads a PDF file
- **AND** the PDF contains the exported raster image placed on a page matching the export frame
- **AND** the visible unit-cell boundary is represented as vector PDF line geometry

#### Scenario: Format shares the same render settings

- **WHEN** the user switches between `PNG` and `PDF`
- **THEN** width, height, aspect-ratio lock, supersampling, and 3D mesh-detail settings keep their current values

### Requirement: First figure export omits overlay assets

The first figure export SHALL export the main structure figure only. It SHALL NOT include the element legend or the orientation gizmo in the generated PNG or PDF. The export design SHALL keep these overlays out of the first output while preserving a future path for separate or composited overlay export.

#### Scenario: Export main structure without legend or gizmo

- **WHEN** a loaded preview shows the element legend or orientation gizmo
- **AND** the user exports PNG or PDF
- **THEN** the exported file contains the main structure figure
- **AND** it does not contain the element legend
- **AND** it does not contain the orientation gizmo
