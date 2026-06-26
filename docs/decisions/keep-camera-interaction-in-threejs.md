# Keep Camera Interaction in Three.js

## Status

Accepted. Updated 2026-06-26 to clarify the camera snapshot and command
boundary after the camera-direction UI work.

## Plain Version

We tried two mental models for preview zoom.

The first model was **React-owned zoom**:

```text
wheel event
-> compute a new viewScale in React
-> update React state
-> re-render the preview tree
-> write the new zoom back to the Three.js camera
```

That was easy to wire to the zoom slider and percent input, but it made a small
camera movement travel through a large React tree. With small structures this
felt fine. With structures containing thousands of atoms, one scroll gesture
could make React revisit many atoms, bonds, and polyhedra over and over.

The second model is **Three.js-owned camera interaction**:

```text
wheel or drag input
-> Three.js controls update the camera directly
-> small UI controls read snapshots of the resulting camera state
```

This is closer to how rotation already works. The camera interaction stays
light, and the React UI follows it instead of driving every tiny input event.

## Context

Pretty Lattice uses React for application UI and React Three Fiber / Three.js
for the crystal preview. The preview can contain many renderable objects, so
high-frequency input should avoid unnecessary React work.

Rotation already felt smooth because TrackballControls changed the camera
directly. Zoom originally took a different route because the left rail needed a
shared value for the slider, percent input, reset, and clamp. That made the UI
state convenient, but it also made zoom heavier than rotation.

The performance issue became visible with larger structures: zoom could feel
like it was growing while trembling, while rotation remained smooth.

## Decision

High-frequency camera interaction belongs in Three.js controls.

TrackballControls and OrbitControls should own wheel, touch, and middle-button
zoom behavior. React may display camera values such as view scale, primary
direction, roll, and derived vectors, but those values are snapshots for UI, not
the ownership path for every controls event.

Bounds such as 20%-500% should be translated into Three.js camera zoom limits.
The rail slider, percent input, and reset button may still set a target view
scale, but after that the camera controller applies it to the camera.

For camera data that needs to cross the Three.js / React boundary, use two
separate channels:

- **Snapshots:** Three.js controls publish the current camera state to narrowly
  subscribed UI widgets. These snapshots should not live in top-level app state
  if changing them would re-render the crystal preview tree.
- **Commands:** UI widgets send target camera changes to the camera controller.
  The controller applies the command directly to the camera and then publishes a
  fresh snapshot.

This boundary is the fix. Frame coalescing, epsilon tuning, and idle-delay
adjustments can improve polish, but they should not be the primary performance
strategy.

Orientation-derived UI should follow the same rule. During an active drag,
inertial rotation, or camera animation, controls such as the roll wheel,
direction vectors, and linked aspect-ratio display may hold their last committed
snapshot. Once camera motion settles, they can jump to the new committed value.
That keeps the UI readable without moving the high-frequency camera loop into
React.

## Consequences

- Rotation and zoom use the same interaction ownership model: Three.js handles
  the fast camera movement.
- React remains responsible for visible controls and user-facing state, but it
  should not re-render the crystal object tree for every wheel tick.
- The zoom rail can stay synchronized by listening to camera snapshots, while
  rail input sends commands back to the camera controller.
- App-level state should store low-frequency configuration and user intent, not
  live camera snapshots that change every frame.
- Future camera features should first ask whether they are high-frequency
  interaction or low-frequency UI configuration. High-frequency behavior should
  stay near the Three.js camera layer; React should subscribe to snapshots or
  send commands across that boundary.
