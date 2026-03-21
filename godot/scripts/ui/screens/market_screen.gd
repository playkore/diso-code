extends UIScreenBase

const MARKET_CATEGORIES := [
	{"label": "Essentials", "commodity_keys": ["food", "textiles", "radioactives", "liquorWines", "minerals"]},
	{"label": "Industry", "commodity_keys": ["slaves", "computers", "machinery", "alloys", "firearms"]},
	{"label": "Luxury", "commodity_keys": ["luxuries", "narcotics", "furs", "alienItems"]},
	{"label": "Bullion", "commodity_keys": ["gold", "platinum", "gemStones"]}
]

func _init() -> void:
	screen_title = "Market"
	screen_subtitle = "Docked commodity exchange and local trade snapshot."
	empty_message = "The market will populate from GameState.market once the docked autoload exists."

func _populate_body() -> void:
	var snapshot: Dictionary = get_state_snapshot()
	var universe: Variant = snapshot.get("universe", null)
	var commander: Variant = snapshot.get("commander", null)
	var market: Variant = snapshot.get("market", null)

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
	var items: Variant = StateBridge.read_value(market, &"items", [])
	if items is Array and not items.is_empty():
		var item_map: Dictionary = {}
		for item_variant in items:
			var item: Dictionary = item_variant
			item_map[str(item.get("key", ""))] = item

		for category_variant in MARKET_CATEGORIES:
			var category: Dictionary = category_variant
			add_section_title(str(category.get("label", "Commodities")))
			for key_variant in category.get("commodity_keys", []):
				var commodity_key: String = str(key_variant)
				if not item_map.has(commodity_key):
					continue
				var item: Dictionary = item_map[commodity_key]
				var owned: int = int(StateBridge.read_value(commander, &"cargo", {}).get(commodity_key, 0))
				var free_cargo: int = max(0, int(StateBridge.read_any(commander, ["cargo_capacity", "cargoCapacity"], 0)) - get_cargo_used_tonnes(StateBridge.read_value(commander, &"cargo", {})))
				var market_quantity: int = int(item.get("quantity", 0))
				var price: int = int(item.get("price", 0))
				var unit: String = str(item.get("unit", "t"))
				var cash: int = int(StateBridge.read_any(commander, ["cash", "credits"], 0))
				var max_affordable: int = 0 if price <= 0 else int(cash / price)
				var max_cargo_units: int = free_cargo if unit == "t" else market_quantity
				var buy_max_units: int = min(market_quantity, max_affordable, max_cargo_units)
				add_detail_row(str(item.get("name", "Commodity")), "%d %s market | %d owned | %d Cr" % [market_quantity, unit, owned, price])
				add_action_row([
					{"label": "Buy 1", "callback": func() -> void: StateBridge.call_action(&"buy_commodity", [commodity_key, 1]), "disabled": buy_max_units < 1},
					{"label": "Buy Max", "callback": func() -> void: StateBridge.call_action(&"buy_commodity", [commodity_key, buy_max_units]), "disabled": buy_max_units < 1},
					{"label": "Sell 1", "callback": func() -> void: StateBridge.call_action(&"sell_commodity", [commodity_key, 1]), "disabled": owned < 1},
					{"label": "Sell All", "callback": func() -> void: StateBridge.call_action(&"sell_commodity", [commodity_key, owned]), "disabled": owned < 1}
				])
			add_spacer(12)
	else:
		add_notice("Commodity rows will appear once the market autoload mirrors the web app's docked session model.")
