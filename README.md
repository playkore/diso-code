# DISO Code Front-End Scaffold

A portrait-first mobile command console scaffold for a space-trading game prototype.

## Included in this scaffold

- Vite + React + TypeScript project structure.
- Mobile-first app shell with tabbed screens:
  - Market
  - Inventory/Status
  - Galaxy/System chart
  - Data on System
  - Save/Load
- Zustand store with top-level slices:
  - `universe`
  - `commander`
  - `market`
  - `ui`
- Deterministic fixed-width utility helpers:
  - `u8`
  - `u16`
  - `rotl8` (rotate-left byte)
  - wraparound add/subtract helpers for 8-bit and 16-bit values.

## Run locally

1. Install dependencies:

   ```bash
   npm install
   ```

2. Start the dev server:

   ```bash
   npm run dev
   ```

3. Build for production:

   ```bash
   npm run build
   ```

4. Preview production build:

   ```bash
   npm run preview
   ```
