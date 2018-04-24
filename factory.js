"use strict"

function FactoryDef(name, col, row, categories, max_ingredients, speed, moduleSlots, energyUsage, fuel) {
    this.name = name
    this.icon_col = col
    this.icon_row = row
    this.categories = categories
    this.max_ing = max_ingredients
    this.speed = speed
    this.moduleSlots = moduleSlots
    this.energyUsage = energyUsage
    this.fuel = fuel
}
FactoryDef.prototype = {
    constructor: FactoryDef,
    less: function(other) {
        if (!this.speed.equal(other.speed)) {
            return this.speed.less(other.speed)
        }
        return this.moduleSlots < other.moduleSlots
    },
    makeFactory: function(spec, recipe) {
        return new Factory(this, spec, recipe)
    },
    canBeacon: function() {
        return this.moduleSlots > 0
    },
    renderTooltip: function() {
        var t = document.createElement("div")
        t.classList.add("frame")
        var title = document.createElement("h3")
        var im = getImage(this, true)
        title.appendChild(im)
        title.appendChild(new Text(formatName(this.name)))
        t.appendChild(title)
        var b
        if (this.max_ing) {
            b = document.createElement("b")
            b.textContent = "Max ingredients: "
            t.appendChild(b)
            t.appendChild(new Text(this.max_ing))
            t.appendChild(document.createElement("br"))
        }
        b = document.createElement("b")
        b.textContent = "Energy consumption: "
        t.appendChild(b)
        t.appendChild(new Text(alignPower(this.energyUsage, 0)))
        t.appendChild(document.createElement("br"))
        b = document.createElement("b")
        b.textContent = "Crafting speed: "
        t.appendChild(b)
        t.appendChild(new Text(this.speed.toDecimal()))
        t.appendChild(document.createElement("br"))
        b = document.createElement("b")
        b.textContent = "Module slots: "
        t.appendChild(b)
        t.appendChild(new Text(this.moduleSlots))
        return t
    }
}

function MinerDef(name, col, row, categories, power, speed, moduleSlots, energyUsage, fuel) {
    FactoryDef.call(this, name, col, row, categories, 0, 0, moduleSlots, energyUsage, fuel)
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
MinerDef.prototype.makeFactory = function(spec, recipe) {
    return new Miner(this, spec, recipe)
}
MinerDef.prototype.renderTooltip = function() {
    var t = document.createElement("div")
    t.classList.add("frame")
    var title = document.createElement("h3")
    var im = getImage(this, true)
    title.appendChild(im)
    title.appendChild(new Text(formatName(this.name)))
    t.appendChild(title)
    var b = document.createElement("b")
    b.textContent = "Energy consumption: "
    t.appendChild(b)
    t.appendChild(new Text(alignPower(this.energyUsage, 0)))
    t.appendChild(document.createElement("br"))
    b = document.createElement("b")
    b.textContent = "Mining power: "
    t.appendChild(b)
    t.appendChild(new Text(this.mining_power.toDecimal()))
    t.appendChild(document.createElement("br"))
    b = document.createElement("b")
    b.textContent = "Mining speed: "
    t.appendChild(b)
    t.appendChild(new Text(this.mining_speed.toDecimal()))
    t.appendChild(document.createElement("br"))
    b = document.createElement("b")
    b.textContent = "Module slots: "
    t.appendChild(b)
    t.appendChild(new Text(this.moduleSlots))
    return t
}

function Factory(factoryDef, spec, recipe) {
    this.recipe = recipe
    this.modules = []
    this.setFactory(factoryDef, spec)
    this.beaconModule = spec.defaultBeacon
    this.beaconCount = spec.defaultBeaconCount
}
Factory.prototype = {
    constructor: Factory,
    setFactory: function(factoryDef, spec) {
        this.name = factoryDef.name
        this.factory = factoryDef
        if (this.modules.length > factoryDef.moduleSlots) {
            this.modules.length = factoryDef.moduleSlots
        }
        while (this.modules.length < factoryDef.moduleSlots) {
            this.modules.push(spec.defaultModule)
        }
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
    speedEffect: function(spec) {
        var speed = one
        for (var i=0; i < this.modules.length; i++) {
            var module = this.modules[i]
            if (!module) {
                continue
            }
            speed = speed.add(module.speed)
        }
        if (this.modules.length > 0) {
            var beaconModule = this.beaconModule
            if (beaconModule) {
                speed = speed.add(beaconModule.speed.mul(this.beaconCount).mul(half))
            }
        }
        return speed
    },
    prodEffect: function(spec) {
        var prod = one
        for (var i=0; i < this.modules.length; i++) {
            var module = this.modules[i]
            if (!module) {
                continue
            }
            prod = prod.add(module.productivity)
        }
        return prod
    },
    powerEffect: function(spec) {
        var power = one
        for (var i=0; i < this.modules.length; i++) {
            var module = this.modules[i]
            if (!module) {
                continue
            }
            power = power.add(module.power)
        }
        if (this.modules.length > 0) {
            var beaconModule = this.beaconModule
            if (beaconModule) {
                power = power.add(beaconModule.power.mul(this.beaconCount).mul(half))
            }
        }
        var minimum = RationalFromFloats(1, 5)
        if (power.less(minimum)) {
            power = minimum
        }
        return power
    },
    powerUsage: function(spec, count) {
        var power = this.factory.energyUsage
        if (this.factory.fuel) {
            return {"fuel": this.factory.fuel, "power": power.mul(count)}
        }
        // Default drain value.
        var drain = power.div(RationalFromFloat(30))
        var divmod = count.divmod(one)
        power = power.mul(count)
        if (!divmod.remainder.isZero()) {
            var idle = one.sub(divmod.remainder)
            power = power.add(idle.mul(drain))
        }
        power = power.mul(this.powerEffect(spec))
        return {"fuel": "electric", "power": power}
    },
    recipeRate: function(spec, recipe) {
        return one.div(recipe.time).mul(this.factory.speed).mul(this.speedEffect(spec))
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

function Miner(factory, spec, recipe) {
    Factory.call(this, factory, spec, recipe)
}
Miner.prototype = Object.create(Factory.prototype)
Miner.prototype.recipeRate = function(spec, recipe) {
    var miner = this.factory
    return miner.mining_power.sub(recipe.hardness).mul(miner.mining_speed).div(recipe.mining_time).mul(this.speedEffect(spec))
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

    this.defaultModule = null
    // XXX: Not used yet.
    this.defaultBeacon = null
    this.defaultBeaconCount = zero
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
    // TODO: This should be very cheap. Calling getFactoryDef on each call
    // should not be necessary. Changing the minimum should proactively update
    // all of the factories to which it applies.
    getFactory: function(recipe) {
        if (!recipe.category) {
            return null
        }
        var factoryDef = this.getFactoryDef(recipe)
        var factory = this.spec[recipe.name]
        // If the minimum changes, update the factory the next time we get it.
        if (factory) {
            factory.setFactory(factoryDef, this)
            return factory
        }
        this.spec[recipe.name] = factoryDef.makeFactory(this, recipe)
        this.spec[recipe.name].beaconCount = this.defaultBeaconCount
        return this.spec[recipe.name]
    },
    moduleCount: function(recipe) {
        var factory = this.getFactory(recipe)
        if (!factory) {
            return 0
        }
        return factory.modules.length
    },
    getModule: function(recipe, index) {
        var factory = this.getFactory(recipe)
        var module = factory.getModule(index)
        return module
    },
    setModule: function(recipe, index, module) {
        var factory = this.getFactory(recipe)
        if (!factory) {
            return false
        }
        return factory.setModule(index, module)
    },
    getBeaconInfo: function(recipe) {
        var factory = this.getFactory(recipe)
        var module = factory.beaconModule
        return {"module": module, "count": factory.beaconCount}
    },
    setDefaultModule: function(module) {
        // Set anything set to the old default to the new.
        for (var recipeName in this.spec) {
            var factory = this.spec[recipeName]
            var recipe = factory.recipe
            for (var i = 0; i < factory.modules.length; i++) {
                if (factory.modules[i] === this.defaultModule && (!module || module.canUse(recipe))) {
                    factory.modules[i] = module
                }
            }
        }
        this.defaultModule = module
    },
    setDefaultBeacon: function(module, count) {
        for (var recipeName in this.spec) {
            var factory = this.spec[recipeName]
            var recipe = factory.recipe
            // Set anything set to the old defeault beacon module to the new.
            if (factory.beaconModule === this.defaultBeacon && (!module || module.canUse(recipe))) {
                factory.beaconModule = module
            }
            // Set any beacon counts equal to the old default to the new one.
            if (factory.beaconCount.equal(this.defaultBeaconCount)) {
                factory.beaconCount = count
            }
        }
        this.defaultBeacon = module
        this.defaultBeaconCount = count
    },
    getCount: function(recipe, rate) {
        var factory = this.getFactory(recipe)
        if (!factory) {
            return zero
        }
        return rate.div(factory.recipeRate(this, recipe))
    },
    recipeRate: function(recipe) {
        var factory = this.getFactory(recipe)
        if (!factory) {
            return null
        }
        return factory.recipeRate(this, recipe)
    },
}

function renderTooltipBase() {
    var t = document.createElement("div")
    t.classList.add("frame")
    var title = document.createElement("h3")
    var im = getImage(this, true)
    title.appendChild(im)
    title.appendChild(new Text(formatName(this.name)))
    t.appendChild(title)
    return t
}

function getFactories(data) {
    var factories = []
    var pumpDef = data["offshore-pump"]["offshore-pump"]
    var pump = new FactoryDef(
        "offshore-pump",
        pumpDef.icon_col,
        pumpDef.icon_row,
        ["water"],
        1,
        one,
        0,
        zero,
        null
    )
    pump.renderTooltip = renderTooltipBase
    factories.push(pump)
    var reactorDef = data["reactor"]["nuclear-reactor"]
    var reactor = new FactoryDef(
        "nuclear-reactor",
        reactorDef.icon_col,
        reactorDef.icon_row,
        ["nuclear"],
        1,
        one,
        0,
        zero,
        null
    )
    reactor.renderTooltip = renderTooltipBase
    factories.push(reactor)
    for (var type in {"assembling-machine": true, "furnace": true, "rocket-silo": true}) {
        for (var name in data[type]) {
            var d = data[type][name]
            var fuel = null
            if (d.energy_source && d.energy_source.type === "burner") {
                fuel = d.energy_source.fuel_category
            }
            factories.push(new FactoryDef(
                d.name,
                d.icon_col,
                d.icon_row,
                d.crafting_categories,
                d.ingredient_count,
                RationalFromFloat(d.crafting_speed),
                d.module_slots,
                RationalFromFloat(d.energy_usage),
                fuel
            ))
        }
    }
    for (var name in data["mining-drill"]) {
        var d = data["mining-drill"][name]
        if (d.name == "pumpjack") {
            continue
        }
        var fuel = null
        if (d.energy_source && d.energy_source.type === "burner") {
            fuel = d.energy_source.fuel_category
        }
        factories.push(new MinerDef(
            d.name,
            d.icon_col,
            d.icon_row,
            ["mining-basic-solid"],
            RationalFromFloat(d.mining_power),
            RationalFromFloat(d.mining_speed),
            d.module_slots,
            RationalFromFloat(d.energy_usage),
            fuel
        ))
    }
    return factories
}
