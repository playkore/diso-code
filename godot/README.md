# DISO Code Godot Rewrite

This folder contains the first executable foundation of the Godot 4.5 rewrite.
It is intentionally scoped to the shared runtime backbone rather than a full
feature-parity port.

## Implemented in this pass

- Fresh Godot project with `Main.tscn` and one scene per planned screen.
- Autoload singletons:
  - `GameState`
  - `GameActions`
  - `PersistenceService`
- Ported docked-state domain modules for:
  - commander state
  - universe and system generation
  - galaxy catalog queries
  - market generation and local trade overlays
  - missions
  - fuel math
  - ship and outfitting catalogs
  - docked-state assembly and save snapshots
- Mobile-first docked shell using the existing 4-color CGA palette.
- Interactive screen scaffolding for:
  - trading
  - equipment buying
  - inventory/status
  - system data
  - nearby-system travel selection
  - mission debug triggers
  - save/load and debug controls
  - placeholder travel handoff and docking return

## Not implemented yet

- Real-time travel/combat simulation parity with the TypeScript canvas runtime.
- Full UI fidelity with the current web app layouts.
- Godot-native automated parity tests.
- Asset/resource conversion beyond the initial icon/theme scaffold.

## Run

Open this folder in Godot 4.5 and run `res://scenes/Main.tscn`.

The current environment did not have `godot` installed, so this pass was
implemented and reviewed statically rather than launched in-editor.
