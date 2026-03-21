extends Control

var _built := false
var _title_label: Label
var _subtitle_label: Label
var _hud_label: Label
var _message_label: Label
var _status_label: Label
var _last_action := "Awaiting player input."

func _ready() -> void:
	set_anchors_preset(Control.PRESET_FULL_RECT)
	_build_shell()
	_connect_state_signal()
	_refresh_view()

func refresh_from_state() -> void:
	_refresh_view()

func _build_shell() -> void:
	if _built:
		return
	_built = true

	var root := MarginContainer.new()
	root.set_anchors_preset(Control.PRESET_FULL_RECT)
	root.add_theme_constant_override("margin_left", 0)
	root.add_theme_constant_override("margin_top", 0)
	root.add_theme_constant_override("margin_right", 0)
	root.add_theme_constant_override("margin_bottom", 0)
	add_child(root)

	var column := VBoxContainer.new()
	column.set_anchors_preset(Control.PRESET_FULL_RECT)
	column.add_theme_constant_override("separation", 8)
	root.add_child(column)

	var header := PanelContainer.new()
	UiTheme.style_panel(header, UiTheme.CGA_YELLOW)
	column.add_child(header)

	var header_column := VBoxContainer.new()
	header_column.add_theme_constant_override("separation", 4)
	header.add_child(header_column)

	_title_label = Label.new()
	_title_label.text = "Travel"
	UiTheme.style_label(_title_label, UiTheme.CGA_YELLOW, 20)
	header_column.add_child(_title_label)

	_subtitle_label = Label.new()
	_subtitle_label.text = "A full-screen gameplay surface is reserved here."
	UiTheme.style_label(_subtitle_label, UiTheme.CGA_GREEN, 13)
	header_column.add_child(_subtitle_label)

	var playfield := PanelContainer.new()
	playfield.size_flags_vertical = Control.SIZE_EXPAND_FILL
	playfield.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	UiTheme.style_panel(playfield, UiTheme.CGA_GREEN)
	column.add_child(playfield)

	var playfield_column := VBoxContainer.new()
	playfield_column.add_theme_constant_override("separation", 8)
	playfield.add_child(playfield_column)

	_hud_label = Label.new()
	UiTheme.style_label(_hud_label, UiTheme.CGA_YELLOW, 14)
	_hud_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	playfield_column.add_child(_hud_label)

	_message_label = Label.new()
	UiTheme.style_label(_message_label, UiTheme.CGA_GREEN, 14)
	_message_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	playfield_column.add_child(_message_label)

	var controls := GridContainer.new()
	controls.columns = 3
	controls.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	controls.add_theme_constant_override("h_separation", 6)
	controls.add_theme_constant_override("v_separation", 6)
	playfield_column.add_child(controls)

	for action_name in ["JUMP", "HYPER", "FIRE", "ECM", "BOMB", "DOCK"]:
		var button := Button.new()
		button.text = action_name
		button.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		button.pressed.connect(_on_action_pressed.bind(action_name))
		UiTheme.style_button(button, false)
		controls.add_child(button)

	var cancel_button := Button.new()
	cancel_button.text = "ABORT"
	cancel_button.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	cancel_button.pressed.connect(func() -> void:
		StateBridge.call_action(&"cancel_travel")
	)
	UiTheme.style_button(cancel_button, false)
	playfield_column.add_child(cancel_button)

	_status_label = Label.new()
	UiTheme.style_label(_status_label, UiTheme.CGA_RED, 12)
	_status_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	playfield_column.add_child(_status_label)

func _connect_state_signal() -> void:
	var state_node := StateBridge.get_game_state_node()
	if state_node == null or not state_node.has_signal("changed"):
		return
	if not state_node.changed.is_connected(_on_game_state_changed):
		state_node.changed.connect(_on_game_state_changed)

func _on_game_state_changed(_section: StringName) -> void:
	_refresh_view()

func _on_action_pressed(action_name: String) -> void:
	_last_action = "Travel action pressed: %s" % action_name
	if action_name == "DOCK" or action_name == "HYPER":
		StateBridge.call_action(&"complete_travel")
	elif action_name == "JUMP":
		_last_action = "Local jump scaffold triggered. Real-time combat is not ported yet."
	elif action_name == "FIRE":
		_last_action = "Fire input registered for future combat wiring."
	elif action_name == "ECM":
		_last_action = "ECM toggle reserved for missile defense logic."
	elif action_name == "BOMB":
		_last_action = "Energy bomb trigger reserved for combat port."
	_message_label.text = _last_action
	UiTheme.style_label(_message_label, UiTheme.CGA_GREEN, 14)

func _refresh_view() -> void:
	var snapshot: Dictionary = StateBridge.collect_snapshot()
	var commander: Variant = snapshot.get("commander", null)
	var universe: Variant = snapshot.get("universe", null)
	var travel_session: Variant = snapshot.get("travel_session", null)

	var origin: Variant = StateBridge.read_any(travel_session, ["origin_system", "originSystem"], StateBridge.read_any(universe, ["current_system", "currentSystem"], "Unknown"))
	var destination: Variant = StateBridge.read_any(travel_session, ["destination_system", "destinationSystem"], "Awaiting selection")
	var fuel: Variant = StateBridge.read_value(commander, &"fuel", null)
	var legal: Variant = StateBridge.read_any(commander, ["legal_value", "legalValue"], null)
	var fuel_cost: Variant = StateBridge.read_any(travel_session, ["fuel_cost", "fuelCost"], null)
	var status_lines := PackedStringArray()
	status_lines.append("Route: %s -> %s" % [str(origin), str(destination)])
	if fuel != null:
		status_lines.append("Fuel: %s" % _format_light_years(fuel))
	if fuel_cost != null:
		status_lines.append("Jump Cost: %s" % _format_light_years(fuel_cost))
	if legal != null:
		status_lines.append("Legal: %s" % str(legal))

	_title_label.text = "Travel"
	_subtitle_label.text = "Full-screen flight and docking shell."
	_hud_label.text = " | ".join(status_lines)
	_message_label.text = _last_action
	_status_label.text = "DOCK and HYPER already return to the docked shell. The rest of the travel runtime is still placeholder."

func _format_number(value: Variant, decimals: int = 0) -> String:
	if value == null:
		return "-"
	var number: float = float(value)
	if decimals <= 0:
		return str(int(round(number)))
	return "%0.*f" % [decimals, number]

func _format_light_years(value: Variant) -> String:
	return "%s LY" % _format_number(value, 1)
