extends UIScreenBase

const GalaxyCatalog = preload("res://scripts/domain/galaxy_catalog.gd")
const OutfittingDomain = preload("res://scripts/domain/outfitting.gd")
const ShipCatalog = preload("res://scripts/domain/ship_catalog.gd")

func _init() -> void:
	screen_title = "Equipment"
	screen_subtitle = "Ship loadout, weapons, missiles, and installable systems."
	empty_message = "Equipment offers will populate from the future ship and market state."

func _populate_body() -> void:
	var snapshot: Dictionary = get_state_snapshot()
	var commander: Variant = snapshot.get("commander", null)
	var universe: Variant = snapshot.get("universe", null)
	var commander_dict: Dictionary = commander if commander is Dictionary else {}

	add_section_title("Ship State")
	add_detail_row("Ship", str(StateBridge.read_any(commander, ["ship_type", "shipType"], "Cobra Mk III")))
	add_detail_row("Current System", str(StateBridge.read_any(universe, ["current_system", "currentSystem"], "Lave")))
	add_detail_row("Energy Banks", str(StateBridge.read_any(commander, ["energy_banks", "energyBanks"], "-")))
	add_detail_row("Missiles", "%s / %s" % [
		str(StateBridge.read_any(commander, ["missiles_installed", "missilesInstalled"], "-")),
		str(StateBridge.read_any(commander, ["missile_capacity", "missileCapacity"], "-"))
	])

	add_spacer()
	var system_name: String = str(StateBridge.read_any(universe, ["current_system", "currentSystem"], "Lave"))
	var tech_level: int = int(GalaxyCatalog.get_system_by_name(system_name).get("data", {}).get("tech_level", 0))
	add_detail_row("Tech Level", str(tech_level), UiTheme.CGA_YELLOW)

	add_spacer()
	add_section_title("Laser Mounts")
	for mount in ["front", "rear", "left", "right"]:
		var installed_laser: Variant = commander_dict.get("laser_mounts", {}).get(mount, null)
		add_detail_row(mount.capitalize(), str(installed_laser if installed_laser != null else "Empty"))
		for offer_variant in OutfittingDomain.get_laser_offers_for_system(tech_level, commander_dict, mount):
			var offer: Dictionary = offer_variant
			var laser_id: String = str(offer.get("id", ""))
			add_action_row([
				{"label": "%s (%s Cr)" % [str(offer.get("name", laser_id)), str(offer.get("price", 0))], "callback": func() -> void: StateBridge.call_action(&"buy_laser", [mount, laser_id]), "disabled": not bool(offer.get("available", false))}
			])
			if str(offer.get("reason", "")) != "":
				add_action_hint(str(offer.get("reason", "")))
		add_spacer(8)

	add_section_title("Equipment Market")
	for offer in OutfittingDomain.get_available_equipment_for_system(tech_level, commander_dict):
		var equipment_id := str(offer.get("id", ""))
		add_detail_row(str(offer.get("name", "Equipment")), "%s Cr" % str(offer.get("price", 0)))
		add_action_row([
			{"label": "Buy", "callback": func() -> void: StateBridge.call_action(&"buy_equipment", [equipment_id]), "disabled": bool(offer.get("installed", false))}
		])
		if str(offer.get("reason", "")) != "":
			add_action_hint(str(offer.get("reason", "")))

	add_spacer()
	add_section_title("Weapons")
	add_detail_row("Missile Price", "%s Cr" % str(ShipCatalog.MISSILE_CATALOG.get("price", 0)), UiTheme.CGA_YELLOW)
	var missile_state: Dictionary = OutfittingDomain.can_buy_missile(commander_dict, tech_level)
	add_action_row([
		{"label": "Buy Missile", "callback": func() -> void: StateBridge.call_action(&"buy_missile"), "disabled": not bool(missile_state.get("ok", false))}
	])
	if str(missile_state.get("reason", "")) != "":
		add_action_hint(str(missile_state.get("reason", "")))
