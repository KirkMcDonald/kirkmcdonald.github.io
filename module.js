"use strict"

function Module(name, col, row, category, order, productivity, speed, power, limit) {
    // Other module effects not modeled by this calculator.
    this.name = name
    this.icon_col = col
    this.icon_row = row
    this.category = category
    this.order = order
    this.productivity = productivity
    this.speed = speed
    this.power = power
    this.limit = {}
    if (limit) {
        for (var i = 0; i < limit.length; i++) {
            this.limit[limit[i]] = true
        }
    }
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
    for (var i = 0; i < data.modules.length; i++) {
        var name = data.modules[i]
        var item = data.items[name]
        var effect = item.effect
        var category = item.category
        var order = item.order
        var speed = RationalFromFloat((effect.speed || {}).bonus || 0)
        var productivity = RationalFromFloat((effect.productivity || {}).bonus || 0)
        var power = RationalFromFloat((effect.consumption || {}).bonus || 0)
        var limit = item.limitation
        modules[name] = new Module(
            name,
            item.icon_col,
            item.icon_row,
            category,
            order,
            productivity,
            speed,
            power,
            limit
        )
    }
    return modules
}
