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

function makeRecipe(d, items, useFastest) {
    var time = d.energy_required || 0.5
    var outputs
    if ("result" in d) {
        outputs = [Ingredient(d.result_count || 1, items[d.result])]
    } else {
        outputs = []
        for (var i in d.results) {
            var x = d.results[i]
            outputs.push(Ingredient(x.amount, items[x.name]))
        }
    }
    var inputs = []
    for (var i in d.ingredients) {
        inputs.push(makeIngredient(d.ingredients[i], items))
    }
    var factory = CATEGORY_SPEEDS[d["category"]]
    if (!factory) {
        if (useFastest) {
            factory = ASSEMBLY_3
        } else if (inputs.length <= 2) {
            factory = ASSEMBLY_1
        } else {
            factory = ASSEMBLY_2
        }
    }
    return new Recipe(d.name, time, inputs, outputs, factory)
}

function getUnlockableRecipes(data) {
    var recipes = {}
    for (var name in data.raw.technology) {
        var info = data.raw.technology[name]
        for (var i in info.effects) {
            var effect = info.effects[i]
            if (effect.type == "unlock-recipe") {
                recipes[effect.recipe] = true
            }
        }
    }
    return recipes
}

function getRecipeGraph(data, useFastest) {
    var unlockable = getUnlockableRecipes(data)
    var recipes = {}
    var items = getItems(data)

    for (var name in data.raw.recipe) {
        var recipe = data.raw.recipe[name]
        if (recipe.enabled != "false" || recipe.name in unlockable) {
            var r = makeRecipe(recipe, items, useFastest)
            recipes[recipe.name] = r
            for (var i in r.outputs) {
                r.outputs[i].item.addRecipe(r)
            }
        }
    }
    return [items, recipes]
}
