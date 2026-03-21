extends Control
class_name MainShell

const TAB_ORDER := [
	"market",
	"equipment",
	"inventory",
	"system_data",
	"star_map",
	"missions",
	"save_load",
	"travel"
]

const TAB_LABELS := {
	"market": "Market",
	"equipment": "Equipment",
	"inventory": "Inventory",
	"system_data": "System",
	"star_map": "Star Map",
	"missions": "Missions",
	"save_load": "Save/Load",
	"travel": "Travel"
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
var _screen_host: MarginContainer
var _travel_host: Control
var _status_title: Label
var _status_details: Label
var _notice_label: Label
var _tab_buttons: Dictionary = {}
var _current_screen: Node = null
var _refresh_timer := 0.0

func _ready() -> void:
	set_anchors_preset(Control.PRESET_FULL_RECT)
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

	var root := Control.new()
	root.set_anchors_preset(Control.PRESET_FULL_RECT)
	add_child(root)

	_travel_host = Control.new()
	_travel_host.set_anchors_preset(Control.PRESET_FULL_RECT)
	_travel_host.visible = false
	root.add_child(_travel_host)

	var shell_margin := MarginContainer.new()
	shell_margin.set_anchors_preset(Control.PRESET_FULL_RECT)
	shell_margin.add_theme_constant_override("margin_left", 12)
	shell_margin.add_theme_constant_override("margin_top", 12)
	shell_margin.add_theme_constant_override("margin_right", 12)
	shell_margin.add_theme_constant_override("margin_bottom", 12)
	root.add_child(shell_margin)
	_docked_shell = shell_margin

	var shell_column := VBoxContainer.new()
	shell_column.set_anchors_preset(Control.PRESET_FULL_RECT)
	shell_column.add_theme_constant_override("separation", 10)
	shell_margin.add_child(shell_column)

	var status_panel := PanelContainer.new()
	UiTheme.style_panel(status_panel, UiTheme.CGA_YELLOW)
	shell_column.add_child(status_panel)

	var status_column := VBoxContainer.new()
	status_column.add_theme_constant_override("separation", 4)
	status_panel.add_child(status_column)

	_status_title = Label.new()
	_status_title.text = "DISO Code"
	UiTheme.style_label(_status_title, UiTheme.CGA_YELLOW, 20)
	status_column.add_child(_status_title)

	_status_details = Label.new()
	_status_details.text = "Waiting for GameState autoload."
	UiTheme.style_label(_status_details, UiTheme.CGA_GREEN, 13)
	_status_details.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	status_column.add_child(_status_details)

	_notice_label = Label.new()
	_notice_label.text = ""
	UiTheme.style_label(_notice_label, UiTheme.CGA_RED, 13)
	_notice_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	status_column.add_child(_notice_label)

	var content_panel := PanelContainer.new()
	UiTheme.style_panel(content_panel, UiTheme.CGA_GREEN)
	content_panel.size_flags_vertical = Control.SIZE_EXPAND_FILL
	shell_column.add_child(content_panel)

	_screen_host = MarginContainer.new()
	_screen_host.set_anchors_preset(Control.PRESET_FULL_RECT)
	_screen_host.add_theme_constant_override("margin_left", 10)
	_screen_host.add_theme_constant_override("margin_top", 10)
	_screen_host.add_theme_constant_override("margin_right", 10)
	_screen_host.add_theme_constant_override("margin_bottom", 10)
	content_panel.add_child(_screen_host)

	var nav_panel := PanelContainer.new()
	UiTheme.style_panel(nav_panel, UiTheme.CGA_RED)
	shell_column.add_child(nav_panel)

	var nav_row := HBoxContainer.new()
	nav_row.add_theme_constant_override("separation", 6)
	nav_panel.add_child(nav_row)

	for tab_id in TAB_ORDER:
		var button := Button.new()
		button.text = TAB_LABELS.get(tab_id, tab_id)
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
	if travel_session != null:
		var origin: Variant = StateBridge.read_any(travel_session, ["origin_system", "originSystem"], null)
		var destination: Variant = StateBridge.read_any(travel_session, ["destination_system", "destinationSystem"], null)
		if origin != null and destination != null:
			route_text = "%s -> %s" % [origin, destination]

	_status_title.text = "%s  |  %s" % [commander_name, TAB_LABELS.get(_selected_tab, _selected_tab)]
	var status_lines := PackedStringArray()
	status_lines.append("System: %s" % system_name)
	if stardate != null:
		status_lines.append("Stardate: %s" % str(stardate))
	if credits != null:
		status_lines.append("Credits: %s" % ("%s Cr" % int(round(float(credits)))))
	if travel_session != null:
		status_lines.append("Travel: %s" % route_text)
	_status_details.text = " | ".join(status_lines)
	_notice_label.text = "" if latest_event == null else "%s: %s" % [str(StateBridge.read_value(latest_event, &"title", "")), str(StateBridge.read_value(latest_event, &"body", ""))]
	UiTheme.style_label(_status_title, UiTheme.CGA_YELLOW, 20)
	UiTheme.style_label(_status_details, UiTheme.CGA_GREEN, 13)
	UiTheme.style_label(_notice_label, UiTheme.CGA_RED, 13)

func _initial_state_tab() -> String:
	var snapshot: Dictionary = StateBridge.collect_snapshot()
	var ui_state: Variant = snapshot.get("ui", null)
	var active_tab: String = str(StateBridge.read_any(ui_state, ["active_tab", "activeTab"], "market"))
	return str(active_tab)

func _local_tab_from_state_tab(state_tab: String) -> String:
	return STATE_TAB_VALUES.get(state_tab, "market")
