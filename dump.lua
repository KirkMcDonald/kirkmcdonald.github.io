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
        if v.resource_category then
            e[k] = {
                name=v.name,
                type=v.type,
                mineable_properties=v.mineable_properties,
                resource_category=v.resource_category,
            }
        end
    end
    return e
end

function inspect_items(items)
    local i = {}
    for k, v in pairs(items) do
        if v.module_effects then
            i[k] = {
                name=v.name,
                type=v.type,
                module_effects=v.module_effects,
                category=v.category,
                tier=v.tier,
                limitations=v.limitations,
            }
        end
    end
    return i
end

function inspect_all()
    data = {
        recipes=inspect_recipes(game.player.force.recipes),
        resources=inspect_entities(game.entity_prototypes),
        modules=inspect_items(game.item_prototypes),
        versions=game.active_mods,
    }
    traverse(data)
end

inspect_all()

game.write_file("game_data.json", out)

