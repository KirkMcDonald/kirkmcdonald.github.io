"use strict"

function Module(name, category, order, productivity, speed, limit) {
    // Other module effects not modeled by this calculator.
    this.name = name
    this.category = category
    this.order = order
    this.productivity = productivity
    this.speed = speed
    this.limit = limit
}
Module.prototype = {
    constructor: Module,
    shortName: function() {
        return this.name[0] + this.name[this.name.length - 1]
    },
    canUse: function(recipe) {
        if (recipe.allModules()) {
            return true
        }
        if (Object.keys(this.limit).length > 0) {
            return recipe.name in this.limit
        }
        return true
    },
    canBeacon: function() {
        return this.productivity.isZero()
    },
    hasProdEffect: function() {
        return !this.productivity.isZero()
    }
}

function getModules(data) {
    var modules = {}
    for (var name in data.items) {
        var item = data.items[name]
        if (!item.module_effects) {
            continue
        }
        var effect = item.module_effects
        if (!("speed" in effect) && !("productivity" in effect)) {
            continue
        }
        var category = item.category
        var order = item.order
        var speed = RationalFromFloat((effect.speed || {}).bonus || 0)
        var productivity = RationalFromFloat((effect.productivity || {}).bonus || 0)
        var limit = item.limitations
        modules[name] = new Module(name, category, order, productivity, speed, limit)
    }
    return modules
}
