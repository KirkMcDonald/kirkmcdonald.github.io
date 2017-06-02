"use strict"

var DEFAULT_ITEM = "advanced-circuit"

var build_targets = []

function addTarget(itemName) {
    var target = new BuildTarget(build_targets.length, itemName)
    build_targets.push(target)
    var targetList = document.getElementById("targets")
    var plus = targetList.replaceChild(target.element, targetList.lastChild)
    targetList.appendChild(plus)
    return target
}

function isFactoryTarget(recipeName) {
    for (var i = 0; i < build_targets.length; i++) {
        var target = build_targets[i]
        var item = solver.items[target.itemName]
        for (var j = 0; j < item.recipes.length; j++) {
            var recipe = item.recipes[j]
            if (recipe.name == recipeName && target.changedFactory) {
                return true
            }
        }
    }
    return false
}

var targetCount = 0

function BuildTarget(index, itemName) {
    if (!itemName) {
        itemName = DEFAULT_ITEM
    }
    this.index = index
    this.itemName = itemName
    this.changedFactory = true
    this.factoriesValue = one
    this.rateValue = zero
    this.element = document.createElement("li")
    this.element.style.setProperty("vertical-align", "middle")

    var remover = document.createElement("button")
    remover.classList.add("targetButton")
    remover.addEventListener("click", new RemoveHandler(this))
    remover.textContent = "x"
    remover.title = "Remove this item."
    this.element.appendChild(remover)

    var dropdown = new Dropdown(
        this.element,
        "target-" + targetCount,
        new ItemHandler(this),
        "itemDropdown"
    )
    // Use a single global target count, as a given target's index can change.
    targetCount++

    for (var i = 0; i < itemGroups.length; i++) {
        var group = itemGroups[i]
        for (var j = 0; j < group.length; j++) {
            var subgroup = group[j]
            var any = false
            for (var k = 0; k < subgroup.length; k++) {
                var currentItem = subgroup[k]
                var currentItemName = currentItem.name
                var image = getImage(currentItemName)
                if (!image) {
                    continue
                }
                any = true
                dropdown.add(
                    image,
                    currentItemName,
                    currentItemName == this.itemName
                )
            }
            if (any) {
                dropdown.dropdown.appendChild(document.createElement("br"))
            }
        }
    }

    this.factoryLabel = document.createElement("label")
    this.factoryLabel.className = "bold"
    // TODO: htmlFor
    this.factoryLabel.textContent = "Factories:"
    this.element.appendChild(this.factoryLabel)

    this.factories = document.createElement("input")
    this.factories.addEventListener("change", new FactoryHandler(this))
    this.factories.type = "text"
    this.factories.value = 1
    this.factories.size = 3
    this.factories.title = "Enter a value to specify number of factories. The rate will be determined based on the number of items a factory can make."
    this.element.appendChild(this.factories)

    this.rateLabel = document.createElement("label")
    this.rateLabel.textContent = "Rate:"
    this.element.appendChild(this.rateLabel)

    this.rate = document.createElement("input")
    this.rate.addEventListener("change", new RateHandler(this))
    this.rate.type = "text"
    this.rate.value = ""
    this.rate.size = 5
    this.rate.title = "Enter a value to specify the rate. The number of factories will be determined based on the rate."
    this.element.appendChild(this.rate)
}
BuildTarget.prototype = {
    constructor: BuildTarget,
    // Returns the rate at which this item is being requested. Also updates
    // the text boxes in response to changes in options.
    getRate: function() {
        var item = solver.items[this.itemName]
        var rate = zero
        // XXX: Hmmm...
        var recipe = item.recipes[0]
        var factory = spec.getFactory(recipe)
        var baseRate = factory.recipeRate(recipe).mul(recipe.gives(item, spec))
        if (this.changedFactory) {
            rate = baseRate.mul(this.factoriesValue)
            this.rate.value = displayRate(rate)
        } else {
            rate = this.rateValue
            var factories = rate.div(baseRate)
            this.factories.value = displayCount(factories)
            this.rate.value = displayRate(rate)
        }
        return rate
    },
    factoriesChanged: function() {
        this.changedFactory = true
        this.factoryLabel.className = "bold"
        this.rateLabel.className = ""
        this.factoriesValue = RationalFromString(this.factories.value)
        this.rateValue = zero
        this.rate.value = ""
    },
    setFactories: function(factories) {
        this.factories.value = factories
        this.factoriesChanged()
    },
    rateChanged: function() {
        this.changedFactory = false
        this.factoryLabel.className = ""
        this.rateLabel.className = "bold"
        this.factoriesValue = zero
        this.rateValue = RationalFromString(this.rate.value).div(displayRateFactor)
        this.factories.value = ""
    },
    setRate: function(rate) {
        this.rate.value = rate
        this.rateChanged()
    }
}
