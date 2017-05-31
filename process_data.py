from PIL import Image

import argparse
import json
import math
import os
import sys

def get_icon_path(game_dir, name):
    odd_names = {
        "locomotive": "diesel-locomotive",
        "heat-exchanger": "heat-boiler",
        "low-density-structure": "rocket-structure",
        "discharge-defense-remote": "discharge-defense-equipment-ability",
        "railgun-dart": "railgun-ammo",
        "electric-energy-interface": "accumulator",
        "raw-fish": "fish",
    }
    directories = [
        "base/graphics/icons/icons-new",
        "base/graphics/icons/fluid",
        "base/graphics/icons",
        "base/graphics/icons/fluid/barreling",
        "base/graphics/equipment",
        "base/graphics/item-group",
        "core/graphics",
    ]
    name = odd_names.get(name, name)
    base_dir = os.path.join(game_dir, "data")
    for subdir in directories:
        path = os.path.join(base_dir, subdir, name + ".png")
        if os.path.exists(path):
            return path
    else:
        print(name)

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--game_dir", default=r"F:\Games\Steam\steamapps\common\Factorio")
    parser.add_argument("--sheet_name", default="images/sprite-sheet.png")
    parser.add_argument("--datafile", default=os.path.join(os.environ["APPDATA"], "Factorio", "script-output", "game_data.json"))
    parser.add_argument("--outfile", default="data/vanilla.json")
    parser.add_argument("--write_sprites", action="store_true")
    args = parser.parse_args()
    with open(args.datafile) as f:
        data = json.load(f)
    #for item in data["items"].values():
    icons = {}
    for name, recipe in data["recipes"].items():
        if recipe["subgroup"] in {"empty-barrel", "fill-barrel"}:
            continue
        icons[name] = get_icon_path(args.game_dir, name)
        for ing in recipe["products"] + recipe["ingredients"]:
            icons[ing["name"]] = get_icon_path(args.game_dir, ing["name"])
    for name, item in data["items"].items():
        icons[name] = get_icon_path(args.game_dir, name)
    for name, entity in data["entities"].items():
        icons[name] = get_icon_path(args.game_dir, name)
    extra_icons = ["bonus-icon", "add-icon", "shoot", "slot-icon-module"]
    for name in extra_icons:
        icons[name] = get_icon_path(args.game_dir, name)

    #group_name_map = {
    #    "combat": "military",
    #    "enemies": "military",
    #}
    #big_icons = {}
    #for name, group in data["groups"]:

    icons = sorted((name, path) for name, path in icons.items() if path)
    im_width = int(math.sqrt(len(icons)))
    if args.write_sprites:
        im_height = (len(icons) // im_width) + (1 if len(icons) % im_width else 0)
        px_width, px_height = (32, 32)
        sheet = Image.new("RGBA", (im_width * px_width, im_height * px_height))
        for i, (name, path) in enumerate(icons):
            im = Image.open(path)
            if im.size != (px_width, px_height):
                im = im.crop((0, 0, px_width, px_height))
            assert im.size == (px_width, px_height)
            row, col = divmod(i, im_width)
            sheet.paste(im, (col * px_width, row * px_height))
        sheet.save(args.sheet_name)
    data["sprites"] = {
        "names": [name for name, path in icons],
        "width": im_width,
    }
    with open(args.outfile, "w", newline="\n") as f:
        json.dump(data, f, indent=4, sort_keys=True)

if __name__ == "__main__":
    main()
