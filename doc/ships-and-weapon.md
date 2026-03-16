Below is a **revised technical requirements document** aligned much closer to the **original 1984 Elite mechanics** (BBC Micro / DOS versions). The original game had several important constraints that differ from modern space games:

Key original design rules:

* The **player always flies a Cobra Mk III**. Ships cannot be changed.
* Other ships exist only as **NPC ships**.
* Progression happens through **equipment upgrades**, not ship replacement.
* Equipment availability depends on **system tech level**.
* Most equipment is **unique (only one installed)**.
* Cargo expansion physically modifies the ship’s cargo bay.

The document below is written so a developer could **implement the system directly**.

---

# Technical Requirements Document

## Player Ship, Equipment, Weapons, and Ship Market

### Elite-style Game (faithful to original Elite)

---

# 1. Core Design Principle

The player owns exactly **one ship type:**

**Cobra Mk III**

This ship can be upgraded with equipment and weapons.

Gameplay progression happens through:

1. Buying equipment
2. Improving weapons
3. Expanding cargo capacity
4. Installing special systems

The ship itself **cannot be replaced or upgraded to a different model**.

---

# 2. Player Ship Specification

## Ship: Cobra Mk III

The Cobra Mk III is a **multi-role spacecraft** designed for trading, combat, and exploration.

### Base Ship Parameters

| Parameter            | Value                                    |
| -------------------- | ---------------------------------------- |
| Ship Name            | Cobra Mk III                             |
| Manufacturer         | Cowell & MgRath                          |
| Base Price           | 100,000 CR (starting ship is given free) |
| Cargo Capacity       | 20 tons                                  |
| Maximum Cargo        | 35 tons (after cargo upgrade)            |
| Energy Banks         | 4                                        |
| Energy per Bank      | 64 units                                 |
| Total Energy         | 256 units                                |
| Missile Capacity     | 4                                        |
| Laser Mounts         | 4 (front, rear, left, right)             |
| Hyperspace Fuel Tank | 7 light years                            |
| Max Speed            | 0.35 LM                                  |
| Maneuverability      | Medium                                   |

---

# 3. Ship Hardpoints and Mounts

The Cobra Mk III supports **four laser mounts**.

| Mount Position | Default     |
| -------------- | ----------- |
| Front          | Pulse Laser |
| Rear           | None        |
| Left           | None        |
| Right          | None        |

Only **one laser may be installed per mount**.

---

# 4. Ship Data Structure

Example structure for implementation.

```
PlayerShip
{
    shipType: COBRA_MK_III

    cargoCapacity: 20
    cargoUsed: 0

    energyBanks: 4
    energyPerBank: 64

    missilesInstalled: 0

    lasers:
    {
        front
        rear
        left
        right
    }

    equipment:
    [
        fuelScoops,
        ECM,
        dockingComputer,
        energyUnit,
        cargoExpansion,
        escapePod,
        energyBomb
    ]

    fuel: 7.0
}
```

---

# 5. Equipment Marketplace

Equipment can be purchased only when **docked at a space station**.

Each system has a **technology level (1–12)**.

Equipment appears only if:

```
system.techLevel >= equipment.requiredTechLevel
```

---

# 6. Weapons System

Weapons in Elite are **lasers and missiles**.

---

# 7. Laser Types

Lasers are directional weapons mounted on the ship.

The player must purchase **a separate laser for each mount**.

Example:

Player wants lasers on front and rear:

They must buy **two lasers**.

---

## Pulse Laser

Starter weapon.

| Attribute           | Value    |
| ------------------- | -------- |
| Cost                | 4,000 CR |
| Tech Level Required | 3        |
| Damage              | Low      |
| Energy Consumption  | Low      |
| Fire Rate           | Fast     |

Characteristics:

* Rapid firing
* Low damage
* Good for early game

---

## Beam Laser

| Attribute  | Value      |
| ---------- | ---------- |
| Cost       | 10,000 CR  |
| Tech Level | 4          |
| Damage     | Medium     |
| Energy Use | Medium     |
| Fire Rate  | Continuous |

Characteristics:

* Sustained beam
* Balanced weapon

---

## Military Laser

Best weapon in the game.

| Attribute  | Value      |
| ---------- | ---------- |
| Cost       | 60,000 CR  |
| Tech Level | 10         |
| Damage     | High       |
| Energy Use | High       |
| Fire Rate  | Continuous |

Characteristics:

* Highest DPS
* Expensive
* Used by late-game players

---

## Mining Laser

Used for asteroid mining.

| Attribute  | Value           |
| ---------- | --------------- |
| Cost       | 8,000 CR        |
| Tech Level | 4               |
| Damage     | Special         |
| Purpose    | Break asteroids |

Function:

When used against asteroids:

```
asteroid -> fragments
```

Fragments may produce **cargo canisters**.

---

# 8. Missile System

Missiles are **separate weapons** from lasers.

Missiles are **consumable items**.

---

## Missile Specification

| Attribute     | Value     |
| ------------- | --------- |
| Cost          | 300 CR    |
| Max Installed | 4         |
| Guidance      | Homing    |
| Damage        | Very high |

Missile usage flow:

1. Player selects target
2. Player locks missile
3. Player fires missile
4. Missile tracks target

Target may activate ECM.

---

# 9. Equipment System

Equipment adds abilities to the ship.

Each item can be installed **only once**, unless stated otherwise.

---

# 10. Cargo Bay Expansion

## Cargo Bay Extension

| Attribute          | Value    |
| ------------------ | -------- |
| Cost               | 4,000 CR |
| Tech Level         | 2        |
| Installation Limit | 1        |

Function:

Expands cargo capacity from:

```
20 tons → 35 tons
```

Implementation:

```
if equipmentInstalled(CARGO_EXTENSION):
    cargoCapacity = 35
else
    cargoCapacity = 20
```

Important rule:

Cargo expansion **does not consume equipment slots**.

It modifies the ship’s cargo hold structure.

---

# 11. ECM System

Electronic Countermeasure system.

| Attribute          | Value    |
| ------------------ | -------- |
| Cost               | 6,000 CR |
| Tech Level         | 7        |
| Installation Limit | 1        |

Function:

Destroys incoming missiles.

Usage flow:

```
if playerPressECM:
    destroyAllMissilesInRange()
```

Energy cost:

```
energy -= 25
```

---

# 12. Fuel Scoops

Allows collecting fuel from stars.

| Attribute          | Value    |
| ------------------ | -------- |
| Cost               | 5,250 CR |
| Tech Level         | 5        |
| Installation Limit | 1        |

Function:

When ship is near a star:

```
fuel += scoopRate
```

Limit:

```
fuel <= 7 light years
```

---

# 13. Docking Computer

Autopilot docking system.

| Attribute          | Value    |
| ------------------ | -------- |
| Cost               | 1,500 CR |
| Tech Level         | 9        |
| Installation Limit | 1        |

Function:

Automates docking procedure.

Usage:

Player presses:

```
AUTO DOCK
```

Game performs:

1. Approach station
2. Align with entrance
3. Rotate to match spin
4. Enter docking bay

---

# 14. Energy Unit

Improves energy recharge.

| Attribute          | Value     |
| ------------------ | --------- |
| Cost               | 15,000 CR |
| Tech Level         | 8         |
| Installation Limit | 1         |

Function:

Improves energy recharge speed.

Normal recharge:

```
energyRecharge = 1 unit/sec
```

With Energy Unit:

```
energyRecharge = 2 unit/sec
```

---

# 15. Escape Pod

Emergency escape system.

| Attribute          | Value     |
| ------------------ | --------- |
| Cost               | 10,000 CR |
| Tech Level         | 6         |
| Installation Limit | 1         |

Function:

If ship destroyed:

Player survives.

Result:

```
shipDestroyed
cargoLost
equipmentLost
playerRespawnsAtNearestStation
```

Without escape pod:

```
gameOver
```

---

# 16. Energy Bomb

Area-effect super weapon.

| Attribute          | Value    |
| ------------------ | -------- |
| Cost               | 9,000 CR |
| Tech Level         | 9        |
| Installation Limit | 1        |

Function:

Destroys all ships within scanner range.

Usage:

```
activateEnergyBomb()
destroyAllShipsInRange()
```

Consumed after use.

---

# 17. Hyperspace Fuel

Fuel determines jump distance.

| Attribute  | Value               |
| ---------- | ------------------- |
| Max Fuel   | 7 light years       |
| Fuel Price | 2 CR per light year |

Fuel required:

```
fuelRequired = distance
```

Example:

Jump distance = 5 LY

```
fuelUsed = 5
```

---

# 18. Equipment Installation Rules

Rules:

1. Each equipment item may be installed only once.
2. Equipment persists until ship destruction.
3. Some equipment consumes energy.
4. Equipment cannot be removed after purchase.

Example validation:

```
if equipmentInstalled(item):
    rejectPurchase()
```

---

# 19. Equipment UI Requirements

Equipment screen must show:

* Installed lasers
* Installed equipment
* Missile count
* Cargo capacity
* Fuel level

Example UI layout:

```
SHIP STATUS

Ship: Cobra Mk III

Fuel: 4.5 LY
Cargo: 12 / 35

Lasers
Front: Beam Laser
Rear: None
Left: None
Right: None

Equipment
Fuel Scoops
Cargo Bay Extension
ECM
```

---

# 20. Game Balance Principles

Elite’s balance is based on:

### Early Game

* Pulse Laser
* Small cargo trading
* Avoid pirates

### Mid Game

* Beam Laser
* ECM
* Cargo expansion

### Late Game

* Military Laser
* Multiple lasers
* Bounty hunting

---

# 21. Player Progression Path

Typical player upgrade order:

1. Cargo Bay Extension
2. ECM
3. Beam Laser
4. Fuel Scoops
5. Energy Unit
6. Military Laser
7. Docking Computer

---

If you want, I can also write the **next document needed to properly clone Elite**, which is much harder:

**NPC ship specification**

Including:

* complete list of ships (Sidewinder, Python, Mamba, Anaconda, etc.)
* their stats
* pirate spawn logic
* police spawn logic
* trader spawn logic
* bounty reward rules

That system is actually **the core of Elite gameplay**.
