extends Control
class_name UIScreenBase

@export var screen_title := "Screen"
@export var screen_subtitle := ""
@export var empty_message := "No docked data is available yet."
@export var show_header := true

var _shell_built := false
var _title_label: Label
var _subtitle_label: Label
var _body_column: VBoxContainer
var _scroll: ScrollContainer

func _ready() -> void:
	set_anchors_preset(Control.PRESET_FULL_RECT)
	_build_shell()
	_connect_state_signal()
	refresh_from_state()

func refresh_from_state() -> void:
	# Screen content is rebuilt from the current state snapshot whenever the
	# shell becomes visible. This keeps the UI logic deterministic and makes it
	# easy to bind to an eventual GameState autoload without changing layouts.
	if _title_label != null:
		_title_label.text = screen_title
		UiTheme.style_label(_title_label, UiTheme.CGA_YELLOW, 20)
	if _subtitle_label != null:
		_subtitle_label.text = screen_subtitle
		UiTheme.style_label(_subtitle_label, UiTheme.CGA_GREEN, 13)
	_title_label.visible = show_header and screen_title != ""
	_subtitle_label.visible = show_header and screen_subtitle != ""
	_clear_body()
	_populate_body()
	if _body_column.get_child_count() == 0:
		add_notice(empty_message)

func _populate_body() -> void:
	add_notice(empty_message)

func get_state_snapshot() -> Dictionary:
	return StateBridge.collect_snapshot()

func add_notice(text: String, tone: Color = UiTheme.CGA_GREEN) -> void:
	var label := Label.new()
	label.text = text
	UiTheme.style_label(label, tone, 14)
	label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_body_column.add_child(label)

func add_section_title(text: String) -> void:
	var label := Label.new()
	label.text = text
	UiTheme.style_label(label, UiTheme.CGA_YELLOW, 15)
	_body_column.add_child(label)

func add_detail_row(key_text: String, value_text: String, value_color: Color = UiTheme.CGA_GREEN) -> void:
	var row := HBoxContainer.new()
	row.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	row.add_theme_constant_override("separation", 12)

	var key_label := Label.new()
	key_label.text = key_text
	key_label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	UiTheme.style_label(key_label, UiTheme.CGA_YELLOW, 14)

	var value_label := Label.new()
	value_label.text = value_text
	value_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	value_label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	UiTheme.style_label(value_label, value_color, 14)

	row.add_child(key_label)
	row.add_child(value_label)
	_body_column.add_child(row)

func add_bullet(text: String, tone: Color = UiTheme.CGA_GREEN) -> void:
	var label := Label.new()
	label.text = "- %s" % text
	UiTheme.style_label(label, tone, 14)
	label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_body_column.add_child(label)

func add_action_button(label_text: String, callback: Callable, active: bool = false) -> Button:
	var button := Button.new()
	button.text = label_text
	button.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	button.pressed.connect(callback)
	UiTheme.style_button(button, active)
	_body_column.add_child(button)
	return button

func add_action_row(actions: Array) -> HBoxContainer:
	# Action rows keep screen scripts declarative: each screen only maps state
	# into labels and callbacks while the shared widget styling stays centralized.
	var row := HBoxContainer.new()
	row.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	row.add_theme_constant_override("separation", 8)
	for action in actions:
		var button := Button.new()
		button.text = str(action.get("label", "Action"))
		button.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		var callback: Callable = action.get("callback", Callable())
		if callback.is_valid():
			button.pressed.connect(callback)
		button.disabled = bool(action.get("disabled", false))
		UiTheme.style_button(button, bool(action.get("active", false)))
		row.add_child(button)
	_body_column.add_child(row)
	return row

func add_action_hint(text: String) -> void:
	var label := Label.new()
	label.text = text
	UiTheme.style_label(label, UiTheme.CGA_RED, 12)
	label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_body_column.add_child(label)

func add_spacer(height: int = 8) -> void:
	var spacer := Control.new()
	spacer.custom_minimum_size = Vector2(0, height)
	_body_column.add_child(spacer)

func get_cargo_used_tonnes(cargo: Variant) -> int:
	if cargo is Dictionary:
		var total := 0
		for amount in cargo.values():
			total += max(0, int(floor(float(amount))))
		return total
	return 0

func _build_shell() -> void:
	if _shell_built:
		return
	_shell_built = true

	var margin := MarginContainer.new()
	margin.set_anchors_preset(Control.PRESET_FULL_RECT)
	margin.add_theme_constant_override("margin_left", 0)
	margin.add_theme_constant_override("margin_top", 0)
	margin.add_theme_constant_override("margin_right", 0)
	margin.add_theme_constant_override("margin_bottom", 0)
	add_child(margin)

	var panel := PanelContainer.new()
	panel.set_anchors_preset(Control.PRESET_FULL_RECT)
	UiTheme.style_panel(panel, UiTheme.CGA_YELLOW)
	margin.add_child(panel)

	var outer := VBoxContainer.new()
	outer.set_anchors_preset(Control.PRESET_FULL_RECT)
	outer.add_theme_constant_override("separation", 8)
	panel.add_child(outer)

	var header := VBoxContainer.new()
	header.add_theme_constant_override("separation", 4)
	outer.add_child(header)

	_title_label = Label.new()
	_title_label.text = screen_title
	_title_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_LEFT
	UiTheme.style_label(_title_label, UiTheme.CGA_YELLOW, 20)
	header.add_child(_title_label)

	_subtitle_label = Label.new()
	_subtitle_label.text = screen_subtitle
	_subtitle_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_LEFT
	UiTheme.style_label(_subtitle_label, UiTheme.CGA_GREEN, 13)
	header.add_child(_subtitle_label)

	_scroll = ScrollContainer.new()
	_scroll.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	_scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	outer.add_child(_scroll)

	_body_column = VBoxContainer.new()
	_body_column.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_body_column.size_flags_vertical = Control.SIZE_EXPAND_FILL
	_body_column.add_theme_constant_override("separation", 8)
	_body_column.add_theme_constant_override("margin_left", 0)
	_scroll.add_child(_body_column)

func _connect_state_signal() -> void:
	var state_node := StateBridge.get_game_state_node()
	if state_node == null or not state_node.has_signal("changed"):
		return
	if not state_node.changed.is_connected(_on_game_state_changed):
		state_node.changed.connect(_on_game_state_changed)

func _on_game_state_changed(_section: StringName) -> void:
	refresh_from_state()

func _clear_body() -> void:
	if _body_column == null:
		return
	for child in _body_column.get_children():
		_body_column.remove_child(child)
		child.free()

func _format_number(value: Variant, decimals: int = 0) -> String:
	if value == null:
		return "-"
	var number := float(value)
	if decimals <= 0:
		return str(int(round(number)))
	return "%0.*f" % [decimals, number]

func _format_credits(value: Variant) -> String:
	return "%s Cr" % _format_number(value, 0)

func _format_light_years(value: Variant) -> String:
	return "%s LY" % _format_number(value, 1)
