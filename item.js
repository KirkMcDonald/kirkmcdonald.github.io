"use strict"

function Item(data, name) {
    this.name = name
    this.recipes = []
    var d = data.items[this.name]
    if (!d) {
        d = data.fluids[this.name]
    }
    if (d) {
        this.group = d.group
        this.subgroup = d.subgroup
        this.order = d.order
    }
}
Item.prototype = {
    constructor: Item,
    addRecipe: function(recipe) {
        this.recipes.push(recipe)
    },
    isResource: function() {
        return this.recipes.length == 0 // XXX or any recipe makes a resource
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
        for (var i=0; i < recipe.ingredients.length; i++) {
            var ing = recipe.ingredients[i]
            var subTotals = ing.item.produce(rate.mul(ing.amount), ignore, spec)
            totals.combine(subTotals)
        }
        return totals
    }
}

function Resource(data, name) {
    Item.call(this, data, name)
}
Resource.prototype = Object.create(Item.prototype)
Resource.prototype.isResource = function() {
    return true
}

function getItem(data, items, name) {
    if (name in items) {
        return items[name]
    } else {
        var item = new Item(data, name)
        items[name] = item
        return item
    }
}

function getItems(data) {
    var items = {"water": new Resource(data, "water")}
    var cycleName = "nuclear-reactor-cycle"
    var cycle = new Item(data, cycleName)
    cycle.group = "production"
    cycle.subgroup = "energy"
    cycle.order = "f[nuclear-energy]-d[reactor-cycle]"
    var reactorSprite = spriteNames["nuclear-reactor"]
    spriteNames[cycleName] = new Sprite(cycleName, reactorSprite.row, reactorSprite.col)
    items[cycleName] = cycle
    for (var name in data.entities) {
        var entity = data.entities[name]
        if (!entity.resource_category) {
            continue
        }
        var r = new Resource(data, name)
        items[name] = r
    }
    return items
}
