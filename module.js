function Module(name, productivity, speed, limit) {
    // Other module effects not modeled by this calculator.
    this.name = name
    this.productivity = productivity
    this.speed = speed
    this.limit = limit
}

function loadModules(data) {
    modules = {}
    for (var name in data.modules) {
        var module = data.modules[name]
        var effect = module.module_effects
        if (!("speed" in effect) && !("productivity" in effect)) {
            continue
        }
        var speed = (effect.speed || {}).bonus || 0
        var productivity = (effect.productivity || {}).bonus || 0
        var limit = module.limitations
        modules[name] = new Module(name, productivity, speed, limit)
    }
}

// {item: [modules]}
var moduleSpec = {}

function ensureModuleSpec(itemName) {
    if (!(itemName in moduleSpec)) {
        moduleSpec[itemName] = new ModuleSet()
    }
}

function setModule(itemName, x, moduleName) {
    ensureModuleSpec(itemName)
    var moduleObj = modules[moduleName]
    moduleSpec[itemName].setModule(x, moduleObj)
}

function setBeacon(itemName, moduleName) {
    ensureModuleSpec(itemName)
    var moduleObj = modules[moduleName]
    moduleSpec[itemName].setBeacon(moduleObj)
}

function setBeaconCount(itemName, count) {
    ensureModuleSpec(itemName)
    moduleSpec[itemName].setBeaconCount(count)
}

function ModuleSet() {
    this.modules = []
    this.beacon_module = null
    this.beacon_module_count = 0
}
ModuleSet.prototype = {
    constructor: ModuleSet,
    setModule: function(x, module) {
        this.modules[x] = module
    },
    getModule: function(x) {
        return this.modules[x]
    },
    setBeacon: function(module) {
        this.beacon_module = module
    },
    setBeaconCount: function(count) {
        this.beacon_module_count = count
    },
    getBeacon: function() {
        return [this.beacon_module, this.beacon_module_count]
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
        if (this.beacon_module) {
            var module = this.beacon_module
            sum.speed += module.speed * this.beacon_module_count * 0.5
        }
        return sum
    }
}
