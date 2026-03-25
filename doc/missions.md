# Mission Catalog

This document describes the mission set currently implemented in the game and
the gameplay rules each mission applies. The mission system is built around
explicit mission instances rather than a legacy bitfield, so each contract can
own its own cargo, route modifiers, inbox messages, and completion logic.

## Credit Format

- Mission rewards use the same internal credit format as the rest of the game.
- Values are stored in tenths of a credit.
- Example: an internal reward value of `1400` is displayed as `140.0 Cr`.

## Mission System Overview

- Missions are generated as dockside contract offers.
- Accepting a contract may add mission-only cargo to the commander.
- Missions can change encounter pressure during travel.
- Missions can post briefing, reveal, warning, and choice messages to the
  mission inbox.
- Completion and failure are evaluated from docking, travel, combat, trade, and
  explicit player choices.
- Completed missions pay a credit reward and move into mission history.

## Decoy Cargo

**Theme**

You are asked to move sealed medical crates, but the shipment is really bait
intended to draw pirate attention onto your route.

**Current gameplay rules**

- Reward: `140.0 Cr`
- Cargo: `4` units of `Medical Crates`
- Cargo space: `4 t`
- Cargo sale rule: not sellable through the normal market
- Cargo dump rule: can be dumped
- Route effect: pirate spawn pressure is multiplied heavily during the trip
- Reveal: after a jump, the mission can post a reveal message explaining that
  the cargo is a decoy
- Completion: dock at the delivery destination with the mission still active

**Intended feel**

This mission uses a normal cargo run as the base action, then makes the route
itself dangerous.

## Secret Courier

**Theme**

You carry a compact packet of sealed dispatches that attracts hostile
inspection and may force a reroute.

**Current gameplay rules**

- Reward: `220.0 Cr`
- Cargo: `1` unit of `Sealed Dispatches`
- Cargo space: `0 t`
- Legal pressure: carrying the packet increases legal risk
- Cargo sale rule: not sellable through the normal market
- Cargo dump rule: cannot be dumped
- Route effect: police can behave as hostile rather than protective
- Reroute: after the trip starts, the mission can change the active destination
  to an alternate system
- Inbox effect: the mission posts a warning when the route changes
- Completion: dock at the updated delivery destination

**Intended feel**

This mission is about paranoia and route instability rather than cargo volume.

## Station Blockade

**Theme**

A station needs relief supplies while hostile ships are massed around the
approach corridor.

**Current gameplay rules**

- Reward: `260.0 Cr`
- Cargo: no mission-owned cargo is created automatically
- Trade hook: the mission watches for delivery of a required commodity at the
  destination station
- Destination effect: the arrival zone can spawn a hostile blockade wave
- Delivery target: currently keyed to a commodity handoff rather than special
  cargo
- Completion: successful delivery at the destination system

**Intended feel**

This mission turns the docking leg into the dangerous part of the job.

## Named Pirate Hunt

**Theme**

A specific pirate is thought to be moving through nearby systems. You are given
clues and must search before engaging the target.

**Current gameplay rules**

- Reward: `300.0 Cr`
- Cargo: none
- Search phase: the mission tracks a small set of candidate systems
- Travel effect: visiting the right systems advances the mission from search to
  intercept
- Combat effect: the route can inject a guaranteed mission target spawn
- Mission target: currently configured as a pirate-class target ship
- Completion: destroy the tagged mission target

**Intended feel**

This mission uses geography and system-to-system search instead of a generic
“kill pirates” counter.

## Double Delivery

**Theme**

You start with a bonded shipment for one employer, then receive a competing
offer mid-route.

**Current gameplay rules**

- Reward: `180.0 Cr`
- Cargo: `3` units of `Bonded Goods`
- Cargo space: `3 t`
- Legal pressure: mild legal risk while carried
- Cargo sale rule: not sellable through the normal market
- Cargo dump rule: can be dumped
- Alternate destination: the mission defines a second buyer/system
- Choice phase: after the trip starts, the mission can post a branch choice
- Branch options:
  - `Stay Loyal`: keep the original destination
  - `Betray`: divert to the alternate destination
- Completion: dock with the cargo at the chosen destination

**Intended feel**

This mission exists to create a simple but meaningful loyalty vs payout branch
without adding bespoke mechanics.

## Rescue Pickup

**Theme**

You travel out to a dangerous system to collect survivors, then have to get
them back alive.

**Current gameplay rules**

- Reward: `280.0 Cr`
- Outbound leg: no starting mission cargo
- Pickup trigger: docking at the target system converts the mission into a
  return leg
- Return cargo: `2` units of `Survivors`
- Cargo space: `2 t`
- Cargo sale rule: not sellable
- Cargo dump rule: cannot be dumped
- Return effect: pirate pressure increases after the pickup
- Failure hook: the mission can fail if the protected payload is lost
- Completion: return the survivors to the origin system

**Intended feel**

This mission makes the midpoint, not the destination, the structural twist.

## Notes On Current Scope

- The current implementation focuses on mission-local consequences only.
- There is no persistent faction reputation layer yet.
- There is no broad simulated system-state layer yet.
- Mission cargo is separate from normal trade cargo so special payloads do not
  leak into the station market.
- The mission inbox is derived from mission state, so briefings and choices are
  generated from the active mission stages.
