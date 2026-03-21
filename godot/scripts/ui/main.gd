extends Control
class_name MainShell

const TAB_ORDER := [
	"market",
	"equipment",
	"inventory",
	"system_data",
	"star_map",
	"missions",
	"save_load"
]

const TAB_LABELS := {
	"market": "Market",
	"equipment": "Equipment",
	"inventory": "Inventory",
	"system_data": "System",
	"star_map": "Star Map",
	"missions": "Missions",
	"save_load": "Save/Load"
}

const TAB_STATE_VALUES := {
	"market": "market",
	"equipment": "equipment",
	"inventory": "inventory",
	"system_data": "system-data",
	"star_map": "star-map",
	"missions": "missions",
	"save_load": "save-load",
	"travel": "travel"
}

const STATE_TAB_VALUES := {
	"market": "market",
	"equipment": "equipment",
	"inventory": "inventory",
	"system-data": "system_data",
	"system_data": "system_data",
	"star-map": "star_map",
	"star_map": "star_map",
	"missions": "missions",
	"save-load": "save_load",
	"save_load": "save_load",
	"travel": "travel"
}

const TAB_SCENES := {
	"market": preload("res://scenes/screens/MarketScreen.tscn"),
	"equipment": preload("res://scenes/screens/EquipmentScreen.tscn"),
	"inventory": preload("res://scenes/screens/InventoryScreen.tscn"),
	"system_data": preload("res://scenes/screens/SystemDataScreen.tscn"),
	"star_map": preload("res://scenes/screens/StarMapScreen.tscn"),
	"missions": preload("res://scenes/screens/MissionsScreen.tscn"),
	"save_load": preload("res://scenes/screens/SaveLoadScreen.tscn"),
	"travel": preload("res://scenes/screens/TravelScreen.tscn")
}

var _shell_built := false
var _selected_tab := "market"
var _docked_shell: Control
var _screen_host: Control
var _travel_host: Control
var _status_title: Label
var _status_details: Label
var _notice_label: Label
var _credits_value: Label
var _cargo_value: Label
var _system_value: Label
var _tab_buttons: Dictionary = {}
var _current_screen: Node = null
var _refresh_timer := 0.0
var _debug_layout_logged := false

func _ready() -> void:
	_resize_to_viewport()
	if not get_viewport().size_changed.is_connected(_on_viewport_size_changed):
		get_viewport().size_changed.connect(_on_viewport_size_changed)
	_build_shell()
	_connect_state_signal()
	_selected_tab = _local_tab_from_state_tab(_initial_state_tab())
	_set_tab(_selected_tab)
	_sync_chrome()

func _process(delta: float) -> void:
	# The shell prefers `GameState.changed`, but a light poll remains as a
	# defensive fallback while the runtime contract is still settling.
	_refresh_timer += delta
	if _refresh_timer < 0.25:
		return
	_refresh_timer = 0.0
	_log_layout_debug_once()
	_sync_chrome()
	_refresh_current_screen()

func _connect_state_signal() -> void:
	var state_node := StateBridge.get_game_state_node()
	if state_node == null or not state_node.has_signal("changed"):
		return
	if not state_node.changed.is_connected(_on_game_state_changed):
		state_node.changed.connect(_on_game_state_changed)

func _on_game_state_changed(_section: StringName) -> void:
	_sync_chrome()
	_refresh_current_screen()

func _build_shell() -> void:
	if _shell_built:
		return
	_shell_built = true

	var root := PanelContainer.new()
	root.set_anchors_preset(Control.PRESET_FULL_RECT)
	UiTheme.style_panel(root, UiTheme.CGA_BLACK, UiTheme.CGA_BLACK)
	add_child(root)

	_travel_host = Control.new()
	_travel_host.set_anchors_preset(Control.PRESET_FULL_RECT)
	_travel_host.visible = false
	root.add_child(_travel_host)

	var shell_margin := MarginContainer.new()
	shell_margin.set_anchors_preset(Control.PRESET_FULL_RECT)
	shell_margin.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	shell_margin.size_flags_vertical = Control.SIZE_EXPAND_FILL
	shell_margin.add_theme_constant_override("margin_left", 12)
	shell_margin.add_theme_constant_override("margin_top", 12)
	shell_margin.add_theme_constant_override("margin_right", 12)
	shell_margin.add_theme_constant_override("margin_bottom", 12)
	root.add_child(shell_margin)

	var shell_row := HBoxContainer.new()
	shell_row.set_anchors_preset(Control.PRESET_FULL_RECT)
	shell_row.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	shell_row.size_flags_vertical = Control.SIZE_EXPAND_FILL
	shell_margin.add_child(shell_row)
	_docked_shell = shell_row

	var shell_column := VBoxContainer.new()
	shell_column.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	shell_column.size_flags_vertical = Control.SIZE_EXPAND_FILL
	shell_column.add_theme_constant_override("separation", 10)
	shell_row.add_child(shell_column)

	var status_panel := PanelContainer.new()
	UiTheme.style_panel(status_panel, UiTheme.CGA_YELLOW)
	status_panel.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	shell_column.add_child(status_panel)

	var status_column := VBoxContainer.new()
	status_column.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	status_column.add_theme_constant_override("separation", 6)
	status_panel.add_child(status_column)

	_status_title = Label.new()
	_status_title.text = "DISO Commander Console"
	UiTheme.style_label(_status_title, UiTheme.CGA_YELLOW, 20)
	status_column.add_child(_status_title)

	var hud_grid := GridContainer.new()
	hud_grid.columns = 3
	hud_grid.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	hud_grid.add_theme_constant_override("h_separation", 8)
	hud_grid.add_theme_constant_override("v_separation", 8)
	status_column.add_child(hud_grid)

	_credits_value = _build_stat_card(hud_grid, "CREDITS")
	_cargo_value = _build_stat_card(hud_grid, "CARGO")
	_system_value = _build_stat_card(hud_grid, "SYSTEM")

	_status_details = Label.new()
	_status_details.text = "Waiting for GameState autoload."
	UiTheme.style_label(_status_details, UiTheme.CGA_GREEN, 14)
	_status_details.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	status_column.add_child(_status_details)

	_notice_label = Label.new()
	_notice_label.text = ""
	UiTheme.style_label(_notice_label, UiTheme.CGA_RED, 13)
	_notice_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	status_column.add_child(_notice_label)

	_screen_host = MarginContainer.new()
	_screen_host.custom_minimum_size = Vector2(0, 320)
	_screen_host.size_flags_vertical = Control.SIZE_EXPAND_FILL
	_screen_host.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_screen_host.add_theme_constant_override("margin_left", 0)
	_screen_host.add_theme_constant_override("margin_top", 0)
	_screen_host.add_theme_constant_override("margin_right", 0)
	_screen_host.add_theme_constant_override("margin_bottom", 0)
	shell_column.add_child(_screen_host)

	var nav_panel := PanelContainer.new()
	UiTheme.style_panel(nav_panel, UiTheme.CGA_YELLOW)
	nav_panel.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	shell_column.add_child(nav_panel)

	var nav_row := GridContainer.new()
	nav_row.columns = 7
	nav_row.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	nav_row.add_theme_constant_override("h_separation", 6)
	nav_row.add_theme_constant_override("v_separation", 6)
	nav_panel.add_child(nav_row)

	for tab_id in TAB_ORDER:
		var button := Button.new()
		button.text = _tab_button_label(tab_id)
		button.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		button.pressed.connect(_on_tab_pressed.bind(tab_id))
		UiTheme.style_tab_button(button, tab_id == _selected_tab)
		nav_row.add_child(button)
		_tab_buttons[tab_id] = button

func _on_tab_pressed(tab_id: String) -> void:
	var state_tab: String = str(TAB_STATE_VALUES.get(tab_id, tab_id))
	StateBridge.call_action("set_active_tab", [state_tab])
	_set_tab(tab_id)

func _set_tab(tab_id: String) -> void:
	if not TAB_SCENES.has(tab_id):
		tab_id = "market"
	_selected_tab = tab_id
	_sync_nav_buttons()
	_swap_screen()
	_sync_chrome()

func _swap_screen() -> void:
	if _current_screen != null and is_instance_valid(_current_screen):
		_current_screen.queue_free()
	_current_screen = null

	var packed_scene := TAB_SCENES.get(_selected_tab) as PackedScene
	if packed_scene == null:
		return

	var host: Control = _travel_host if _selected_tab == "travel" else _screen_host
	_travel_host.visible = _selected_tab == "travel"
	_docked_shell.visible = _selected_tab != "travel"

	_current_screen = packed_scene.instantiate()
	if _current_screen is Control:
		_current_screen.set_anchors_preset(Control.PRESET_FULL_RECT)
		_current_screen.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		_current_screen.size_flags_vertical = Control.SIZE_EXPAND_FILL
	host.add_child(_current_screen)
	if _current_screen.has_method("refresh_from_state"):
		_current_screen.call("refresh_from_state")

func _refresh_current_screen() -> void:
	if _current_screen == null or not is_instance_valid(_current_screen):
		return
	if _current_screen.has_method("refresh_from_state"):
		_current_screen.call("refresh_from_state")

func _sync_nav_buttons() -> void:
	for tab_id in _tab_buttons.keys():
		var button := _tab_buttons[tab_id] as Button
		if button == null:
			continue
		UiTheme.style_tab_button(button, tab_id == _selected_tab)

func _sync_chrome() -> void:
	var snapshot: Dictionary = StateBridge.collect_snapshot()
	var commander: Variant = snapshot.get("commander", null)
	var universe: Variant = snapshot.get("universe", null)
	var travel_session: Variant = snapshot.get("travel_session", null)

	var commander_name: String = str(StateBridge.read_any(commander, ["name", "cmdrName"], "Cmdr. Nova"))
	var credits: Variant = StateBridge.read_any(commander, ["cash", "credits"], null)
	var system_name: String = str(StateBridge.read_any(universe, ["current_system", "currentSystem"], "Lave"))
	var stardate: Variant = StateBridge.read_value(universe, &"stardate", null)
	var route_text: String = "Awaiting docked state."
	var latest_event: Variant = StateBridge.read_any(snapshot.get("ui", null), ["latest_event", "latestEvent"], null)
	var cargo_amount: Variant = StateBridge.read_any(commander, ["cargo_capacity", "cargoCapacity"], 0)
	var cargo_used: int = 0
	if commander is Dictionary:
		cargo_used = _cargo_used_tonnes(commander.get("cargo", {}))
	if travel_session != null:
		var origin: Variant = StateBridge.read_any(travel_session, ["origin_system", "originSystem"], null)
		var destination: Variant = StateBridge.read_any(travel_session, ["destination_system", "destinationSystem"], null)
		if origin != null and destination != null:
			route_text = "%s -> %s" % [origin, destination]

	_status_title.text = "DISO Commander Console"
	var status_lines := PackedStringArray()
	status_lines.append("Active Tab: %s" % TAB_LABELS.get(_selected_tab, _selected_tab))
	if stardate != null:
		status_lines.append("Docked At %s" % system_name)
	if travel_session != null:
		status_lines.append("Travel: %s" % route_text)
	_credits_value.text = "%s cr" % int(round(float(credits if credits != null else 0)))
	_cargo_value.text = "%d / %s t" % [cargo_used, str(cargo_amount)]
	_system_value.text = system_name
	_status_details.text = " | ".join(status_lines)
	_notice_label.visible = latest_event != null
	_notice_label.text = "" if latest_event == null else "%s\n%s" % [str(StateBridge.read_value(latest_event, &"title", "")), str(StateBridge.read_value(latest_event, &"body", ""))]
	UiTheme.style_label(_status_title, UiTheme.CGA_YELLOW, 20)
	UiTheme.style_label(_status_details, UiTheme.CGA_GREEN, 13)
	UiTheme.style_label(_notice_label, UiTheme.CGA_RED, 13)
	UiTheme.style_label(_credits_value, UiTheme.CGA_GREEN, 16)
	UiTheme.style_label(_cargo_value, UiTheme.CGA_GREEN, 16)
	UiTheme.style_label(_system_value, UiTheme.CGA_GREEN, 16)

func _initial_state_tab() -> String:
	var snapshot: Dictionary = StateBridge.collect_snapshot()
	var ui_state: Variant = snapshot.get("ui", null)
	var active_tab: String = str(StateBridge.read_any(ui_state, ["active_tab", "activeTab"], "market"))
	return str(active_tab)

func _local_tab_from_state_tab(state_tab: String) -> String:
	return STATE_TAB_VALUES.get(state_tab, "market")

func _build_stat_card(parent: Control, label_text: String) -> Label:
	var panel := PanelContainer.new()
	UiTheme.style_panel(panel, UiTheme.CGA_YELLOW)
	panel.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	panel.custom_minimum_size = Vector2(140, 0)
	parent.add_child(panel)

	var column := VBoxContainer.new()
	column.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	column.add_theme_constant_override("separation", 2)
	panel.add_child(column)

	var label := Label.new()
	label.text = label_text
	UiTheme.style_label(label, UiTheme.CGA_YELLOW, 11)
	label.autowrap_mode = TextServer.AUTOWRAP_OFF
	column.add_child(label)

	var value := Label.new()
	value.text = "-"
	UiTheme.style_label(value, UiTheme.CGA_GREEN, 16)
	value.autowrap_mode = TextServer.AUTOWRAP_OFF
	column.add_child(value)
	return value

func _tab_button_label(tab_id: String) -> String:
	match tab_id:
		"market":
			return "$"
		"equipment":
			return "E"
		"inventory":
			return "I"
		"system_data":
			return "?"
		"star_map":
			return "*"
		"missions":
			return "!"
		"save_load":
			return "="
		"travel":
			return ">"
		_:
			return tab_id.left(1).to_upper()

func _cargo_used_tonnes(cargo: Variant) -> int:
	if cargo is Dictionary:
		var total := 0
		for amount in cargo.values():
			total += max(0, int(floor(float(amount))))
		return total
	return 0

func _on_viewport_size_changed() -> void:
	_resize_to_viewport()

func _resize_to_viewport() -> void:
	# The scene root is a top-level Control, so it does not inherit size from a
	# parent container. It must mirror the viewport explicitly or every child
	# anchored to "full rect" will collapse to its minimum size.
	var viewport_size: Vector2 = get_viewport_rect().size
	size = viewport_size
	custom_minimum_size = viewport_size

func _log_layout_debug_once() -> void:
	if _debug_layout_logged:
		return
	_debug_layout_logged = true

	var viewport_rect: Rect2 = get_viewport_rect()
	print("[layout] viewport=", viewport_rect.size)
	print("[layout] window=", size)
	if _docked_shell != null:
		print("[layout] docked_shell=", _docked_shell.size)
	if _screen_host != null:
		print("[layout] screen_host=", _screen_host.size)
	if _travel_host != null:
		print("[layout] travel_host=", _travel_host.size)
	if _current_screen != null and _current_screen is Control:
		print("[layout] current_screen=", (_current_screen as Control).size)
