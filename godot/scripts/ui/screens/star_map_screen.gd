extends UIScreenBase

const FuelDomain = preload("res://scripts/domain/fuel.gd")
const GalaxyCatalog = preload("res://scripts/domain/galaxy_catalog.gd")

func _init() -> void:
	screen_title = "Star Map"
	screen_subtitle = "Local jump range, nearby systems, and destination selection scaffolding."
	empty_message = "The star map will bind to the procedural galaxy state later in the port."

func _populate_body() -> void:
	var snapshot: Dictionary = get_state_snapshot()
	var universe: Variant = snapshot.get("universe", null)
	var commander: Variant = snapshot.get("commander", null)

	add_section_title("Jump Context")
	add_detail_row("Current System", str(StateBridge.read_any(universe, ["current_system", "currentSystem"], "Lave")))
	add_detail_row("Fuel", _format_light_years(StateBridge.read_value(commander, &"fuel", null)))
	add_detail_row("Nearby Systems", str(StateBridge.read_any(universe, ["nearby_systems", "nearbySystems"], [])))
	var current_fuel_units: int = FuelDomain.get_fuel_units(float(StateBridge.read_any(commander, ["fuel"], 0.0)))
	var max_fuel_units: int = FuelDomain.get_fuel_units(float(StateBridge.read_any(commander, ["max_fuel", "maxFuel"], FuelDomain.MAX_FUEL)))
	var missing_fuel_units: int = max(0, max_fuel_units - current_fuel_units)
	add_action_row([
		{"label": "Buy 0.1 LY", "callback": func() -> void: StateBridge.call_action(&"buy_fuel", [1]), "disabled": missing_fuel_units < 1},
		{"label": "Fill Fuel", "callback": func() -> void: StateBridge.call_action(&"buy_fuel", [missing_fuel_units]), "disabled": missing_fuel_units < 1}
	])

	add_spacer()
	add_section_title("Visible Systems")
	var current_system: String = str(StateBridge.read_any(universe, ["current_system", "currentSystem"], "Lave"))
	var fuel: float = float(StateBridge.read_any(commander, ["fuel"], 0.0))
	for system_variant in GalaxyCatalog.get_visible_systems(current_system):
		var system: Dictionary = system_variant
		var destination_name: String = str(system.get("data", {}).get("name", "Unknown"))
		if destination_name == current_system:
			continue
		var distance: float = GalaxyCatalog.get_system_distance(current_system, destination_name)
		var in_range: bool = FuelDomain.get_jump_fuel_units(distance) <= FuelDomain.get_fuel_units(fuel)
		add_detail_row(destination_name, "%s LY | TL %s" % [_format_number(distance, 1), str(system.get("data", {}).get("tech_level", 0))], UiTheme.CGA_GREEN if in_range else UiTheme.CGA_RED)
		add_action_row([
			{"label": "Travel", "callback": func() -> void: StateBridge.call_action(&"begin_travel", [destination_name]), "disabled": not in_range}
		])
