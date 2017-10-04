"use strict"

function FactoryDef(name, col, row, categories, max_ingredients, speed, moduleSlots, energyUsage) {
    this.name = name
    this.icon_col = col
    this.icon_row = row
    this.categories = categories
    this.max_ing = max_ingredients
    this.speed = speed
    this.moduleSlots = moduleSlots
    this.energyUsage = energyUsage
}
FactoryDef.prototype = {
    constructor: FactoryDef,
    less: function(other) {
        if (!this.speed.equal(other.speed)) {
            return this.speed.less(other.speed)
        }
        return this.moduleSlots < other.moduleSlots
    },
    makeFactory: function() {
        return new Factory(this)
    },
    canBeacon: function() {
        return this.moduleSlots > 0
    }
}

function MinerDef(name, col, row, categories, power, speed, moduleSlots, energyUsage) {
    FactoryDef.call(this, name, col, row, categories, 0, 0, moduleSlots, energyUsage)
    this.mining_power = power
    this.mining_speed = speed
}
MinerDef.prototype = Object.create(FactoryDef.prototype)
MinerDef.prototype.less = function(other) {
    if (!this.mining_power.equal(other.mining_power)) {
        return this.mining_power.less(other.mining_power)
    }
    return this.mining_speed.less(other.mining_speed)
}
MinerDef.prototype.makeFactory = function() {
    return new Miner(this)
}

function Factory(factoryDef) {
    this.modules = []
    this.setFactory(factoryDef)
    this.beaconModule = null
    this.beaconCount = zero
}
Factory.prototype = {
    constructor: Factory,
    setFactory: function(factoryDef) {
        this.name = factoryDef.name
        this.factory = factoryDef
        this.modules.length = factoryDef.moduleSlots
    },
    getModule: function(index) {
        return this.modules[index]
    },
    // Returns true if the module change requires a recalculation.
    setModule: function(index, module) {
        if (index >= this.modules.length) {
            return false
        }
        var oldModule = this.modules[index]
        var needRecalc = (oldModule && oldModule.hasProdEffect()) || (module && module.hasProdEffect())
        this.modules[index] = module
        return needRecalc
    },
    speedEffect: function() {
        var speed = one
        for (var i=0; i < this.modules.length; i++) {
            if (!this.modules[i]) {
                continue
            }
            speed = speed.add(this.modules[i].speed)
        }
        if (this.beaconModule) {
            speed = speed.add(this.beaconModule.speed.mul(this.beaconCount).mul(half))
        }
        return speed
    },
    prodEffect: function(spec) {
        var prod = one
        for (var i=0; i < this.modules.length; i++) {
            if (!this.modules[i]) {
                continue
            }
            prod = prod.add(this.modules[i].productivity)
        }
        return prod
    },
    powerEffect: function() {
        var power = one
        for (var i=0; i < this.modules.length; i++) {
            if (!this.modules[i]) {
                continue
            }
            power = power.add(this.modules[i].power)
        }
        if (this.beaconModule) {
            power = power.add(this.beaconModule.power.mul(this.beaconCount).mul(half))
        }
        var minimum = RationalFromFloats(1, 5)
        if (power.less(minimum)) {
            power = minimum
        }
        return power
    },
    powerUsage: function(count) {
        var power = this.factory.energyUsage
        // Default drain value.
        var drain = power.div(RationalFromFloat(30))
        var divmod = count.divmod(one)
        power = power.mul(count)
        if (!divmod.remainder.isZero()) {
            var idle = one.sub(divmod.remainder)
            power = power.add(idle.mul(drain))
        }
        power = power.mul(this.powerEffect())
        return power
    },
    recipeRate: function(recipe) {
        return one.div(recipe.time).mul(this.factory.speed).mul(this.speedEffect())
    },
    copyModules: function(other, recipe) {
        var length = Math.max(this.modules.length, other.modules.length)
        var needRecalc = false
        for (var i = 0; i < length; i++) {
            var module = this.getModule(i)
            if (!module || module.canUse(recipe)) {
                needRecalc = other.setModule(i, module) || needRecalc
            }
        }
        if (other.factory.canBeacon()) {
            other.beaconModule = this.beaconModule
            other.beaconCount = this.beaconCount
        }
        return needRecalc
    },
}

function Miner(factory) {
    Factory.call(this, factory)
}
Miner.prototype = Object.create(Factory.prototype)
Miner.prototype.recipeRate = function(recipe) {
    var miner = this.factory
    return miner.mining_power.sub(recipe.hardness).mul(miner.mining_speed).div(recipe.mining_time).mul(this.speedEffect())
}
Miner.prototype.prodEffect = function(spec) {
    var prod = Factory.prototype.prodEffect.call(this, spec)
    return prod.add(spec.miningProd)
}

var assembly_machine_categories = {
    "advanced-crafting": true,
    "crafting": true,
    "crafting-with-fluid": true,
}

function compareFactories(a, b) {
    if (a.less(b)) {
        return -1
    }
    if (b.less(a)) {
        return 1
    }
    return 0
}

var DEFAULT_FURNACE

function FactorySpec(factories) {
    this.spec = {}
    this.factories = {}
    for (var i = 0; i < factories.length; i++) {
        var factory = factories[i]
        for (var j = 0; j < factory.categories.length; j++) {
            var category = factory.categories[j]
            if (!(category in this.factories)) {
                this.factories[category] = []
            }
            this.factories[category].push(factory)
        }
    }
    for (var category in this.factories) {
        this.factories[category].sort(compareFactories)
    }
    this.setMinimum("1")
    var smelters = this.factories["smelting"]
    this.furnace = smelters[smelters.length - 1]
    DEFAULT_FURNACE = this.furnace.name
    this.miningProd = zero
    this.ignore = {}
}
FactorySpec.prototype = {
    constructor: FactorySpec,
    // min is a string like "1", "2", or "3".
    setMinimum: function(min) {
        var minIndex = Number(min) - 1
        this.minimum = this.factories["crafting"][minIndex]
    },
    useMinimum: function(recipe) {
        return recipe.category in assembly_machine_categories
    },
    setFurnace: function(name) {
        var smelters = this.factories["smelting"]
        for (var i = 0; i < smelters.length; i++) {
            if (smelters[i].name == name) {
                this.furnace = smelters[i]
                return
            }
        }
    },
    useFurnace: function(recipe) {
        return recipe.category == "smelting"
    },
    getFactoryDef: function(recipe) {
        if (this.useFurnace(recipe)) {
            return this.furnace
        }
        var factories = this.factories[recipe.category]
        if (!this.useMinimum(recipe)) {
            return factories[factories.length - 1]
        }
        var factoryDef
        for (var i = 0; i < factories.length; i++) {
            factoryDef = factories[i]
            if (factoryDef.less(this.minimum) || factoryDef.max_ing < recipe.ingredients.length) {
                continue
            }
            break
        }
        return factoryDef
    },
    getFactory: function(recipe) {
        if (!recipe.category) {
            return null
        }
        var factoryDef = this.getFactoryDef(recipe)
        var factory = this.spec[recipe.name]
        // If the minimum changes, update the factory the next time we get it.
        if (factory) {
            factory.setFactory(factoryDef)
            return factory
        }
        this.spec[recipe.name] = factoryDef.makeFactory()
        return this.spec[recipe.name]
    },
    getCount: function(recipe, rate) {
        var factory = this.getFactory(recipe)
        if (!factory) {
            return zero
        }
        return rate.div(factory.recipeRate(recipe))
    }
}

function getFactories(data) {
    var factories = []
    var pumpDef = data["offshore-pump"]["offshore-pump"]
    factories.push(new FactoryDef(
        "offshore-pump",
        pumpDef.icon_col,
        pumpDef.icon_row,
        ["water"],
        1,
        one,
        0,
        zero
    ))
    var reactorDef = data["reactor"]["nuclear-reactor"]
    factories.push(new FactoryDef(
        "nuclear-reactor",
        reactorDef.icon_col,
        reactorDef.icon_row,
        ["nuclear"],
        1,
        one,
        0,
        zero
    ))
    for (var type in {"assembling-machine": true, "furnace": true, "rocket-silo": true}) {
        for (var name in data[type]) {
            var d = data[type][name]
            factories.push(new FactoryDef(
                d.name,
                d.icon_col,
                d.icon_row,
                d.crafting_categories,
                d.ingredient_count,
                RationalFromFloat(d.crafting_speed),
                d.module_slots,
                RationalFromFloat(d.energy_usage)
            ))
        }
    }
    for (var name in data["mining-drill"]) {
        var d = data["mining-drill"][name]
        if (d.name == "pumpjack") {
            continue
        }
        factories.push(new MinerDef(
            d.name,
            d.icon_col,
            d.icon_row,
            ["mining-basic-solid"],
            RationalFromFloat(d.mining_power),
            RationalFromFloat(d.mining_speed),
            d.module_slots,
            RationalFromFloat(d.energy_usage)
        ))
    }
    return factories
}
