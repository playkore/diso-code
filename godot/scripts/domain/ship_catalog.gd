extends RefCounted

## Static catalogs for ships, lasers, equipment, and missiles.

const PLAYER_SHIP := {
	"id": "cobra_mk_iii",
	"name": "Cobra Mk III",
	"manufacturer": "Cowell & MgRath",
	"base_price": 100000,
	"base_cargo_capacity": 20,
	"max_cargo_capacity": 35,
	"energy_banks": 4,
	"energy_per_bank": 64,
	"missile_capacity": 4,
	"max_fuel": 7.0,
	"default_lasers": {
		"front": "pulse_laser",
		"rear": null,
		"left": null,
		"right": null
	}
}

const LASER_CATALOG := {
	"pulse_laser": {
		"id": "pulse_laser",
		"name": "Pulse Laser",
		"price": 4000,
		"required_tech_level": 3,
		"damage_tier": "low",
		"mount_positions": ["front", "rear", "left", "right"]
	},
	"beam_laser": {
		"id": "beam_laser",
		"name": "Beam Laser",
		"price": 10000,
		"required_tech_level": 4,
		"damage_tier": "medium",
		"mount_positions": ["front", "rear", "left", "right"]
	},
	"mining_laser": {
		"id": "mining_laser",
		"name": "Mining Laser",
		"price": 8000,
		"required_tech_level": 4,
		"damage_tier": "special",
		"mount_positions": ["front", "rear", "left", "right"]
	},
	"military_laser": {
		"id": "military_laser",
		"name": "Military Laser",
		"price": 60000,
		"required_tech_level": 10,
		"damage_tier": "high",
		"mount_positions": ["front", "rear", "left", "right"]
	}
}

const EQUIPMENT_CATALOG := {
	"fuel_scoops": {"id": "fuel_scoops", "name": "Fuel Scoops", "price": 5250, "required_tech_level": 5, "description": "Allows future fuel scooping.", "unique": true},
	"ecm": {"id": "ecm", "name": "E.C.M. System", "price": 6000, "required_tech_level": 2, "description": "Missile countermeasure system.", "unique": true},
	"docking_computer": {"id": "docking_computer", "name": "Docking Computer", "price": 15000, "required_tech_level": 9, "description": "Automates docking in future travel scenes.", "unique": true},
	"extra_energy_unit": {"id": "extra_energy_unit", "name": "Extra Energy Unit", "price": 15000, "required_tech_level": 9, "description": "Improves recharge behavior in combat.", "unique": true},
	"large_cargo_bay": {"id": "large_cargo_bay", "name": "Large Cargo Bay", "price": 4000, "required_tech_level": 3, "description": "Extends cargo from 20t to 35t.", "expands_cargo_bay_to": 35, "unique": true},
	"escape_pod": {"id": "escape_pod", "name": "Escape Pod", "price": 10000, "required_tech_level": 6, "description": "Commander survival system.", "unique": true},
	"energy_bomb": {"id": "energy_bomb", "name": "Energy Bomb", "price": 9000, "required_tech_level": 7, "description": "Single-use area weapon.", "unique": true}
}

const MISSILE_CATALOG := {
	"name": "Missile",
	"price": 3000,
	"required_tech_level": 1,
	"capacity_use": 1
}

const LASER_ORDER := ["pulse_laser", "beam_laser", "mining_laser", "military_laser"]
const EQUIPMENT_ORDER := ["fuel_scoops", "ecm", "docking_computer", "extra_energy_unit", "large_cargo_bay", "escape_pod", "energy_bomb"]
