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
    local groups = {}
    for k, v in pairs(recipes) do
        groups[v.group.name] = v.group
        r[k] = inspect_recipe(v)
    end
    return r, groups
end

function inspect_entities(entities)
    local e = {}
    local groups = {}
    for k, v in pairs(entities) do
        groups[v.group.name] = v.group
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
    return e, groups
end

function inspect_items(items)
    local i = {}
    local groups = {}
    for k, v in pairs(items) do
        groups[v.group.name] = v.group
        i[k] = {
            name=v.name,
            type=v.type,
            group=v.group.name,
            subgroup=v.subgroup.name,
            order=v.order,
            fuel_category=v.fuel_category,
            module_effects=v.module_effects,
            category=v.category,
            tier=v.tier,
            limitations=v.limitations,
        }
        if v.fuel_value ~= 0 then
            i[k].fuel_value = v.fuel_value
        end
        if v.place_result then
            i[k].place_result = v.place_result.name
        end
    end
    return i, groups
end

function inspect_fluids(fluids)
    local f = {}
    local groups = {}
    for k, v in pairs(fluids) do
        groups[v.group.name] = v.group
        f[k] = {
            name=v.name,
            group=v.group.name,
            subgroup=v.subgroup.name,
            order=v.order,
            base_color=v.base_color,
            flow_color=v.flow_color,
        }
    end
    return f, groups
end

function inspect_groups(groups)
    local g = {}
    for k, v in pairs(groups) do
        local subgroups = {}
        for i, s in ipairs(v.subgroups) do
            subgroups[s.name] = s.order
        end
        g[k] = {
            name=v.name,
            order=v.order,
            subgroups=subgroups,
        }
    end
    return g
end

function update(a, b)
    for k, v in pairs(b) do
        a[k] = v
    end
end

function inspect_all()
    local groups = {}
    local recipes, g = inspect_recipes(game.recipe_prototypes)
    update(groups, g)
    local entities, g = inspect_entities(game.entity_prototypes)
    update(groups, g)
    local items, g = inspect_items(game.item_prototypes)
    update(groups, g)
    local fluids, g = inspect_fluids(game.fluid_prototypes)
    update(groups, g)
    local data = {
        versions=game.active_mods,
        recipes=recipes,
        entities=entities,
        items=items,
        fluids=fluids,
        groups=inspect_groups(groups),
    }
    traverse(data)
end

inspect_all()

game.write_file("game_data.json", out)

