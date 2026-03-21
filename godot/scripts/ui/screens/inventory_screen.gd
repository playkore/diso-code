extends UIScreenBase

const CommanderDomain = preload("res://scripts/domain/commander.gd")
const OutfittingDomain = preload("res://scripts/domain/outfitting.gd")

func _init() -> void:
	screen_title = "Inventory"
	screen_subtitle = "Commander status, cargo, fuel, and installed systems."
	empty_message = "Commander inventory will appear once GameState exposes a docked snapshot."

func _populate_body() -> void:
	var snapshot := get_state_snapshot()
	var commander := snapshot.get("commander", null)

	add_section_title("Commander Summary")
	add_detail_row("Name", str(StateBridge.read_any(commander, ["name"], "Cmdr. Nova")))
	add_detail_row("Credits", _format_credits(StateBridge.read_any(commander, ["cash", "credits"], null)))
	add_detail_row("Fuel", _format_light_years(StateBridge.read_any(commander, ["fuel"], null)))
	add_detail_row("Legal", "%s (%s)" % [
		CommanderDomain.get_legal_status(int(StateBridge.read_any(commander, ["legal_value", "legalValue"], 0))),
		str(StateBridge.read_any(commander, ["legal_value", "legalValue"], "0"))
	])
	add_detail_row("Rating", str(StateBridge.read_any(commander, ["rating"], "Harmless")))
	add_detail_row("Cargo", "%s / %s t" % [
		str(get_cargo_used_tonnes(StateBridge.read_value(commander, &"cargo", {}))),
		str(StateBridge.read_any(commander, ["cargo_capacity", "cargoCapacity"], "-"))
	])

	add_spacer()
	add_section_title("Installed Systems")
	var equipment := OutfittingDomain.get_installed_equipment_list(commander if commander is Dictionary else {})
	if equipment is Array and not equipment.is_empty():
		for item in equipment:
			add_bullet(str(item))
	else:
		add_notice("No optional systems are installed yet.")
