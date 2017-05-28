local out = ""

function write(...)
    local arg = {...}
    for i, v in ipairs(arg) do
        out = out .. tostring(v)
    end
end

function item_count(node)
    local count = 0
    for k, v in pairs(node) do
        count = count + 1
    end
    return count
end

function traverse_table(node)
    write("{")
    local i = 1
    local count = item_count(node)
    for k, v in pairs(node) do
        write("\"", tostring(k), "\": ")
        traverse(v)
        if i < count then
            write(",")
        end
        i = i + 1
    end
    write("}")
end

function traverse_array(node)
    local count = item_count(node)
    write("[")
    for k, v in ipairs(node) do
        traverse(v)
        if k < count then
            write(",")
        end
    end
    write("]")
end

function traverse(node)
    if type(node) == "table" then
        if type(next(node)) == "number" then
            traverse_array(node)
        else
            traverse_table(node)
        end
    elseif type(node) == "string" then
        write("\"", node, "\"")
    else
        write(node)
    end
end

function inspect_recipe(node)
    return {
        name=node.name,
        category=node.category,
        products=node.products,
        ingredients=node.ingredients,
        hidden=node.hidden,
        energy=node.energy,
        order=node.order,
        group=node.group.name,
        subgroup=node.subgroup.name,
    }
end


function inspect_recipes(recipes)
    local r = {}
    for k, v in pairs(recipes) do
        r[k] = inspect_recipe(v)
    end
    return r
end

function inspect_entities(entities)
    local e = {}
    for k, v in pairs(entities) do
        if v.crafting_categories or v.mining_power or v.resource_category or v.burner_prototype then
            entity = {
                name=v.name,
                type=v.type,
                group=v.group.name,
                subgroup=v.subgroup.name,
                order=v.order,
                mineable_properties=v.mineable_properties,
                resource_category=v.resource_category,
                ingredient_count=v.ingredient_count,
                crafting_speed=v.crafting_speed,
                crafting_categories=v.crafting_categories,
                module_inventory_size=v.module_inventory_size,
                energy_usage=v.energy_usage,
                max_energy_usage=v.max_energy_usage,
                mining_speed=v.mining_speed,
                mining_power=v.mining_power,
                fluid_usage_per_tick=v.fluid_usage_per_tick,
            }
            if v.burner_prototype then
                b = v.burner_prototype
                entity.burner_prototype = {
                    category=b.category,
                    effectivity=b.effectivity,
                    fuel_category=b.fuel_category,
                    emissions=b.emissions,
                }
            end
            e[k] = entity
        end
    end
    return e
end

function inspect_items(items)
    local i = {}
    for k, v in pairs(items) do
        if v.fuel_category or v.module_effects then
            i[k] = {
                name=v.name,
                type=v.type,
                group=v.group.name,
                subgroup=v.subgroup.name,
                order=v.order,
                fuel_category=v.fuel_category,
                fuel_value=v.fuel_value,
                module_effects=v.module_effects,
                category=v.category,
                tier=v.tier,
                limitations=v.limitations,
            }
            if v.place_result then
                i[k].place_result = v.place_result.name
            end
        end
    end
    return i
end

function inspect_all()
    data = {
        recipes=inspect_recipes(game.recipe_prototypes),
        entities=inspect_entities(game.entity_prototypes),
        items=inspect_items(game.item_prototypes),
        versions=game.active_mods,
    }
    traverse(data)
end

inspect_all()

game.write_file("game_data.json", out)

