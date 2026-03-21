extends RefCounted

# Docked-state assembly helpers for the Godot port.
#
# This module sits one layer above the raw domain rules. It combines commander,
# universe, market, and mission data into the composite snapshots that the
# future autoload layer and scene tree will consume.
class_name DomainGameStateFactory

const DomainCommander = preload("res://scripts/domain/commander.gd")
const DomainFuel = preload("res://scripts/domain/fuel.gd")
const DomainGalaxyCatalog = preload("res://scripts/domain/galaxy_catalog.gd")
const DomainMarket = preload("res://scripts/domain/market.gd")
const DomainMissions = preload("res://scripts/domain/missions.gd")


static func create_market_state(system_name: String, economy: int, fluctuation: int) -> Dictionary:
	var session := DomainMarket.create_docked_market_session(system_name, economy, fluctuation)
	return {
		"session": session,
		"items": DomainMarket.get_session_market_items(session)
	}


static func refresh_items(session: Dictionary) -> Dictionary:
	return {
		"session": session,
		"items": DomainMarket.get_session_market_items(session)
	}


static func update_mission_log(commander: Dictionary) -> Dictionary:
	var progress := DomainMissions.apply_docking_mission_state({
		"tp": int(commander.get("mission_tp", 0)),
		"variant": String(commander.get("mission_variant", "classic"))
	})
	return {
		"mission_log": DomainMissions.get_mission_messages_for_docking(progress)
	}


static func create_initial_game_state(commander: Dictionary) -> Dictionary:
	var normalized := DomainCommander.normalize_commander_state(commander)
	var system := DomainGalaxyCatalog.get_system_by_name(String(normalized.get("current_system", "Lave")))
	var system_data: Dictionary = system.get("data", {})
	var economy := int(system_data.get("economy", 5))
	var current_system := String(normalized.get("current_system", "Lave"))

	return {
		"universe": {
			"current_system": current_system,
			"nearby_systems": DomainGalaxyCatalog.get_nearby_system_names(current_system),
			"stardate": 3124,
			"economy": economy,
			"market_fluctuation": 0
		},
		"commander": normalized,
		"market": create_market_state(current_system, economy, 0),
		"missions": update_mission_log(normalized)
	}


static func create_boot_state() -> Dictionary:
	var initial := create_initial_game_state(DomainCommander.create_default_commander())
	return {
		"universe": initial["universe"],
		"commander": initial["commander"],
		"market": initial["market"],
		"missions": initial["missions"],
		"travel_session": {},
		"save_states": PersistenceService.load_all_slots(),
		"ui": {
			"active_tab": "market",
			"compact_mode": true,
			"instant_travel_enabled": false,
			"activity_log": []
		}
	}


static func create_snapshot(state: Dictionary) -> Dictionary:
	return {
		"commander": state.get("commander", {}),
		"universe": state.get("universe", {}),
		"market_session": state.get("market", {}).get("session", {})
	}


static func get_current_tech_level(system_name: String) -> int:
	var system := DomainGalaxyCatalog.get_system_by_name(system_name)
	return int(system.get("data", {}).get("tech_level", 0))


static func get_cheapest_commodity(session: Dictionary) -> Dictionary:
	var items: Array = DomainMarket.get_session_market_items(session)
	if items.is_empty():
		return {}

	var cheapest: Dictionary = items[0]
	for item_variant in items:
		var item: Dictionary = item_variant
		if int(item.get("price", 0)) < int(cheapest.get("price", 0)):
			cheapest = item
	return cheapest


static func create_docked_state(state: Dictionary, system_name: String, options: Dictionary) -> Dictionary:
	var source_commander: Dictionary = state.get("commander", {})
	var next_commander: Dictionary = DomainCommander.normalize_commander_state({
		"name": source_commander.get("name", "Cmdr. Nova"),
		"cash": source_commander.get("cash", 1000),
		"fuel": source_commander.get("fuel", 7.0),
		"max_fuel": source_commander.get("max_fuel", 7.0),
		"legal_value": source_commander.get("legal_value", 0),
		"ship_type": source_commander.get("ship_type", "cobra_mk_iii"),
		"base_cargo_capacity": source_commander.get("base_cargo_capacity", 20),
		"cargo_capacity": source_commander.get("cargo_capacity", 20),
		"max_cargo_capacity": source_commander.get("max_cargo_capacity", 35),
		"cargo": source_commander.get("cargo", {}),
		"energy_banks": source_commander.get("energy_banks", 4),
		"energy_per_bank": source_commander.get("energy_per_bank", 64),
		"missile_capacity": source_commander.get("missile_capacity", 4),
		"missiles_installed": source_commander.get("missiles_installed", 0),
		"laser_mounts": source_commander.get("laser_mounts", {}),
		"installed_equipment": source_commander.get("installed_equipment", {}),
		"tally": source_commander.get("tally", 0),
		"rating": source_commander.get("rating", "Harmless"),
		"current_system": system_name,
		"mission_tp": source_commander.get("mission_tp", 0),
		"mission_variant": source_commander.get("mission_variant", "classic")
	})

	var origin_system_name := String(state.get("universe", {}).get("current_system", system_name))
	if bool(options.get("spend_jump_fuel", false)):
		var distance := DomainGalaxyCatalog.get_system_distance(origin_system_name, system_name)
		if not is_finite(distance):
			return {}
		var jump_fuel_units := DomainFuel.get_jump_fuel_units(distance)
		var available_fuel_units := DomainFuel.get_fuel_units(float(next_commander.get("fuel", 0.0)))
		if jump_fuel_units <= 0 or jump_fuel_units > available_fuel_units:
			return {}
		next_commander["fuel"] = DomainFuel.fuel_units_to_light_years(available_fuel_units - jump_fuel_units)

	next_commander["legal_value"] = DomainCommander.apply_legal_floor(int(next_commander.get("legal_value", 0)), next_commander.get("cargo", {}))
	var progress := DomainMissions.apply_docking_mission_state({
		"tp": int(next_commander.get("mission_tp", 0)),
		"variant": String(next_commander.get("mission_variant", "classic"))
	})
	next_commander["mission_tp"] = int(progress.get("tp", 0))

	var system := DomainGalaxyCatalog.get_system_by_name(system_name)
	var system_data: Dictionary = system.get("data", {})
	var economy := int(system_data.get("economy", int(state.get("universe", {}).get("economy", 5))))
	var stardate := int(state.get("universe", {}).get("stardate", 3124))
	var fluctuation := (stardate + system_name.length()) & 0xFF
	var title := String(options.get("title", "Docked at %s" % system_name))
	var body := String(options.get("body", ""))

	return {
		"universe": {
			"current_system": system_name,
			"nearby_systems": DomainGalaxyCatalog.get_nearby_system_names(system_name),
			"stardate": stardate + int(options.get("stardate_delta", 1)),
			"economy": economy,
			"market_fluctuation": fluctuation
		},
		"commander": next_commander,
		"market": create_market_state(system_name, economy, fluctuation),
		"missions": {
			"mission_log": DomainMissions.get_mission_messages_for_docking(progress)
		},
		"ui": _with_ui_message(state.get("ui", {}), title, body)
	}


static func create_arrival_state(state: Dictionary, system_name: String) -> Dictionary:
	var next_state := create_docked_state(state, system_name, {
		"spend_jump_fuel": true,
		"title": "Docked at %s" % system_name,
		"body": "",
		"stardate_delta": 1
	})
	if next_state.is_empty():
		return {}

	var cheapest := get_cheapest_commodity(next_state.get("market", {}).get("session", {}))
	var distance := DomainGalaxyCatalog.get_system_distance(String(state.get("universe", {}).get("current_system", "")), system_name)
	next_state["ui"] = _with_ui_message(state.get("ui", {}), "Docked at %s" % system_name, "Jumped %.1f LY. Cheapest local price: %s at %d credits." % [
		DomainFuel.get_jump_fuel_cost(distance),
		String(cheapest.get("name", "Unknown")),
		int(cheapest.get("price", 0))
	])
	return next_state


static func restore_snapshot(snapshot: Dictionary) -> Dictionary:
	var commander := DomainCommander.normalize_commander_state(snapshot.get("commander", {}))
	var current_system := String(commander.get("current_system", "Lave"))
	return {
		"commander": commander,
		"universe": {
			"current_system": current_system,
			"nearby_systems": DomainGalaxyCatalog.get_nearby_system_names(current_system),
			"stardate": int(snapshot.get("universe", {}).get("stardate", 3124)),
			"economy": int(snapshot.get("universe", {}).get("economy", 5)),
			"market_fluctuation": int(snapshot.get("universe", {}).get("market_fluctuation", 0))
		},
		"market": refresh_items(snapshot.get("market_session", {})),
		"missions": update_mission_log(commander)
	}


static func _with_ui_message(ui: Dictionary, title: String, body: String) -> Dictionary:
	var next_ui := ui.duplicate(true)
	var entry := {
		"id": "%s-%s" % [title, str(Time.get_ticks_msec())],
		"tone": "info",
		"title": title,
		"body": body
	}
	var activity_log: Array = next_ui.get("activity_log", [])
	activity_log.push_front(entry)
	next_ui["latest_event"] = entry
	next_ui["activity_log"] = activity_log
	return next_ui
