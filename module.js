"use strict"

function Module(name, productivity, speed, limit) {
    // Other module effects not modeled by this calculator.
    this.name = name
    this.productivity = productivity
    this.speed = speed
    this.limit = limit
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
        var speed = RationalFromFloat((effect.speed || {}).bonus || 0)
        var productivity = RationalFromFloat((effect.productivity || {}).bonus || 0)
        var limit = item.limitations
        modules[name] = new Module(name, productivity, speed, limit)
    }
    return modules
}
