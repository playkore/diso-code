extends RefCounted

## Local market generation and per-visit quantity overlays.

const COMMODITIES := [
	{"key": "food", "name": "Food", "base_price": 0x13, "gradient": -0x02, "base_quantity": 0x06, "mask": 0x01, "unit": "t"},
	{"key": "textiles", "name": "Textiles", "base_price": 0x14, "gradient": -0x01, "base_quantity": 0x0A, "mask": 0x03, "unit": "t"},
	{"key": "radioactives", "name": "Radioactives", "base_price": 0x41, "gradient": -0x03, "base_quantity": 0x02, "mask": 0x07, "unit": "t"},
	{"key": "slaves", "name": "Slaves", "base_price": 0x28, "gradient": -0x05, "base_quantity": 0xE2, "mask": 0x1F, "unit": "t"},
	{"key": "liquorWines", "name": "Liquor/Wines", "base_price": 0x53, "gradient": -0x05, "base_quantity": 0xFB, "mask": 0x0F, "unit": "t"},
	{"key": "luxuries", "name": "Luxuries", "base_price": 0xC4, "gradient": 0x08, "base_quantity": 0x36, "mask": 0x03, "unit": "t"},
	{"key": "narcotics", "name": "Narcotics", "base_price": 0xEB, "gradient": 0x1D, "base_quantity": 0x08, "mask": 0x78, "unit": "t"},
	{"key": "computers", "name": "Computers", "base_price": 0x9A, "gradient": 0x0E, "base_quantity": 0x38, "mask": 0x03, "unit": "t"},
	{"key": "machinery", "name": "Machinery", "base_price": 0x75, "gradient": 0x06, "base_quantity": 0x28, "mask": 0x07, "unit": "t"},
	{"key": "alloys", "name": "Alloys", "base_price": 0x4E, "gradient": 0x01, "base_quantity": 0x11, "mask": 0x1F, "unit": "t"},
	{"key": "firearms", "name": "Firearms", "base_price": 0x7C, "gradient": 0x0D, "base_quantity": 0x1D, "mask": 0x07, "unit": "t"},
	{"key": "furs", "name": "Furs", "base_price": 0xB0, "gradient": -0x09, "base_quantity": 0xDC, "mask": 0x3F, "unit": "t"},
	{"key": "minerals", "name": "Minerals", "base_price": 0x20, "gradient": -0x01, "base_quantity": 0x35, "mask": 0x03, "unit": "t"},
	{"key": "gold", "name": "Gold", "base_price": 0x61, "gradient": -0x01, "base_quantity": 0x42, "mask": 0x07, "unit": "kg"},
	{"key": "platinum", "name": "Platinum", "base_price": 0xAB, "gradient": -0x02, "base_quantity": 0x37, "mask": 0x1F, "unit": "kg"},
	{"key": "gemStones", "name": "Gem-Stones", "base_price": 0x2D, "gradient": -0x01, "base_quantity": 0xFA, "mask": 0x0F, "unit": "g"},
	{"key": "alienItems", "name": "Alien Items", "base_price": 0x35, "gradient": 0x0F, "base_quantity": 0xC0, "mask": 0x07, "unit": "t"}
]

static func _wrap8(value: int) -> int:
	return value & 0xFF

static func generate_market(system_economy: int, fluct_byte: int) -> Array:
	var economy: int = system_economy & 0xFF
	var fluct: int = fluct_byte & 0xFF
	var output: Array = []
	for commodity_variant in COMMODITIES:
		var commodity: Dictionary = commodity_variant
		var changing: int = fluct & int(commodity.get("mask", 0))
		var product: int = economy * int(commodity.get("gradient", 0))
		var quantity_raw: int = _wrap8(int(commodity.get("base_quantity", 0)) + changing - product)
		var quantity: int = 0 if quantity_raw > 0x7F else (quantity_raw & 0x3F)
		var price_raw: int = _wrap8(int(commodity.get("base_price", 0)) + changing + product)
		var price: int = price_raw * 4
		var item: Dictionary = commodity.duplicate(true)
		item["quantity"] = quantity
		item["price"] = price
		output.append(item)
	return output

static func create_docked_market_session(system_name: String, economy: int, fluctuation: int) -> Dictionary:
	var baseline: Array = generate_market(economy, fluctuation)
	var local_quantities: Dictionary = {}
	for item_variant in baseline:
		var item: Dictionary = item_variant
		local_quantities[item.get("key", "")] = item.get("quantity", 0)
	return {
		"system_name": system_name,
		"economy": economy,
		"fluctuation": fluctuation,
		"baseline": baseline,
		"local_quantities": local_quantities
	}

static func get_session_market_items(session: Dictionary) -> Array:
	var items: Array = []
	for item_variant in session.get("baseline", []):
		var item: Dictionary = item_variant
		var next_item: Dictionary = item.duplicate(true)
		next_item["quantity"] = int(session.get("local_quantities", {}).get(item.get("key", ""), item.get("quantity", 0)))
		items.append(next_item)
	return items

static func apply_local_market_trade(session: Dictionary, commodity_key: String, delta_quantity: int) -> Dictionary:
	var next_session: Dictionary = session.duplicate(true)
	var quantities: Dictionary = next_session.get("local_quantities", {}).duplicate(true)
	var current: int = int(quantities.get(commodity_key, 0))
	quantities[commodity_key] = maxi(0, current + delta_quantity)
	next_session["local_quantities"] = quantities
	return next_session
