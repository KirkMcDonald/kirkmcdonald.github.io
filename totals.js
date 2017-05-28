"use strict"

function Totals() {
    // Maps recipe name to its required rate.
    this.totals = {}
    // Maps item name to its as-yet-unfulfilled rate.
    this.unfinished = {}
}
Totals.prototype = {
    constructor: Totals,
    combine: function(other) {
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
