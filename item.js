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

function Item(name, col, row, phase, group, subgroup, order) {
    this.name = name
    this.icon_col = col
    this.icon_row = row
    this.recipes = []
    this.uses = []
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
    addUse: function(recipe) {
        this.uses.push(recipe)
    },
    isWeird: function() {
        return this.recipes.length > 1 || this.recipes[0].solveGroup !== null
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
    },
    renderTooltip: function(extra) {
        if (this.recipes.length === 1 && this.recipes[0].name === this.name) {
            return this.recipes[0].renderTooltip(extra)
        }
        var t = document.createElement("div")
        t.classList.add("frame")
        var title = document.createElement("h3")
        var im = getImage(this, true)
        title.appendChild(im)
        title.appendChild(new Text(formatName(this.name)))
        t.appendChild(title)
        if (extra) {
            t.appendChild(extra)
        }
        return t
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
