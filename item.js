"use strict"

function Item(name) {
    this.name = name
    this.recipes = []
}
Item.prototype = {
    constructor: Item,
    addRecipe: function(recipe) {
        this.recipes.push(recipe)
    },
    isResource: function() {
        return this.recipes.length == 0 // XXX or any recipe makes a resource
    },
    produce: function(rate, spec) {
        var totals = new Totals(rate, this)
        if (this.recipes.length > 1) {
            totals.addUnfinished(this.name, rate)
            return totals
        }
        var recipe = this.recipes[0]
        var gives = recipe.gives(this, spec)
        rate = rate.div(gives)
        totals.add(recipe.name, rate)
        for (var i=0; i < recipe.ingredients.length; i++) {
            var ing = recipe.ingredients[i]
            var subTotals = ing.item.produce(rate.mul(ing.amount), spec)
            totals.combine(subTotals)
        }
        return totals
    }
}

function Resource(name) {
    Item.call(this, name)
}
Resource.prototype = Object.create(Item.prototype)
Resource.prototype.isResource = function() {
    return true
}

function getItem(items, name) {
    if (name in items) {
        return items[name]
    } else {
        var item = new Item(name)
        items[name] = item
        return item
    }
}

function getItems(data) {
    var items = {"water": new Resource("water")}
    for (var name in data.entities) {
        var entity = data.entities[name]
        if (!entity.resource_category) {
            continue
        }
        items[name] = new Resource(name)
    }
    return items
}
