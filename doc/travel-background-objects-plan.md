# Travel Background Objects Plan

This document captures the recommended architecture for adding atmospheric background objects with parallax to selected star systems. The goal is to make the feature straightforward to implement later without forcing decorative scene dressing into the combat simulation model too early.

## Summary

Atmospheric objects such as ruined stations, asteroid fields, or debris clusters should be stored as a dedicated decorative scene layer for the travel screen. They should not be modeled as part of `TravelCombatState` while they remain visual-only. The current codebase already separates simulation state from view-only rendering data, and the new background objects should follow that same boundary.

The preferred approach is data-driven:

- describe each background object as plain scene data
- generate a per-system object list when the travel session starts
- render those objects in their own canvas layer using parallax
- keep combat rules, collisions, AI, and docking logic unaware of the feature

## Recommended Structure

The new logic should live under the travel screen code rather than under the combat domain.

Recommended structure:

- `src/screens/travel/background/types.ts`
- `src/screens/travel/background/catalog.ts`
- `src/screens/travel/background/createBackgroundScene.ts`
- `src/screens/travel/renderers/backgroundRenderer.ts`

Responsibilities:

- `types.ts` defines the plain data model for decorative objects and scene profiles
- `catalog.ts` describes reusable object presets or profile rules such as asteroid clusters, wreck silhouettes, or ruined station variants
- `createBackgroundScene.ts` maps system context to a deterministic `BackgroundSceneObject[]`
- `backgroundRenderer.ts` draws that scene using the current camera and per-object parallax factors

This keeps the feature close to the existing travel render pipeline, alongside `starsRenderer.ts` and `stationRenderer.ts`, instead of mixing it into the combat simulation internals.

## Public Interfaces / Types

The core addition should be a new decorative object type rather than a new entity class hierarchy.

Suggested shape:

```ts
export interface BackgroundSceneObject {
  kind: 'asteroid' | 'wreck' | 'ruinedStation' | 'debrisCluster';
  x: number;
  y: number;
  parallax: number;
  scale: number;
  angle: number;
  variant?: string;
}
```

Important properties:

- `kind` selects the drawing routine or silhouette family
- `x` and `y` place the object in world space
- `parallax` controls how strongly the object tracks player movement
- `scale` and `angle` vary repeated shapes without extra renderer branching
- `variant` allows system-specific art direction without introducing new simulation types

The combat model should remain unchanged while these objects are decorative. In particular, `TravelCombatState` should not gain a background object collection unless the feature later becomes interactive.

The main interface change should happen in the render pipeline:

- create background scene data once during session setup in `useTravelSession`
- pass that array into `renderCanvas(...)`
- render it in a dedicated step between stars and station geometry, or in another clearly chosen background slot

## Rendering Integration

The current rendering flow already has a useful layer split:

1. black background
2. stars
3. station
4. ships
5. projectiles and particles
6. player ship
7. radar and overlays

Background objects should become their own explicit layer in that sequence. A good default is:

1. black background
2. stars
3. background objects with parallax
4. station and safe-zone ring
5. ships
6. projectiles and particles
7. player ship
8. radar and overlays

Implementation notes:

- generate the background scene once per travel session, similar to how stars are currently created once and then reused
- prefer deterministic generation from system identity or seed so the same system keeps the same atmosphere
- keep these objects visually subordinate to the station, ships, and projectiles
- stay inside the current four-color CGA palette already used by the game screens
- avoid placing decorative geometry where it makes docking, combat readability, or HUD legibility worse

## Test Plan

Add targeted tests around scene generation and integration points.

Generation tests:

- the same system identity or seed produces the same `BackgroundSceneObject[]`
- generated objects stay inside expected coordinate and parallax ranges
- rare or system-specific set pieces appear only when their rules say they should

Integration tests:

- `renderCanvas(...)` accepts and renders a background scene without affecting combat state
- background objects stay behind ships, projectiles, and HUD elements in render order
- parallax movement changes correctly with different `parallax` values

Visual verification:

- confirm that decorative objects move more slowly or more quickly than stars according to depth
- confirm that the scene remains readable during combat and station approach
- confirm that no extra colors are introduced beyond the existing CGA palette

Use Playwright only if a real browser check becomes necessary to validate layering or readability. This feature does not require browser automation by default.

## Assumptions

- These objects are currently decorative only.
- They do not participate in collisions, AI, mission triggers, or docking logic.
- Plain data objects are a better fit than per-object classes at this stage.
- The correct home for this feature is `src/screens/travel`, not `src/domain/combat`.
- If a future object becomes interactive, that specific object can later be promoted into the combat domain instead of forcing all decorative objects into simulation state now.
