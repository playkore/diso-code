extends Object
class_name UiTheme

const CGA_BLACK := Color("#000000")
const CGA_GREEN := Color("#55ff55")
const CGA_RED := Color("#ff5555")
const CGA_YELLOW := Color("#ffff55")

static func make_panel_style(
	border_color: Color = CGA_YELLOW,
	bg_color: Color = CGA_BLACK,
	border_width: int = 2,
	corner_radius: int = 6
) -> StyleBoxFlat:
	var style := StyleBoxFlat.new()
	style.bg_color = bg_color
	style.border_width_left = border_width
	style.border_width_top = border_width
	style.border_width_right = border_width
	style.border_width_bottom = border_width
	style.border_color = border_color
	style.corner_radius_top_left = corner_radius
	style.corner_radius_top_right = corner_radius
	style.corner_radius_bottom_left = corner_radius
	style.corner_radius_bottom_right = corner_radius
	return style

static func style_panel(panel: Control, border_color: Color = CGA_YELLOW, bg_color: Color = CGA_BLACK) -> void:
	if panel == null:
		return
	if panel is PanelContainer:
		panel.add_theme_stylebox_override("panel", make_panel_style(border_color, bg_color))
		return
	panel.add_theme_stylebox_override("panel", make_panel_style(border_color, bg_color))

static func style_label(label: Label, color: Color = CGA_GREEN, font_size: int = 14) -> void:
	if label == null:
		return
	label.add_theme_color_override("font_color", color)
	label.add_theme_font_size_override("font_size", font_size)
	label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART

static func style_button(button: Button, active: bool = false) -> void:
	if button == null:
		return
	var border_color := CGA_YELLOW if not active else CGA_RED
	var bg_color := CGA_BLACK if not active else CGA_RED
	var text_color := CGA_YELLOW if not active else CGA_BLACK
	button.focus_mode = Control.FOCUS_ALL
	button.add_theme_stylebox_override("normal", make_panel_style(border_color, bg_color, 2, 4))
	button.add_theme_stylebox_override("hover", make_panel_style(border_color, bg_color, 2, 4))
	button.add_theme_stylebox_override("pressed", make_panel_style(border_color, bg_color, 2, 4))
	button.add_theme_stylebox_override("focus", make_panel_style(border_color, bg_color, 2, 4))
	button.add_theme_color_override("font_color", text_color)
	button.add_theme_color_override("font_hover_color", text_color)
	button.add_theme_color_override("font_pressed_color", text_color)
	button.add_theme_color_override("font_focus_color", text_color)
	button.add_theme_font_size_override("font_size", 14)
	button.custom_minimum_size = Vector2(0, 40)

static func style_tab_button(button: Button, active: bool = false) -> void:
	if button == null:
		return
	button.flat = false
	style_button(button, active)
	button.add_theme_font_size_override("font_size", 12)
	if active:
		button.add_theme_color_override("font_color", CGA_BLACK)
		button.add_theme_color_override("font_hover_color", CGA_BLACK)
		button.add_theme_color_override("font_pressed_color", CGA_BLACK)
		button.add_theme_color_override("font_focus_color", CGA_BLACK)
