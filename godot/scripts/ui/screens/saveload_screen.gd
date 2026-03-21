extends UIScreenBase

func _init() -> void:
	screen_title = "Save / Load"
	screen_subtitle = "Versioned save slots, restore prompts, and new-game flow."
	empty_message = "Save slots will appear once the persistence autoload is connected."

func _populate_body() -> void:
	var snapshot := get_state_snapshot()
	var commander := snapshot.get("commander", null)
	var universe := snapshot.get("universe", null)
	var save_states := StateBridge.read_value(snapshot, &"save_states", {})

	add_section_title("Current Run")
	add_detail_row("Commander", str(StateBridge.read_any(commander, ["name"], "Cmdr. Nova")))
	add_detail_row("System", str(StateBridge.read_any(commander, ["current_system", "currentSystem"], StateBridge.read_any(universe, ["current_system", "currentSystem"], "Lave"))))
	add_detail_row("Stardate", str(StateBridge.read_any(universe, ["stardate"], "-")))
	add_detail_row("Credits", _format_credits(StateBridge.read_any(commander, ["cash", "credits"], null)))

	add_spacer()
	add_section_title("Save Slots")
	for slot_id in [1, 2, 3]:
		var current_slot_id := int(slot_id)
		var slot := save_states.get(current_slot_id, {})
		add_detail_row("Slot %s" % str(current_slot_id), str(StateBridge.read_value(slot, &"saved_at", "Empty slot")))
		add_action_row([
			{"label": "Save", "callback": func() -> void: StateBridge.call_action(&"save_to_slot", [current_slot_id])},
			{"label": "Load", "callback": func() -> void: StateBridge.call_action(&"load_from_slot", [current_slot_id]), "disabled": slot.is_empty()}
		])

	add_spacer()
	add_section_title("Session Controls")
	add_action_row([
		{"label": "New Game", "callback": func() -> void: StateBridge.call_action(&"start_new_game")},
		{"label": "Add 100000 Cr", "callback": func() -> void: StateBridge.call_action(&"grant_debug_credits", [100000])}
	])
	add_action_row([
		{"label": "Instant Travel On", "callback": func() -> void: StateBridge.call_action(&"set_instant_travel_enabled", [true])},
		{"label": "Instant Travel Off", "callback": func() -> void: StateBridge.call_action(&"set_instant_travel_enabled", [false])}
	])
	add_bullet("Travel sessions remain transient and are not restored mid-flight in the planned save format.")
