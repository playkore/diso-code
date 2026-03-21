extends UIScreenBase

func _init() -> void:
	screen_title = "Market"
	screen_subtitle = "Docked commodity exchange and local trade snapshot."
	empty_message = "The market will populate from GameState.market once the docked autoload exists."

func _populate_body() -> void:
	var snapshot := get_state_snapshot()
	var universe := snapshot.get("universe", null)
	var commander := snapshot.get("commander", null)
	var market := snapshot.get("market", null)

	add_section_title("Docked Summary")
	add_detail_row("System", str(StateBridge.read_any(universe, ["current_system", "currentSystem"], "Unknown")))
	add_detail_row("Economy", str(StateBridge.read_any(universe, ["economy"], "Unknown")))
	add_detail_row("Fluctuation", str(StateBridge.read_any(universe, ["market_fluctuation", "marketFluctuation"], "Unknown")))
	add_detail_row("Credits", _format_credits(StateBridge.read_any(commander, ["cash", "credits"], null)))
	add_detail_row("Cargo", "%s / %s t" % [
		str(get_cargo_used_tonnes(StateBridge.read_value(commander, &"cargo", {}))),
		str(StateBridge.read_any(commander, ["cargo_capacity", "cargoCapacity"], "-"))
	])

	add_spacer()
	add_section_title("Commodity Rows")
	var items := StateBridge.read_value(market, &"items", [])
	if items is Array and not items.is_empty():
		for item in items:
			var name := str(StateBridge.read_value(item, &"name", "Commodity"))
			var commodity_key := str(StateBridge.read_value(item, &"key", ""))
			var quantity := StateBridge.read_value(item, &"quantity", "-")
			var price := StateBridge.read_value(item, &"price", "-")
			var unit := str(StateBridge.read_value(item, &"unit", "t"))
			add_detail_row(name, "%s %s @ %s Cr" % [str(quantity), unit, str(price)])
			add_action_row([
				{"label": "Buy 1", "callback": func() -> void: StateBridge.call_action(&"buy_commodity", [commodity_key, 1])},
				{"label": "Sell 1", "callback": func() -> void: StateBridge.call_action(&"sell_commodity", [commodity_key, 1])}
			])
	else:
		add_notice("Commodity rows will appear once the market autoload mirrors the web app's docked session model.")
