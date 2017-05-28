"use strict"

function Ingredient(amount, item) {
    this.amount = amount
    this.item = item
}

function makeIngredient(i, items) {
    var amount
    if ("amount" in i) {
        amount = i.amount
    } else {
        amount = (i.amount_min + i.amount_max) / 2
    }
    amount *= i.probability || 1
    return new Ingredient(RationalFromFloat(amount), getItem(items, i.name))
}

function Recipe(name, category, time, ingredients, products) {
    this.name = name
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
            prod = factory.prodEffect()
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
    }
}

function makeRecipe(d, items) {
    var time = RationalFromFloat(d.energy)
    var products = []
    for (var i=0; i < d.products.length; i++) {
        products.push(makeIngredient(d.products[i], items))
    }
    var ingredients = []
    for (var i=0; i < d.ingredients.length; i++) {
        ingredients.push(makeIngredient(d.ingredients[i], items))
    }
    return new Recipe(d.name, d.category, time, ingredients, products)
}

function ResourceRecipe(item) {
    Recipe.call(this, item.name, null, zero, [], [new Ingredient(one, item)])
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
    Recipe.call(this, item.name, category, zero, ingredients, [new Ingredient(one, item)])
}
MiningRecipe.prototype = Object.create(Recipe.prototype)
MiningRecipe.prototype.makesResource = function() {
    return true
}

function ignoreRecipe(d) {
    return d.subgroup == "empty-barrel"
}

function getRecipeGraph(data) {
    var recipes = {}
    var items = getItems(data)

    for (var name in data.recipes) {
        var recipe = data.recipes[name]
        if (ignoreRecipe(recipe)) {
            continue
        }
        var r = makeRecipe(recipe, items)
        recipes[recipe.name] = r
    }
    for (var entityName in data.entities) {
        var entity = data.entities[entityName]
        var category = entity.resource_category
        if (!category) {
            continue
        }
        if (category == "basic-solid") {
            var name = entity.name
            var props = entity.mineable_properties
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
