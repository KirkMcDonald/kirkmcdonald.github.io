"use strict"

function Requirements(rate, item) {
    this.rate = rate
    this.item = item
    this.dependencies = []
}
Requirements.prototype = {
    constructor: Requirements,
    add: function(reqs, suppress) {
        if (reqs.item && !suppress) {
            this.dependencies.push(reqs)
        }
    }
}

function Totals(rate, item) {
    this.reqs = new Requirements(rate, item)
    // Maps recipe name to its required rate.
    this.totals = {}
    // Maps item name to its as-yet-unfulfilled rate.
    this.unfinished = {}
}
Totals.prototype = {
    constructor: Totals,
    combine: function(other, suppress) {
        this.reqs.add(other.reqs, suppress)
        for (var recipeName in other.totals) {
            this.add(recipeName, other.totals[recipeName])
        }
        for (var itemName in other.unfinished) {
            this.addUnfinished(itemName, other.unfinished[itemName])
        }
    },
    add: function(recipeName, rate) {
        this.totals[recipeName] = (this.totals[recipeName] || zero).add(rate)
    },
    addUnfinished: function(itemName, rate) {
        this.unfinished[itemName] = (this.unfinished[itemName] || zero).add(rate)
    },
    get: function(recipeName) {
        return this.totals[recipeName]
    },
}
