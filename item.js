function Ingredient(amount, item) {
    this.amount = amount
    this.item = item
}

function makeIngredient(i, items) {
    return new Ingredient(i.amount, getItem(items, i.name))
}

function Requirement(rate, item, dependencies) {
    return {rate: rate, item: item, dependencies: dependencies}
}

function Totals() {
    // Maps name to rate for necessary items
    this.totals = {}
}
Totals.prototype = {
    constructor: Totals,
    add: function(name, rate) {
        this.totals[name] = (this.totals[name] || 0) + rate
    },
    get: function(name) {
        return this.totals[name]
    },
    merge: function(other) {
        for (var name in other.totals) {
            this.add(name, other.totals[name])
        }
    }
}

function getItem(items, name) {
    if (name in items) {
        return items[name]
    } else {
        var item = new Item(name)
        items[name] = item
        return item
    }
}

function Item(name) {
    this.name = name
    this.recipes = []
}
Item.prototype = {
    constructor: Item,
    addRecipe: function(recipe) {
        this.recipes.push(recipe)
    },
    requirements: function(multiple) {
        var totals = new Totals()
        var result = []
        if (this.recipes.length == 0) {
            return [result, totals]
        }
        var recipe = this.recipes[0]
        for (var i in recipe.inputs) {
            var ingredient = recipe.inputs[i]
            var rate = ingredient.amount * multiple / recipe.gives(this)
            totals.add(ingredient.item.name, rate)
            var reqs = ingredient.item.requirements(rate)
            result.push(Requirement(rate, ingredient.item, reqs[0]))
            totals.merge(reqs[1])
        }
        return [result, totals]
    },
    factories: function(rate) {
        if (this.recipes.length == 0) {
            return [null, null, null]
        }
        var recipe = this.recipes[0]
        return recipe.factories(rate / recipe.gives(this))
    },
    rate: function(factories) {
        if (this.recipes.length == 0) {
            return 1
        }
        var recipe = this.recipes[0]
        return recipe.rate() * factories
    }
}

function Resource(name) {
    Item.call(this, name)
}
Resource.prototype = Object.create(Item.prototype)
Resource.prototype.requirements = function(multiple) {
    return [[], new Totals()]
}
Resource.prototype.factories = function(rate) {
    return [null, null, null]
}
Resource.prototype.rate = function(factories) {
    return 1
}

function MineableResource(name, hardness, time) {
    Item.call(this, name)
    this.hardness = hardness
    this.time = time
}
MineableResource.prototype = Object.create(Item.prototype)
MineableResource.prototype.baseRate = function() {
    // Hardcoded values for basic mining drill, blah.
    var mining_power = 3
    var mining_speed = 0.5
    var moduleEffects = moduleSpec[this.name]
    var speed = 1
    if (moduleEffects) {
        var total = moduleEffects.total(MINER)
        speed = total.speed
    }
    return speed * (mining_power - this.hardness) * mining_speed / this.time * 60
}
MineableResource.prototype.requirements = function(multiple) {
    return [[], new Totals()]
}
MineableResource.prototype.factories = function(rate) {
    var real = rate / this.baseRate()
    var factories = Math.ceil(real)
    return [factories, real, MINER]
}
MineableResource.prototype.rate = function(factories) {
    return this.baseRate() * factories
}

function getItems(data) {
    var categories = []
    items = {}
    for (var name in data.resources) {
        var resource = data.resources[name]
        if (resource.resource_category == "basic-solid") {
            items[name] = new MineableResource(name, resource.mineable_properties.hardness, resource.mineable_properties.miningtime)
        } else {
            items[name] = new Resource(name)
        }
    }
    return items
}
