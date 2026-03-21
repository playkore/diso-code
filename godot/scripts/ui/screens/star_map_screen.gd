extends UIScreenBase

const FuelDomain = preload("res://scripts/domain/fuel.gd")
const GalaxyCatalog = preload("res://scripts/domain/galaxy_catalog.gd")

func _init() -> void:
	screen_title = "Star Map"
	screen_subtitle = "Local jump range, nearby systems, and destination selection scaffolding."
	empty_message = "The star map will bind to the procedural galaxy state later in the port."

func _populate_body() -> void:
	var snapshot := get_state_snapshot()
	var universe := snapshot.get("universe", null)
	var commander := snapshot.get("commander", null)

	add_section_title("Jump Context")
	add_detail_row("Current System", str(StateBridge.read_any(universe, ["current_system", "currentSystem"], "Lave")))
	add_detail_row("Fuel", _format_light_years(StateBridge.read_value(commander, &"fuel", null)))
	add_detail_row("Nearby Systems", str(StateBridge.read_any(universe, ["nearby_systems", "nearbySystems"], [])))

	add_spacer()
	add_section_title("Jump Targets")
	var current_system := str(StateBridge.read_any(universe, ["current_system", "currentSystem"], "Lave"))
	var fuel := float(StateBridge.read_any(commander, ["fuel"], 0.0))
	for system_name in StateBridge.read_any(universe, ["nearby_systems", "nearbySystems"], []):
		var destination_name := str(system_name)
		var distance := GalaxyCatalog.get_system_distance(current_system, destination_name)
		var in_range := FuelDomain.get_jump_fuel_units(distance) <= FuelDomain.get_fuel_units(fuel)
		add_detail_row(destination_name, "%s LY" % _format_number(distance, 1), UiTheme.CGA_GREEN if in_range else UiTheme.CGA_RED)
		add_action_row([
			{"label": "Travel", "callback": func() -> void: StateBridge.call_action(&"begin_travel", [destination_name]), "disabled": not in_range}
		])
