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
    // Maps item name to rate at which it will be wasted.
    this.waste = {}
    this.topo = []
}
Totals.prototype = {
    constructor: Totals,
    combine: function(other, suppress) {
        this.reqs.add(other.reqs, suppress)
        var newTopo = []
        for (var i = 0; i < this.topo.length; i++) {
            var recipeName = this.topo[i]
            if (!(recipeName in other.totals)) {
                newTopo.push(recipeName)
            }
        }
        newTopo = newTopo.concat(other.topo)
        for (var recipeName in other.totals) {
            this.add(recipeName, other.totals[recipeName])
        }
        for (var itemName in other.unfinished) {
            this.addUnfinished(itemName, other.unfinished[itemName])
        }
        for (var itemName in other.waste) {
            this.addWaste(itemName, other.waste[itemName])
        }
        this.topo = newTopo
    },
    add: function(recipeName, rate, notopo) {
        this.topo.push(recipeName)
        this.totals[recipeName] = (this.totals[recipeName] || zero).add(rate)
    },
    addUnfinished: function(itemName, rate) {
        this.unfinished[itemName] = (this.unfinished[itemName] || zero).add(rate)
    },
    addWaste: function(itemName, rate) {
        this.waste[itemName] = (this.waste[itemName] || zero).add(rate)
    },
    get: function(recipeName) {
        return this.totals[recipeName]
    },
}
