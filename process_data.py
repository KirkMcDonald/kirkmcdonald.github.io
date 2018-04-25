from PIL import Image

import argparse
import hashlib
import json
import math
import os
import re
import sys
import zipfile

# These paths don't appear in the datafiles in the usual fashion.
unique_paths = {
    "__base__/graphics/icons/coal.png": "__base__/graphics/icons/icons-new/coal.png",
    "__base__/graphics/icons/copper-ore.png": "__base__/graphics/icons/icons-new/copper-ore.png",
    "__base__/graphics/icons/iron-ore.png": "__base__/graphics/icons/icons-new/iron-ore.png",
    "__base__/graphics/icons/stone.png": "__base__/graphics/icons/icons-new/stone.png",
    "__base__/graphics/icons/uranium-ore.png": "__base__/graphics/icons/icons-new/uranium-ore.png",
}

missing_icon = "__core__/graphics/too-far.png"

def get_icon(data, path):
    path = unique_paths.get(path, path)
    m = re.search("__(\w+)__/(.*)", path)
    mod_name = m.group(1)
    icon_path = m.group(2)
    mod = data["module_info"][mod_name]
    if "localPath" in mod:
        return Image.open(os.path.join(mod["localPath"], icon_path))
    else:
        with zipfile.ZipFile(mod["zip_path"]) as archive:
            with archive.open(mod["mod_name"] + "/" + icon_path) as f:
                im = Image.open(f)
                im.load()
                return im

def normalize_recipe(r):
    if "result" in r:
        r["results"] = [{
            "name": r.pop("result"),
            "amount": r.pop("result_count", 1),
        }]
    if "energy_required" not in r:
        r["energy_required"] = 0.5
    if "category" not in r:
        r["category"] = "crafting"
    if any(type(ing) == list for ing in r["ingredients"]):
        ings = []
        for ing in r["ingredients"]:
            if type(ing) == list:
                ings.append({"name": ing[0], "amount": ing[1]})
            else:
                ings.append(ing)
        r["ingredients"] = ings

conversion_factor = {
    "": 1,
    "k": 1000,
    "M": 1000000,
    "G": 1000000000,
}

def convert_power(s):
    m = re.match(r"([^a-zA-Z]+)([a-zA-Z]?)[WJ]", s)
    factor = conversion_factor[m.group(2)]
    return float(m.group(1)) * factor

def convert(d, attr):
    d[attr] = convert_power(d[attr])

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--sheet_prefix", default="images/sprite-sheet")
    parser.add_argument("--datafile", default=r"C:\Users\Kirk\Projects\FactorioLoaderLib\stuff.json")
    parser.add_argument("--outfile_prefix", default="data/vanilla")
    parser.add_argument("--write_sprites", action="store_true")
    args = parser.parse_args()
    with open(args.datafile) as f:
        data = json.load(f)
    item_types = ["ammo", "armor", "blueprint", "blueprint-book", "capsule", "deconstruction-item", "fluid", "gun", "item", "item-with-entity-data", "mining-tool", "module", "rail-planner", "repair-tool", "tool"]
    no_module_icon = data["utility-sprites"]["default"]["slot_icon_module"]["filename"]
    clock_icon = data["utility-sprites"]["default"]["clock"]["filename"]
    icon_paths = {no_module_icon, clock_icon}
    # Normalize items
    item_groups = {d["name"]: {"order": d["order"], "subgroups": {}} for d in data["item-group"].values()}
    item_subgroups = data["item-subgroup"]
    for name, d in item_subgroups.items():
        item_groups[d["group"]]["subgroups"][name] = d["order"]
    items = {}
    fuel = []
    item_attrs = {"category", "effect", "fuel_category", "fuel_value", "icon", "limitation", "name", "order", "subgroup", "type"}
    for item_type in item_types:
        for name, item in data[item_type].items():
            item = {attr: value for attr, value in item.items() if attr in item_attrs}
            if "subgroup" in item:
                subgroup = item["subgroup"]
            else:
                item["subgroup"] = subgroup = "other"
            if subgroup in ("fill-barrel", "bob-gas-bottle"):
                continue
            item["group"] = item_subgroups[subgroup]["group"]
            if "icon" not in item:
                print("missing icon:", name)
                continue
                #item["icon"] = missing_icon
            icon_paths.add(item["icon"])
            if "fuel_value" in item:
                convert(item, "fuel_value")
                if item["fuel_category"] == "chemical":
                    fuel.append(name)
            items[name] = item
    new_data = {
        "items": items,
        "fluids": sorted(data["fluid"]),
        "fuel": sorted(fuel),
        "modules": sorted(data["module"]),
        "groups": item_groups,
    }
    # Normalize recipes
    inherited_attrs = ["subgroup", "order", "icon"]
    normal_recipes = {}
    expensive_recipes = {}
    for name, recipe in data["recipe"].items():
        for attr in inherited_attrs:
            if attr not in recipe:
                if name not in items:
                    continue
                recipe[attr] = items[name][attr]
        if any(attr not in recipe for attr in inherited_attrs):
            continue
        if recipe["subgroup"] in {"empty-barrel", "fill-barrel"}:
            continue
        icon_paths.add(recipe["icon"])
        if "expensive" in recipe:
            normal = recipe.copy()
            del normal["expensive"]
            del normal["normal"]
            expensive = normal.copy()
            normal.update(recipe["normal"])
            normalize_recipe(normal)
            normal_recipes[name] = normal
            expensive.update(recipe["expensive"])
            normalize_recipe(expensive)
            expensive_recipes[name] = expensive
        else:
            normalize_recipe(recipe)
            normal_recipes[name] = recipe
            expensive_recipes[name] = recipe
    # Normalize entities
    entity_attrs = {
        "accumulator": ["energy_source"],
        "assembling-machine": ["allowed_effects", "crafting_categories", "crafting_speed", "energy_usage", "ingredient_count", "module_specification"],
        "boiler": ["energy_consumption", "energy_source"],
        "furnace": ["allowed_effects", "crafting_categories", "crafting_speed", "energy_source", "energy_usage", "module_specification"],
        "generator": ["effectivity", "fluid_usage_per_tick"],
        "mining-drill": ["energy_source", "energy_usage", "mining_power", "mining_speed", "module_specification", "resource_categories"],
        "offshore-pump": ["fluid", "pumping_speed"],
        "reactor": ["burner", "consumption"],
        "resource": ["category", "minable"],
        "rocket-silo": ["active_energy_usage", "allowed_effects", "crafting_categories", "crafting_speed", "energy_usage", "idle_energy_usage", "lamp_energy_usage", "module_specification", "rocket_parts_required"],
        "solar-panel": ["production"],
    }
    common_attrs = ["name", "icon"]
    for entity_type, attrs in entity_attrs.items():
        entities = new_data.setdefault(entity_type, {})
        for name, entity in data[entity_type].items():
            if "icon" not in entity:
                print("entity missing icon:", name)
                entity["icon"] = missing_icon
            icon_paths.add(entity["icon"])
            new_entity = {attr: entity[attr] for attr in attrs + common_attrs if attr in entity}
            if "module_specification" in new_entity:
                new_entity["module_slots"] = new_entity["module_specification"]["module_slots"]
                del new_entity["module_specification"]
            elif "module_specification" in attrs:
                new_entity["module_slots"] = 0
            if "energy_usage" in new_entity:
                convert(new_entity, "energy_usage")
            if "minable" in new_entity:
                m = new_entity["minable"]
                if "result" in m:
                    m["results"] = [{
                        "name": m.pop("result"),
                        "amount": 1,
                    }]
            entities[name] = new_entity
        new_data[entity_type] = entities

    icon_map = {}
    icons = sorted(icon_paths, key=lambda p: (os.path.splitext(os.path.basename(p))[0], p))
    im_width = int(math.sqrt(len(icons)))
    im_height = (len(icons) // im_width) + (1 if len(icons) % im_width else 0)
    px_width, px_height = (32, 32)
    sheet = Image.new("RGBA", (im_width * px_width, im_height * px_height))
    for i, path in enumerate(icons):
        im = get_icon(data, path)
        if im.size != (px_width, px_height):
            im = im.crop((0, 0, px_width, px_height))
        assert im.size == (px_width, px_height)
        row, col = divmod(i, im_width)
        sheet.paste(im, (col * px_width, row * px_height))
        icon_map[path] = (col, row)
    temp_name = args.sheet_prefix + "-tmp.png"
    sheet.save(temp_name)
    h = hashlib.md5()
    with open(temp_name, "rb") as f:
        for block in iter(lambda: f.read(4096), b""):
            h.update(block)
    sprite_hash = h.hexdigest()
    if args.write_sprites:
        im_name = args.sheet_prefix + "-" + sprite_hash + ".png"
        os.replace(temp_name, im_name)
    else:
        os.remove(temp_name)
    mod_col, mod_row = icon_map[no_module_icon]
    clock_col, clock_row = icon_map[clock_icon]
    new_data["sprites"] = {
        "hash": sprite_hash,
        "extra": {
            "slot_icon_module": {
                "name": "no module",
                "icon_col": mod_col,
                "icon_row": mod_row,
            },
            "clock": {
                "name": "time",
                "icon_col": clock_col,
                "icon_row": clock_row,
            },
        },
    }
    version = data["module_info"]["core"]["version"]
    recipe_pairs = [
        ("", normal_recipes),
        ("-expensive", expensive_recipes),
    ]
    icon_sources = ["items"] + list(entity_attrs)
    for group in [new_data[s] for s in icon_sources] + [normal_recipes, expensive_recipes]:
        for d in group.values():
            if "icon" not in d:
                continue
            col, row = icon_map[d.pop("icon")]
            d["icon_col"] = col
            d["icon_row"] = row
    for file_suffix, recipes in recipe_pairs:
        new_data["recipes"] = recipes
        filename = "{}-{}{}.json".format(args.outfile_prefix, version, file_suffix)
        with open(filename, "w", newline="\n") as f:
            json.dump(new_data, f, indent=4, sort_keys=True)

if __name__ == "__main__":
    main()
