function Module(name, productivity, speed, limit) {
    // Other module effects not modeled by this calculator.
    this.name = name
    this.productivity = productivity
    this.speed = speed
    this.limit = limit
}

function loadModules(data) {
    modules = {}
    for (var name in data.raw.module) {
        var module = data.raw.module[name]
        var effect = module.effect
        if (!("speed" in effect) && !("productivity" in effect)) {
            continue
        }
        var speed = (effect.speed || {}).bonus || 0
        var productivity = (effect.productivity || {}).bonus || 0
        var limit = module.limitation
        modules[name] = new Module(name, productivity, speed, limit)
    }
}

// {item: [modules]}
var moduleSpec = {}

function setModule(itemName, x, moduleName) {
    if (!(itemName in moduleSpec)) {
        moduleSpec[itemName] = new ModuleSet()
    }
    var moduleObj = modules[moduleName]
    moduleSpec[itemName].setModule(x, moduleObj)
}

function ModuleSet() {
    this.modules = []
}
ModuleSet.prototype = {
    constructor: ModuleSet,
    setModule: function(x, module) {
        this.modules[x] = module
    },
    getModule: function(x) {
        return this.modules[x]
    },
    total: function(factory) {
        var sum = {'speed': 1, 'productivity': 1}
        for (var x in this.modules) {
            var module = this.modules[x]
            if (!module) continue
            if (x >= factory.modules) {
                break
            }
            sum.speed += module.speed
            sum.productivity += module.productivity
        }
        return sum
    }
}
