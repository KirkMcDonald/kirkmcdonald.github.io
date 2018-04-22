"use strict"

function Item(name, col, row, phase, group, subgroup, order) {
    this.name = name
    this.icon_col = col
    this.icon_row = row
    this.recipes = []
    this.phase = phase
    this.group = group
    this.subgroup = subgroup
    this.order = order
}
Item.prototype = {
    constructor: Item,
    addRecipe: function(recipe) {
        this.recipes.push(recipe)
    },
    isWeird: function() {
        return this.recipes.length > 1 || this.recipes[0].products.length > 1
    },
    produce: function(rate, ignore, spec) {
        var totals = new Totals(rate, this)
        if (this.isWeird()) {
            totals.addUnfinished(this.name, rate)
            return totals
        }
        var recipe = this.recipes[0]
        var gives = recipe.gives(this, spec)
        rate = rate.div(gives)
        totals.add(recipe.name, rate)
        if (ignore[recipe.name]) {
            return totals
        }
        var ingredients = recipe.ingredients.concat(recipe.fuelIngredient(spec))
        for (var i=0; i < ingredients.length; i++) {
            var ing = ingredients[i]
            var subTotals = ing.item.produce(rate.mul(ing.amount), ignore, spec)
            totals.combine(subTotals)
        }
        return totals
    }
}

function getItem(data, items, name) {
    if (name in items) {
        return items[name]
    } else {
        var d = data.items[name]
        var phase
        if (d.type == "fluid") {
            phase = "fluid"
        } else {
            phase = "solid"
        }
        var item = new Item(
            name,
            d.icon_col,
            d.icon_row,
            phase,
            d.group,
            d.subgroup,
            d.order,
        )
        items[name] = item
        return item
    }
}

function getItems(data) {
    var items = {}
    var cycleName = "nuclear-reactor-cycle"
    var reactor = data.items["nuclear-reactor"]
    items[cycleName] = new Item(
        cycleName,
        reactor.icon_col,
        reactor.icon_row,
        "abstract",
        "production",
        "energy",
        "f[nuclear-energy]-d[reactor-cycle]",
    )
    return items
}
