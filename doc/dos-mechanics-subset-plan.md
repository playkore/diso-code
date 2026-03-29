# DOS Mechanics Subset Plan

## Summary

This implementation pass focuses on three gameplay systems that move the project
closer to DOS Elite Plus without touching presentation:

- DOS-style `rating` and `legal status`
- support for all eight generated galaxies
- `Galactic Hyperdrive` as a docked-only galaxy transition

The previous BBC-style assumptions for rank and legal state are now considered
incompatible with the DOS target and should not be treated as the reference
model for future Elite Plus work.

## Implemented In This Pass

- Replace BBC-style combat rank thresholds with DOS Elite Plus thresholds.
- Keep `tally` for compatibility, but derive visible `rating` from a dedicated
  DOS-style combat score.
- Remove BBC-style launch legal flooring and hyperspace legal cooling.
- Keep docked legal display aligned with Elite Plus save semantics:
  docked saves/projected status only distinguish `Clean` and `Offender`.
- Add `galaxyIndex` to the live universe state and make galaxy catalog lookups
  read from the active galaxy.
- Add `Galactic Hyperdrive` to the equipment catalog and implement a docked
  action that advances to the next galaxy and consumes the drive.

## Deferred

- DOS UI and graphics
- replacement of the current custom mission board with canonical DOS campaign
  progression
- travel presentation changes
- deeper DOS-only combat differences beyond rating/legal state

## Risks / Follow-ups

- Elite Plus legal-state documentation is weaker than the rank/savegame data, so
  the in-flight `Fugitive` threshold remains an implementation assumption.
- The current mission/scenario systems are only made galaxy-aware indirectly by
  reading the active galaxy catalog; they are not yet rewritten into a canonical
  DOS mission chain.
- Future DOS work should revisit mission triggers, Trumbles, and campaign flags
  on top of this galaxy-capable foundation.
