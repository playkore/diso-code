extends RefCounted

const ShipCatalog = preload("res://scripts/domain/ship_catalog.gd")

## Canonical commander-state model for the Godot port.
##
## The rewrite keeps commander data in plain dictionaries because they are easy
## to persist, compare against fixture JSON, and evolve without binding UI code
## to scene-local node state.

static func _create_installed_equipment_state() -> Dictionary:
	return {
		"fuel_scoops": false,
		"ecm": false,
		"docking_computer": false,
		"extra_energy_unit": false,
		"large_cargo_bay": false,
		"escape_pod": false,
		"energy_bomb": false
	}

static func _create_default_laser_mounts() -> Dictionary:
	return ShipCatalog.PLAYER_SHIP.get("default_lasers", {}).duplicate(true)

static func create_default_commander() -> Dictionary:
	return {
		"name": "Cmdr. Nova",
		"cash": 1000,
		"fuel": float(ShipCatalog.PLAYER_SHIP.get("max_fuel", 7.0)),
		"max_fuel": float(ShipCatalog.PLAYER_SHIP.get("max_fuel", 7.0)),
		"legal_value": 0,
		"ship_type": ShipCatalog.PLAYER_SHIP.get("id", "cobra_mk_iii"),
		"base_cargo_capacity": int(ShipCatalog.PLAYER_SHIP.get("base_cargo_capacity", 20)),
		"cargo_capacity": int(ShipCatalog.PLAYER_SHIP.get("base_cargo_capacity", 20)),
		"max_cargo_capacity": int(ShipCatalog.PLAYER_SHIP.get("max_cargo_capacity", 35)),
		"cargo": {},
		"energy_banks": int(ShipCatalog.PLAYER_SHIP.get("energy_banks", 4)),
		"energy_per_bank": int(ShipCatalog.PLAYER_SHIP.get("energy_per_bank", 64)),
		"missile_capacity": int(ShipCatalog.PLAYER_SHIP.get("missile_capacity", 4)),
		"missiles_installed": 0,
		"laser_mounts": _create_default_laser_mounts(),
		"installed_equipment": _create_installed_equipment_state(),
		"tally": 0,
		"rating": "Harmless",
		"current_system": "Lave",
		"mission_tp": 0,
		"mission_variant": "classic"
	}

static func cargo_used_tonnes(cargo: Dictionary) -> int:
	var total := 0
	for amount in cargo.values():
		total += maxi(0, int(amount))
	return total

static func clamp_legal_value(value: int) -> int:
	return clampi(value, 0, 255)

static func get_legal_status(legal_value: int) -> String:
	if legal_value >= 50:
		return "fugitive"
	if legal_value >= 1:
		return "offender"
	return "clean"

static func get_cargo_badness(cargo: Dictionary) -> int:
	var slaves := maxi(0, int(cargo.get("slaves", 0)))
	var narcotics := maxi(0, int(cargo.get("narcotics", 0)))
	var firearms := maxi(0, int(cargo.get("firearms", 0)))
	return (slaves + narcotics) * 2 + firearms

static func get_minimum_legal_value(cargo: Dictionary) -> int:
	return clamp_legal_value(get_cargo_badness(cargo))

static func apply_legal_floor(legal_value: int, cargo: Dictionary) -> int:
	return maxi(clamp_legal_value(legal_value), get_minimum_legal_value(cargo))

static func normalize_commander_state(commander: Dictionary) -> Dictionary:
	var defaults := create_default_commander()
	var normalized := defaults.duplicate(true)
	for key in commander.keys():
		normalized[key] = commander[key]
	var installed := _create_installed_equipment_state()
	for key in commander.get("installed_equipment", {}).keys():
		installed[key] = bool(commander.get("installed_equipment", {}).get(key, false))
	normalized["installed_equipment"] = installed
	var lasers := _create_default_laser_mounts()
	for key in commander.get("laser_mounts", {}).keys():
		lasers[key] = commander.get("laser_mounts", {}).get(key, null)
	normalized["laser_mounts"] = lasers
	normalized["legal_value"] = apply_legal_floor(int(normalized.get("legal_value", 0)), normalized.get("cargo", {}))
	if bool(normalized.get("installed_equipment", {}).get("large_cargo_bay", false)):
		normalized["cargo_capacity"] = int(ShipCatalog.EQUIPMENT_CATALOG.get("large_cargo_bay", {}).get("expands_cargo_bay_to", normalized.get("cargo_capacity", 20)))
	return normalized
