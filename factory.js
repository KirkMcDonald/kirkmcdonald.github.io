"use strict"

function FactoryDef(name, categories, max_ingredients, speed, moduleSlots) {
    this.name = name
    this.categories = categories
    this.max_ing = max_ingredients
    this.speed = speed
    this.moduleSlots = moduleSlots
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
    }
}

function MinerDef(name, categories, power, speed, moduleSlots) {
    FactoryDef.call(this, name, categories, 0, 0, moduleSlots)
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
    setModule: function(index, module) {
        if (index >= this.modules.length) {
            return
        }
        this.modules[index] = module
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
    prodEffect: function() {
        var prod = one
        for (var i=0; i < this.modules.length; i++) {
            if (!this.modules[i]) {
                continue
            }
            prod = prod.add(this.modules[i].productivity)
        }
        return prod
    },
    recipeRate: function(recipe) {
        return one.div(recipe.time).mul(this.factory.speed).mul(this.speedEffect())
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

function FactorySpec(factories) {
    this.spec = {}
    this.factories = {}
    for (var i = 0; i < factories.length; i++) {
        var factory = factories[i]
        for (var category in factory.categories) {
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
    this.miningProd = zero
    // Factor for meaning of rates. 1 = seconds, 60 = minutes, 3600 = hours
    this.speedFactor = one
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
    getMinimum: function(recipe) {
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
        var factory = this.spec[recipe.name]
        // If the minimum changes, update the factory the next time we get it.
        if (factory) {
            if (this.useMinimum(recipe)) {
                factory.setFactory(this.getMinimum(recipe))
            }
            return factory
        }
        if (!recipe.category) {
            return null
        }
        var factoryDef = this.getMinimum(recipe)
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
    for (var name in data.entities) {
        var d = data.entities[name]
        if ("crafting_categories" in d && d.name != "player") {
            factories.push(new FactoryDef(
                d.name,
                d.crafting_categories,
                d.ingredient_count,
                RationalFromFloat(d.crafting_speed),
                d.module_inventory_size
            ))
        } else if ("mining_power" in d) {
            if (d.name == "pumpjack") {
                continue
            }
            factories.push(new MinerDef(
                d.name,
                {"mining-basic-solid": true},
                RationalFromFloat(d.mining_power),
                RationalFromFloat(d.mining_speed),
                d.module_inventory_size
            ))
        }
    }
    return factories
}
