extends UIScreenBase

func _init() -> void:
	screen_title = "Missions"
	screen_subtitle = "Briefings, debriefings, and mission progression messages."
	empty_message = "Mission log entries will appear once the mission autoload contract is in place."

func _populate_body() -> void:
	var snapshot: Dictionary = get_state_snapshot()
	var missions: Variant = StateBridge.read_value(snapshot, &"missions", null)
	var mission_log: Variant = StateBridge.read_any(missions, ["mission_log", "missionLog"], [])

	add_section_title("Mission Log")
	if mission_log is Array and not mission_log.is_empty():
		for entry in mission_log:
			var title := str(StateBridge.read_value(entry, &"title", "Mission"))
			var kind := str(StateBridge.read_value(entry, &"kind", "briefing"))
			var body := str(StateBridge.read_value(entry, &"body", ""))
			add_detail_row(title, kind, UiTheme.CGA_RED if kind == "debriefing" else UiTheme.CGA_GREEN)
			if body.length() > 0:
				add_notice(body)
	else:
		add_notice("No active mission messages are available yet.")

	add_spacer()
	add_section_title("Debug Progression")
	add_action_row([
		{"label": "Constrictor Kill", "callback": func() -> void: StateBridge.call_action(&"trigger_mission_external_event", ["combat:constrictor-destroyed"])},
		{"label": "Plans Delivered", "callback": func() -> void: StateBridge.call_action(&"trigger_mission_external_event", ["combat:thargoid-plans-delivered"])}
	])
