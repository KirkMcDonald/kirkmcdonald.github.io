/*Copyright 2015-2019 Kirk McDonald

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.*/
"use strict"

function Ingredient(amount, item) {
    this.amount = amount
    this.item = item
}

function makeIngredient(data, i, items) {
    var name
    if ("name" in i) {
        name = i.name
    } else {
        name = i[0]
    }
    var amount
    if ("amount" in i) {
        amount = i.amount
    } else if ("amount_min" in i && "amount_max" in i) {
        amount = (i.amount_min + i.amount_max) / 2
    } else {
        amount = i[1]
    }
    amount *= i.probability || 1
    return new Ingredient(RationalFromFloat(amount), getItem(data, items, name))
}

function Recipe(name, col, row, category, time, ingredients, products) {
    this.name = name
    this.icon_col = col
    this.icon_row = row
    this.category = category
    this.time = time
    this.ingredients = ingredients
    for (var i = 0; i < ingredients.length; i++) {
        ingredients[i].item.addUse(this)
    }
    this.products = products
    for (var i = 0; i < products.length; i++) {
        products[i].item.addRecipe(this)
    }
    this.displayGroup = null
    this.solveGroup = null
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
    fuelIngredient: function(spec) {
        var factory = spec.getFactory(this)
        if (!factory || !factory.factory.fuel || factory.factory.fuel !== "chemical") {
            return []
        }
        var basePower = factory.powerUsage(spec, one).power
        var baseRate = factory.recipeRate(spec, this)
        var perItemEnergy = basePower.div(baseRate)
        var fuelAmount = perItemEnergy.div(preferredFuel.value)
        return [new Ingredient(fuelAmount, preferredFuel.item)]
    },
    getIngredients: function(spec) {
        return this.ingredients.concat(this.fuelIngredient(spec))
    },
    makesResource: function() {
        return false
    },
    allModules: function() {
        return false
    },
    canIgnore: function() {
        if (this.ingredients.length == 0) {
            return false
        }
        for (var i = 0; i < this.products.length; i++) {
            if (this.products[i].item.isWeird()) {
                return false
            }
        }
        return true
    },
    renderTooltip: function(extra) {
        var t = document.createElement("div")
        t.classList.add("frame")
        var title = document.createElement("h3")
        var im = getImage(this, true)
        title.appendChild(im)
        var name = formatName(this.name)
        if (this.products.length === 1 && this.products[0].item.name === this.name && one.less(this.products[0].amount)) {
            name = this.products[0].amount.toDecimal() + " \u00d7 " + name
        }
        title.appendChild(new Text("\u00A0" + name))
        t.appendChild(title)
        if (extra) {
            t.appendChild(extra)
        }
        if (this.ingredients.length === 0) {
            return t
        }
        if (this.products.length > 1 || this.products[0].item.name !== this.name) {
            t.appendChild(new Text("Products: "))
            for (var i = 0; i < this.products.length; i++) {
                var ing = this.products[i]
                var p = document.createElement("div")
                p.classList.add("product")
                p.appendChild(getImage(ing.item, true))
                var count = document.createElement("span")
                count.classList.add("count")
                count.textContent = ing.amount.toDecimal()
                p.appendChild(count)
                t.appendChild(p)
                t.appendChild(new Text("\u00A0"))
            }
            t.appendChild(document.createElement("br"))
        }
        var time = document.createElement("div")
        time.classList.add("product")
        time.appendChild(getExtraImage("clock"))
        t.appendChild(time)
        t.appendChild(new Text("\u00A0" + this.time.toDecimal()))
        for (var i = 0; i < this.ingredients.length; i++) {
            var ing = this.ingredients[i]
            t.appendChild(document.createElement("br"))
            var p = document.createElement("div")
            p.classList.add("product")
            p.appendChild(getImage(ing.item, true))
            t.appendChild(p)
            t.appendChild(new Text("\u00A0" + ing.amount.toDecimal() + " \u00d7 " + formatName(ing.item.name)))
        }
        return t
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

function MiningRecipe(name, col, row, category, hardness, mining_time, ingredients, products) {
    this.hardness = hardness
    this.mining_time = mining_time
    if (!ingredients) {
        ingredients = []
    }
    Recipe.call(this, name, col, row, category, zero, ingredients, products)
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
        "rocket-launch",
        one,
        [
            new Ingredient(RationalFromFloat(100), getItem(data, items, "rocket-part")),
            new Ingredient(one, getItem(data, items, "satellite"))
        ], [new Ingredient(RationalFromFloat(1000), getItem(data, items, "space-science-pack"))]
    )
    var steam = data.items["steam"]
    recipes["steam"] = new Recipe(
        "steam",
        steam.icon_col,
        steam.icon_row,
        "boiler",
        RationalFromFloats(1, 60),
        [new Ingredient(one, getItem(data, items, "water"))],
        [new Ingredient(one, getItem(data, items, "steam"))]
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
        var ingredients = null
        if ("required_fluid" in props) {
            ingredients = [new Ingredient(
                RationalFromFloat(props.fluid_amount / 10),
                items[props.required_fluid]
            )]
        }
        var products = []
        for (var i = 0; i < props.results.length; i++) {
            products.push(makeIngredient(data, props.results[i], items))
        }
        var hardness
        if (props.hardness) {
            hardness = RationalFromFloat(props.hardness)
        } else {
            hardness = null
        }
        recipes[name] = new MiningRecipe(
            name,
            entity.icon_col,
            entity.icon_row,
            "mining-" + category,
            hardness,
            RationalFromFloat(props.mining_time),
            ingredients,
            products
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
