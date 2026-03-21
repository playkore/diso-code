extends Node

const CommanderDomain = preload("res://scripts/domain/commander.gd")
const FuelDomain = preload("res://scripts/domain/fuel.gd")
const GalaxyCatalog = preload("res://scripts/domain/galaxy_catalog.gd")
const GameStateFactory = preload("res://scripts/domain/game_state_factory.gd")
const MarketDomain = preload("res://scripts/domain/market.gd")
const MissionsDomain = preload("res://scripts/domain/missions.gd")
const OutfittingDomain = preload("res://scripts/domain/outfitting.gd")
const ShipCatalog = preload("res://scripts/domain/ship_catalog.gd")

## Action facade for the Godot rewrite.
##
## Scenes should call these methods instead of mutating `GameState` directly.
## That keeps transition rules centralized and makes future parity tests much
## easier, because state-changing behavior has a single entry point.

func _ready() -> void:
	var initial_state := GameStateFactory.create_boot_state()
	GameState.set_full_state(initial_state)

func set_active_tab(tab: String) -> void:
	var next_ui: Dictionary = GameState.ui.duplicate(true)
	next_ui["active_tab"] = tab
	GameState.mutate_section(&"ui", next_ui)

func set_instant_travel_enabled(enabled: bool) -> void:
	var next_ui: Dictionary = GameState.ui.duplicate(true)
	next_ui["instant_travel_enabled"] = enabled
	GameState.mutate_section(&"ui", next_ui)
	GameState.push_message("info", "Travel Mode", "Instant travel %s." % ("enabled" if enabled else "disabled"))

func grant_debug_credits(amount: int) -> void:
	var next_commander: Dictionary = GameState.commander.duplicate(true)
	next_commander["cash"] = int(next_commander.get("cash", 0)) + amount
	GameState.mutate_section(&"commander", next_commander)
	GameState.push_message("info", "Credits Added", "%d credits added for testing." % amount)

func begin_travel(system_name: String) -> bool:
	if system_name == str(GameState.universe.get("current_system", "")):
		GameState.push_message("error", "Route Invalid", "You are already docked at %s." % system_name)
		return false
	var current_system: String = str(GameState.universe.get("current_system", ""))
	var distance: float = GalaxyCatalog.get_system_distance(current_system, system_name)
	if not is_finite(distance):
		GameState.push_message("error", "Route Invalid", "No chart route is available to %s." % system_name)
		return false
	var jump_units: int = FuelDomain.get_jump_fuel_units(distance)
	var jump_cost: float = FuelDomain.get_jump_fuel_cost(distance)
	if jump_units > FuelDomain.get_fuel_units(float(GameState.commander.get("fuel", 0.0))):
		GameState.push_message("error", "Route Out of Range", "Jump needs %.1f LY but only %.1f LY remain." % [jump_cost, float(GameState.commander.get("fuel", 0.0))])
		return false
	if bool(GameState.ui.get("instant_travel_enabled", false)):
		return complete_travel({
			"outcome": "arrived",
			"dock_system_name": system_name,
			"spend_jump_fuel": true
		})
	GameState.mutate_section(&"travel_session", {
		"origin_system": current_system,
		"destination_system": system_name,
		"fuel_cost": jump_cost,
		"fuel_units": jump_units
	})
	GameState.push_message("info", "Travel Started", "Course laid in for %s. Jump cost %.1f LY." % [system_name, jump_cost])
	set_active_tab(GameState.TAB_TRAVEL)
	return true

func cancel_travel() -> void:
	GameState.mutate_section(&"travel_session", {})
	set_active_tab(GameState.TAB_STAR_MAP)

func complete_travel(report: Dictionary = {}) -> bool:
	var destination := str(report.get("dock_system_name", GameState.travel_session.get("destination_system", "")))
	if destination == "":
		GameState.push_message("error", "Travel Failed", "No destination was attached to the current travel session.")
		return false
	var docked_state := GameStateFactory.create_arrival_state({
		"universe": GameState.universe,
		"commander": GameState.commander,
		"ui": GameState.ui
	}, destination) if bool(report.get("spend_jump_fuel", true)) else GameStateFactory.create_docked_state({
		"universe": GameState.universe,
		"commander": GameState.commander,
		"ui": GameState.ui
	}, destination, {
		"spend_jump_fuel": false,
		"title": "Docked at %s" % destination,
		"body": "Returned to station without spending hyperspace fuel."
	})
	if docked_state.is_empty():
		GameState.push_message("error", "Travel Failed", "The docking transition could not be completed.")
		return false
	GameState.mutate_section(&"universe", docked_state["universe"])
	GameState.mutate_section(&"commander", docked_state["commander"])
	GameState.mutate_section(&"market", docked_state["market"])
	GameState.mutate_section(&"missions", docked_state["missions"])
	GameState.mutate_section(&"ui", docked_state["ui"])
	GameState.mutate_section(&"travel_session", {})
	set_active_tab(GameState.TAB_MARKET)
	return true

func dock_at_system(system_name: String) -> void:
	var docked_state := GameStateFactory.create_docked_state({
		"universe": GameState.universe,
		"commander": GameState.commander,
		"ui": GameState.ui
	}, system_name, {
		"spend_jump_fuel": false,
		"title": "Docked at %s" % system_name,
		"body": "Station services refreshed."
	})
	if docked_state.is_empty():
		return
	GameState.mutate_section(&"universe", docked_state["universe"])
	GameState.mutate_section(&"commander", docked_state["commander"])
	GameState.mutate_section(&"market", docked_state["market"])
	GameState.mutate_section(&"missions", docked_state["missions"])
	GameState.mutate_section(&"ui", docked_state["ui"])

func buy_fuel(units: int) -> void:
	var amount: int = max(units, 0)
	if amount <= 0:
		return
	var commander: Dictionary = GameState.commander.duplicate(true)
	var current_units: int = FuelDomain.get_fuel_units(float(commander.get("fuel", 0.0)))
	var max_units: int = FuelDomain.get_fuel_units(float(commander.get("max_fuel", FuelDomain.MAX_FUEL)))
	var purchasable_units: int = min(amount, max_units - current_units)
	var cost: int = FuelDomain.get_refuel_cost(purchasable_units)
	if purchasable_units <= 0:
		GameState.push_message("error", "Fuel Tank Full", "The tank already holds %.1f LY." % float(commander.get("fuel", 0.0)))
		return
	if cost > int(commander.get("cash", 0)):
		GameState.push_message("error", "Not Enough Credits", "Fuel costs %d credits but only %d remain." % [cost, int(commander.get("cash", 0))])
		return
	commander["cash"] = int(commander.get("cash", 0)) - cost
	commander["fuel"] = FuelDomain.fuel_units_to_light_years(current_units + purchasable_units)
	GameState.mutate_section(&"commander", commander)
	GameState.push_message("success", "Fuel Purchased", "Added %.1f LY. Fuel now %.1f LY. Balance %d credits." % [float(purchasable_units) / 10.0, float(commander.get("fuel", 0.0)), int(commander.get("cash", 0))])

func buy_commodity(commodity_key: String, amount: int) -> void:
	var commander: Dictionary = GameState.commander.duplicate(true)
	var market: Dictionary = GameState.market.duplicate(true)
	var session: Dictionary = market.get("session", {})
	var items: Array = market.get("items", [])
	var commodity: Dictionary = _find_market_item(items, commodity_key)
	if commodity.is_empty():
		return
	var requested_amount: int = max(amount, 0)
	if requested_amount <= 0:
		return
	var owned: int = int(commander.get("cargo", {}).get(commodity_key, 0))
	var free_cargo: int = OutfittingDomain.get_free_cargo_space(commander)
	var max_cargo_amount: int = free_cargo if str(commodity.get("unit", "t")) == "t" else requested_amount
	var max_affordable: int = int(int(commander.get("cash", 0)) / int(commodity.get("price", 1)))
	var buy_amount: int = min(requested_amount, int(commodity.get("quantity", 0)), max_affordable, max_cargo_amount)
	if buy_amount <= 0:
		GameState.push_message("error", "Cannot Buy %s" % str(commodity.get("name", commodity_key)), "The station has no stock, space, or affordable units for this purchase.")
		return
	var cargo: Dictionary = commander.get("cargo", {}).duplicate(true)
	cargo[commodity_key] = owned + buy_amount
	commander["cargo"] = cargo
	commander["cash"] = int(commander.get("cash", 0)) - buy_amount * int(commodity.get("price", 0))
	commander["legal_value"] = CommanderDomain.apply_legal_floor(int(commander.get("legal_value", 0)), cargo)
	session = MarketDomain.apply_local_market_trade(session, commodity_key, -buy_amount)
	market = GameStateFactory.refresh_items(session)
	GameState.mutate_section(&"commander", commander)
	GameState.mutate_section(&"market", market)
	GameState.push_message("success", "Cargo Purchased", "Bought %d %s of %s. Balance now %d credits." % [buy_amount, commodity.get("unit", "t"), commodity.get("name", commodity_key), int(commander.get("cash", 0))])

func sell_commodity(commodity_key: String, amount: int) -> void:
	var commander: Dictionary = GameState.commander.duplicate(true)
	var market: Dictionary = GameState.market.duplicate(true)
	var session: Dictionary = market.get("session", {})
	var items: Array = market.get("items", [])
	var commodity: Dictionary = _find_market_item(items, commodity_key)
	if commodity.is_empty():
		return
	var cargo: Dictionary = commander.get("cargo", {}).duplicate(true)
	var owned: int = int(cargo.get(commodity_key, 0))
	var sell_amount: int = min(max(amount, 0), owned)
	if sell_amount <= 0:
		GameState.push_message("error", "Cannot Sell %s" % str(commodity.get("name", commodity_key)), "You do not have any units of this commodity.")
		return
	if sell_amount == owned:
		cargo.erase(commodity_key)
	else:
		cargo[commodity_key] = owned - sell_amount
	commander["cargo"] = cargo
	commander["cash"] = int(commander.get("cash", 0)) + sell_amount * int(commodity.get("price", 0))
	commander["legal_value"] = CommanderDomain.apply_legal_floor(int(commander.get("legal_value", 0)), cargo)
	session = MarketDomain.apply_local_market_trade(session, commodity_key, sell_amount)
	market = GameStateFactory.refresh_items(session)
	GameState.mutate_section(&"commander", commander)
	GameState.mutate_section(&"market", market)
	GameState.push_message("success", "Cargo Sold", "Sold %d %s of %s. Balance now %d credits." % [sell_amount, commodity.get("unit", "t"), commodity.get("name", commodity_key), int(commander.get("cash", 0))])

func buy_equipment(equipment_id: String) -> void:
	var tech_level: int = GameStateFactory.get_current_tech_level(str(GameState.universe.get("current_system", "")))
	var commander: Dictionary = GameState.commander.duplicate(true)
	var result: Dictionary = OutfittingDomain.can_buy_equipment(commander, tech_level, equipment_id)
	var equipment: Dictionary = ShipCatalog.EQUIPMENT_CATALOG.get(equipment_id, {})
	if not bool(result.get("ok", false)):
		GameState.push_message("error", "Cannot Buy %s" % str(equipment.get("name", equipment_id)), str(result.get("reason", "The outfitting terminal rejected the order.")))
		return
	var installed: Dictionary = commander.get("installed_equipment", {}).duplicate(true)
	installed[equipment_id] = true
	commander = CommanderDomain.normalize_commander_state({
		"name": commander.get("name", "Cmdr. Nova"),
		"cash": int(commander.get("cash", 0)) - int(equipment.get("price", 0)),
		"fuel": commander.get("fuel", 7.0),
		"max_fuel": commander.get("max_fuel", 7.0),
		"legal_value": commander.get("legal_value", 0),
		"ship_type": commander.get("ship_type", "cobra_mk_iii"),
		"base_cargo_capacity": commander.get("base_cargo_capacity", 20),
		"cargo_capacity": int(equipment.get("expands_cargo_bay_to", commander.get("cargo_capacity", 20))),
		"max_cargo_capacity": commander.get("max_cargo_capacity", 35),
		"cargo": commander.get("cargo", {}),
		"energy_banks": commander.get("energy_banks", 4),
		"energy_per_bank": commander.get("energy_per_bank", 64),
		"missile_capacity": commander.get("missile_capacity", 4),
		"missiles_installed": commander.get("missiles_installed", 0),
		"laser_mounts": commander.get("laser_mounts", {}),
		"installed_equipment": installed,
		"tally": commander.get("tally", 0),
		"rating": commander.get("rating", "Harmless"),
		"current_system": commander.get("current_system", "Lave"),
		"mission_tp": commander.get("mission_tp", 0),
		"mission_variant": commander.get("mission_variant", "classic")
	})
	GameState.mutate_section(&"commander", commander)
	GameState.push_message("success", "Equipment Installed", "%s installed. Balance now %d credits." % [equipment.get("name", equipment_id), int(commander.get("cash", 0))])

func buy_laser(mount: String, laser_id: String) -> void:
	var tech_level: int = GameStateFactory.get_current_tech_level(str(GameState.universe.get("current_system", "")))
	var commander: Dictionary = GameState.commander.duplicate(true)
	var result: Dictionary = OutfittingDomain.can_install_laser(commander, tech_level, mount, laser_id)
	var laser: Dictionary = ShipCatalog.LASER_CATALOG.get(laser_id, {})
	if not bool(result.get("ok", false)):
		GameState.push_message("error", "Cannot Install %s" % str(laser.get("name", laser_id)), str(result.get("reason", "The mount rejected the fit.")))
		return
	var lasers: Dictionary = commander.get("laser_mounts", {}).duplicate(true)
	var previous_laser_id: Variant = lasers.get(mount, null)
	lasers[mount] = laser_id
	commander = CommanderDomain.normalize_commander_state({
		"name": commander.get("name", "Cmdr. Nova"),
		"cash": int(commander.get("cash", 0)) - int(laser.get("price", 0)),
		"fuel": commander.get("fuel", 7.0),
		"max_fuel": commander.get("max_fuel", 7.0),
		"legal_value": commander.get("legal_value", 0),
		"ship_type": commander.get("ship_type", "cobra_mk_iii"),
		"base_cargo_capacity": commander.get("base_cargo_capacity", 20),
		"cargo_capacity": commander.get("cargo_capacity", 20),
		"max_cargo_capacity": commander.get("max_cargo_capacity", 35),
		"cargo": commander.get("cargo", {}),
		"energy_banks": commander.get("energy_banks", 4),
		"energy_per_bank": commander.get("energy_per_bank", 64),
		"missile_capacity": commander.get("missile_capacity", 4),
		"missiles_installed": commander.get("missiles_installed", 0),
		"laser_mounts": lasers,
		"installed_equipment": commander.get("installed_equipment", {}),
		"tally": commander.get("tally", 0),
		"rating": commander.get("rating", "Harmless"),
		"current_system": commander.get("current_system", "Lave"),
		"mission_tp": commander.get("mission_tp", 0),
		"mission_variant": commander.get("mission_variant", "classic")
	})
	GameState.mutate_section(&"commander", commander)
	var replacement_text: String = ""
	if previous_laser_id != null:
		replacement_text = " Replaced %s." % str(ShipCatalog.LASER_CATALOG.get(previous_laser_id, {}).get("name", previous_laser_id))
	GameState.push_message("success", "Laser Installed", "%s mounted on %s arc.%s Balance %d credits." % [laser.get("name", laser_id), mount, replacement_text, int(commander.get("cash", 0))])

func buy_missile() -> void:
	var tech_level: int = GameStateFactory.get_current_tech_level(str(GameState.universe.get("current_system", "")))
	var commander: Dictionary = GameState.commander.duplicate(true)
	var result: Dictionary = OutfittingDomain.can_buy_missile(commander, tech_level)
	if not bool(result.get("ok", false)):
		GameState.push_message("error", "Cannot Buy Missile", str(result.get("reason", "The rack cannot accept another missile.")))
		return
	commander = CommanderDomain.normalize_commander_state({
		"name": commander.get("name", "Cmdr. Nova"),
		"cash": int(commander.get("cash", 0)) - int(ShipCatalog.MISSILE_CATALOG.get("price", 0)),
		"fuel": commander.get("fuel", 7.0),
		"max_fuel": commander.get("max_fuel", 7.0),
		"legal_value": commander.get("legal_value", 0),
		"ship_type": commander.get("ship_type", "cobra_mk_iii"),
		"base_cargo_capacity": commander.get("base_cargo_capacity", 20),
		"cargo_capacity": commander.get("cargo_capacity", 20),
		"max_cargo_capacity": commander.get("max_cargo_capacity", 35),
		"cargo": commander.get("cargo", {}),
		"energy_banks": commander.get("energy_banks", 4),
		"energy_per_bank": commander.get("energy_per_bank", 64),
		"missile_capacity": commander.get("missile_capacity", 4),
		"missiles_installed": int(commander.get("missiles_installed", 0)) + int(ShipCatalog.MISSILE_CATALOG.get("capacity_use", 1)),
		"laser_mounts": commander.get("laser_mounts", {}),
		"installed_equipment": commander.get("installed_equipment", {}),
		"tally": commander.get("tally", 0),
		"rating": commander.get("rating", "Harmless"),
		"current_system": commander.get("current_system", "Lave"),
		"mission_tp": commander.get("mission_tp", 0),
		"mission_variant": commander.get("mission_variant", "classic")
	})
	GameState.mutate_section(&"commander", commander)
	GameState.push_message("success", "Missile Purchased", "Rack now %d/%d. Balance %d credits." % [int(commander.get("missiles_installed", 0)), int(commander.get("missile_capacity", 0)), int(commander.get("cash", 0))])

func trigger_mission_external_event(event_type: String) -> void:
	var commander: Dictionary = GameState.commander.duplicate(true)
	var progress: Dictionary = {
		"tp": int(commander.get("mission_tp", 0)),
		"variant": str(commander.get("mission_variant", "classic"))
	}
	var next_progress: Dictionary = MissionsDomain.apply_mission_external_event(progress, {"type": event_type})
	commander["mission_tp"] = int(next_progress.get("tp", commander.get("mission_tp", 0)))
	GameState.mutate_section(&"commander", commander)
	GameState.mutate_section(&"missions", GameStateFactory.update_mission_log(commander))
	GameState.push_message("info", "Mission Updated", "Mission event applied: %s" % event_type)

func save_to_slot(slot_id: int) -> void:
	var snapshot: Dictionary = GameStateFactory.create_snapshot({
		"commander": GameState.commander,
		"universe": GameState.universe,
		"market": GameState.market
	})
	var payload: Dictionary = PersistenceService.save_slot(slot_id, snapshot)
	if payload.is_empty():
		return
	var next_saves: Dictionary = GameState.save_states.duplicate(true)
	next_saves[slot_id] = payload
	GameState.mutate_section(&"save_states", next_saves)
	GameState.push_message("info", "Save Complete", "Saved commander to slot %d." % slot_id)

func load_from_slot(slot_id: int) -> void:
	var payload: Dictionary = GameState.save_states.get(slot_id, {})
	if payload.is_empty():
		payload = PersistenceService.load_slot(slot_id)
	if payload.is_empty():
		return
	var restored: Dictionary = GameStateFactory.restore_snapshot(payload.get("snapshot", {}))
	GameState.mutate_section(&"commander", restored.get("commander", {}))
	GameState.mutate_section(&"universe", restored.get("universe", {}))
	GameState.mutate_section(&"market", restored.get("market", {}))
	GameState.mutate_section(&"missions", restored.get("missions", {}))
	GameState.mutate_section(&"travel_session", {})
	var next_saves: Dictionary = GameState.save_states.duplicate(true)
	next_saves[slot_id] = payload
	GameState.mutate_section(&"save_states", next_saves)
	set_active_tab(GameState.TAB_MARKET)
	GameState.push_message("info", "Save Loaded", "Restored slot %d." % slot_id)

func start_new_game() -> void:
	GameState.set_full_state(GameStateFactory.create_boot_state())
	GameState.push_message("info", "New Game Started", "Fresh commander created in Lave.")

func _find_market_item(items: Array, commodity_key: String) -> Dictionary:
	for item in items:
		if typeof(item) == TYPE_DICTIONARY and str(item.get("key", "")) == commodity_key:
			return item
	return {}
