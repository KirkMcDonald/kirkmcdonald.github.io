function Recipe(name, time, inputs, outputs, factory) {
    this.name = name
    this.time = time
    this.inputs = inputs
    this.outputs = outputs
    this.factory = factory
}
Recipe.prototype = {
    constructor: Recipe,
    rate: function() {
        var moduleEffects = moduleSpec[this.name]
        var speed = 1
        if (moduleEffects) {
            var total = moduleEffects.total(this.factory)
            speed = total.speed
        }
        return 60.0 / this.time * this.factory.speed * speed
    },
    factories: function(target_rate) {
        var rate = this.rate()
        var real = target_rate / rate
        var factories = Math.floor(target_rate / rate)
        var fraction = target_rate % rate
        if (fraction > 0) {
            factories += 1
        }
        return [factories, real, this.factory]
    },
    gives: function(item) {
        for (var i in this.outputs) {
            var output = this.outputs[i]
            if (output.item == item) {
                var moduleEffects = moduleSpec[output.item.name]
                var productivity = 1
                if (moduleEffects) {
                    var total = moduleEffects.total(this.factory)
                    productivity = total.productivity
                }
                return output.amount * productivity
            }
        }
    }
}

function makeRecipe(d, items, minimumFactory) {
    var time = d.energy
    var outputs
    outputs = []
    for (var i in d.products) {
        var x = d.products[i]
        outputs.push(new Ingredient(x.amount, getItem(items, x.name)))
    }
    var inputs = []
    for (var i in d.ingredients) {
        inputs.push(makeIngredient(d.ingredients[i], items))
    }
    var factory = CATEGORY_SPEEDS[d["category"]]
    if (!factory) {
        if (inputs.length > 4 || minimumFactory == "3") {
            factory = ASSEMBLY_3
        } else if (inputs.length <= 2 && minimumFactory == "1") {
            factory = ASSEMBLY_1
        } else {
            factory = ASSEMBLY_2
        }
    }
    var r = new Recipe(d.name, time, inputs, outputs, factory)
    for (var i in r.outputs) {
        r.outputs[i].item.addRecipe(r)
    }
    return r
}

function getUnlockableRecipes(data) {
    var recipes = {}
    for (var name in data.technology) {
        var info = data.technology[name]
        for (var i in info.effects) {
            var effect = info.effects[i]
            if (effect.type == "unlock-recipe") {
                recipes[effect.recipe] = true
            }
        }
    }
    return recipes
}

function getRecipeGraph(data, minimumFactory) {
    var recipes = {}
    var items = getItems(data)

    for (var name in data.recipes) {
        var recipe = data.recipes[name]
        var r = makeRecipe(recipe, items, minimumFactory)
        recipes[recipe.name] = r
    }
    return [items, recipes]
}
