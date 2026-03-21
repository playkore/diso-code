extends UIScreenBase

const CommanderDomain = preload("res://scripts/domain/commander.gd")
const FuelDomain = preload("res://scripts/domain/fuel.gd")
const OutfittingDomain = preload("res://scripts/domain/outfitting.gd")

func _init() -> void:
	screen_title = "Inventory"
	screen_subtitle = "Commander status, cargo, fuel, and installed systems."
	empty_message = "Commander inventory will appear once GameState exposes a docked snapshot."

func _populate_body() -> void:
	var snapshot: Dictionary = get_state_snapshot()
	var commander: Variant = snapshot.get("commander", null)

	add_section_title("Commander Summary")
	add_detail_row("Name", str(StateBridge.read_any(commander, ["name"], "Cmdr. Nova")))
	add_detail_row("Credits", _format_credits(StateBridge.read_any(commander, ["cash", "credits"], null)))
	add_detail_row("Fuel", _format_light_years(StateBridge.read_any(commander, ["fuel"], null)))
	add_detail_row("Legal", "%s (%s)" % [
		CommanderDomain.get_legal_status(int(StateBridge.read_any(commander, ["legal_value", "legalValue"], 0))),
		str(StateBridge.read_any(commander, ["legal_value", "legalValue"], "0"))
	])
	add_detail_row("Rating", str(StateBridge.read_any(commander, ["rating"], "Harmless")))
	add_detail_row("Tally", str(StateBridge.read_any(commander, ["tally"], "0")))
	add_detail_row("Ship", str(StateBridge.read_any(commander, ["ship_type", "shipType"], "cobra_mk_iii")))
	add_detail_row("Cargo", "%s / %s t" % [
		str(get_cargo_used_tonnes(StateBridge.read_value(commander, &"cargo", {}))),
		str(StateBridge.read_any(commander, ["cargo_capacity", "cargoCapacity"], "-"))
	])
	add_detail_row("Missiles", "%s / %s" % [
		str(StateBridge.read_any(commander, ["missiles_installed", "missilesInstalled"], "0")),
		str(StateBridge.read_any(commander, ["missile_capacity", "missileCapacity"], "0"))
	])

	var current_fuel_units: int = FuelDomain.get_fuel_units(float(StateBridge.read_any(commander, ["fuel"], 0.0)))
	var max_fuel_units: int = FuelDomain.get_fuel_units(float(StateBridge.read_any(commander, ["max_fuel", "maxFuel"], FuelDomain.MAX_FUEL)))
	var missing_fuel_units: int = max(0, max_fuel_units - current_fuel_units)
	add_action_row([
		{"label": "Buy 0.1 LY", "callback": func() -> void: StateBridge.call_action(&"buy_fuel", [1]), "disabled": missing_fuel_units < 1},
		{"label": "Fill Tank", "callback": func() -> void: StateBridge.call_action(&"buy_fuel", [missing_fuel_units]), "disabled": missing_fuel_units < 1}
	])

	add_spacer()
	add_section_title("Installed Systems")
	var equipment: Array = OutfittingDomain.get_installed_equipment_list(commander if commander is Dictionary else {})
	if equipment is Array and not equipment.is_empty():
		for item in equipment:
			add_bullet(str(item))
	else:
		add_notice("No optional systems are installed yet.")

	add_spacer()
	add_section_title("Laser Mounts")
	var laser_mounts: Dictionary = StateBridge.read_any(commander, ["laser_mounts", "laserMounts"], {})
	for mount in ["front", "rear", "left", "right"]:
		add_detail_row(mount.capitalize(), str(laser_mounts.get(mount, "Empty")))
