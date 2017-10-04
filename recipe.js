"use strict"

function Ingredient(amount, item) {
    this.amount = amount
    this.item = item
}

function makeIngredient(data, i, items) {
    var amount
    if ("amount" in i) {
        amount = i.amount
    } else {
        amount = (i.amount_min + i.amount_max) / 2
    }
    amount *= i.probability || 1
    return new Ingredient(RationalFromFloat(amount), getItem(data, items, i.name))
}

function Recipe(name, col, row, category, time, ingredients, products) {
    this.name = name
    this.icon_col = col
    this.icon_row = row
    this.category = category
    this.time = time
    this.ingredients = ingredients
    this.products = products
    for (var i = 0; i < products.length; i++) {
        products[i].item.addRecipe(this)
    }
}
Recipe.prototype = {
    constructor: Recipe,
    gives: function(item, spec) {
        var factory = spec.getFactory(this)
        var prod = one
        if (factory) {
            prod = factory.prodEffect(spec)
        }
        for (var i=0; i < this.products.length; i++) {
            var product = this.products[i]
            if (product.item.name == item.name) {
                return product.amount.mul(prod)
            }
        }
    },
    makesResource: function() {
        return false
    },
    allModules: function() {
        return false
    }
}

function makeRecipe(data, d, items) {
    var time = RationalFromFloat(d.energy_required)
    var products = []
    for (var i=0; i < d.results.length; i++) {
        products.push(makeIngredient(data, d.results[i], items))
    }
    var ingredients = []
    for (var i=0; i < d.ingredients.length; i++) {
        ingredients.push(makeIngredient(data, d.ingredients[i], items))
    }
    return new Recipe(d.name, d.icon_col, d.icon_row, d.category, time, ingredients, products)
}

function ResourceRecipe(item) {
    Recipe.call(this, item.name, item.icon_col, item.icon_row, null, zero, [], [new Ingredient(one, item)])
}
ResourceRecipe.prototype = Object.create(Recipe.prototype)
ResourceRecipe.prototype.makesResource = function() {
    return true
}

function MiningRecipe(item, category, hardness, mining_time, ingredients) {
    this.hardness = hardness
    this.mining_time = mining_time
    if (!ingredients) {
        ingredients = []
    }
    Recipe.call(this, item.name, item.icon_col, item.icon_row, category, zero, ingredients, [new Ingredient(one, item)])
}
MiningRecipe.prototype = Object.create(Recipe.prototype)
MiningRecipe.prototype.makesResource = function() {
    return true
}
MiningRecipe.prototype.allModules = function() {
    return true
}

function ignoreRecipe(d) {
    return d.subgroup == "empty-barrel"
}

function getRecipeGraph(data) {
    var recipes = {}
    var items = getItems(data)
    var water = getItem(data, items, "water")
    recipes["water"] = new Recipe(
        "water",
        water.icon_col,
        water.icon_row,
        "water",
        RationalFromFloats(1, 1200),
        [],
        [new Ingredient(one, water)]
    )
    var reactor = data.items["nuclear-reactor"]
    recipes["nuclear-reactor-cycle"] = new Recipe(
        "nuclear-reactor-cycle",
        reactor.icon_col,
        reactor.icon_row,
        "nuclear",
        RationalFromFloat(200),
        [new Ingredient(one, getItem(data, items, "uranium-fuel-cell"))],
        [
            new Ingredient(one, getItem(data, items, "used-up-uranium-fuel-cell")),
            new Ingredient(one, items["nuclear-reactor-cycle"]),
        ]
    )
    var rocket = data.items["rocket-silo"]
    recipes["rocket-launch"] = new Recipe(
        "rocket-launch",
        rocket.icon_col,
        rocket.icon_row,
        "rocket-building",
        one,
        [
            new Ingredient(RationalFromFloat(100), getItem(data, items, "rocket-part")),
            new Ingredient(one, getItem(data, items, "satellite"))
        ], [new Ingredient(RationalFromFloat(1000), getItem(data, items, "space-science-pack"))]
    )

    for (var name in data.recipes) {
        var recipe = data.recipes[name]
        if (ignoreRecipe(recipe)) {
            continue
        }
        var r = makeRecipe(data, recipe, items)
        recipes[recipe.name] = r
    }
    for (var entityName in data.resource) {
        var entity = data.resource[entityName]
        var category = entity.category
        if (!category) {
            category = "basic-solid"
        }
        if (category != "basic-solid") {
            continue
        }
        var name = entity.name
        var props = entity.minable
        var item = items[name]
        var ingredients = null
        if ("required_fluid" in props) {
            ingredients = [new Ingredient(
                RationalFromFloat(props.fluid_amount / 10),
                items[props.required_fluid]
            )]
        }
        recipes[name] = new MiningRecipe(
            item,
            "mining-" + category,
            RationalFromFloat(props.hardness),
            RationalFromFloat(props.mining_time),
            ingredients
        )
    }
    for (var itemName in items) {
        var item = items[itemName]
        if (item.recipes.length == 0) {
            var r = new ResourceRecipe(item)
            recipes[r.name] = r
        }
    }
    return [items, recipes]
}
