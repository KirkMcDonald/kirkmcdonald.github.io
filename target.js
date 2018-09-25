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
var recipeSelectorCount = 0

var SELECTED_INPUT = "selected"

function BuildTarget(index, itemName) {
    if (!itemName) {
        itemName = DEFAULT_ITEM
    }
    this.index = index
    this.itemName = itemName
    this.recipeIndex = 0
    this.changedFactory = true
    this.factoriesValue = one
    this.rateValue = zero
    this.element = document.createElement("li")
    this.element.classList.add("target")

    var remover = document.createElement("button")
    remover.classList.add("targetButton")
    remover.classList.add("ui")
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

    // add search box to dropdown
    var search = document.createElement("input")
    search.classList.add("search")
    search.placeholder = "Search"
    search.addEventListener("keyup", searchTargets)
    dropdown.dropdown.prepend(search)
    dropdown.dropdown.addEventListener("mouseenter", function(ev) {
        ev.target.getElementsByClassName("search")[0].focus()
    })
    dropdown.dropdown.addEventListener("mouseleave", resetSearch)

    // Use a single global target count, as a given target's index can change.
    targetCount++

    var anyGroup = false
    for (var i = 0; i < itemGroups.length; i++) {
        var group = itemGroups[i]
        if (anyGroup) {
            dropdown.addRule()
        }
        anyGroup = false
        for (var j = 0; j < group.length; j++) {
            var subgroup = group[j]
            var any = false
            for (var k = 0; k < subgroup.length; k++) {
                var currentItem = subgroup[k]
                var currentItemName = currentItem.name
                var image = getImage(currentItem, false, dropdown.dropdown)
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
                dropdown.addBreak()
                anyGroup = true
            }
        }
    }

    this.factoryLabel = document.createElement("label")
    this.factoryLabel.classList.add(SELECTED_INPUT)
    // TODO: htmlFor
    this.factoryLabel.textContent = " Factories: "
    this.element.appendChild(this.factoryLabel)

    this.recipeSelector = document.createElement("span")
    this.element.appendChild(this.recipeSelector)

    this.factories = document.createElement("input")
    this.factories.addEventListener("change", new FactoryHandler(this))
    this.factories.type = "text"
    this.factories.value = 1
    this.factories.size = 3
    this.factories.title = "Enter a value to specify number of factories. The rate will be determined based on the number of items a factory can make."
    this.element.appendChild(this.factories)

    this.rateLabel = document.createElement("label")
    this.setRateLabel()
    this.element.appendChild(this.rateLabel)

    this.rate = document.createElement("input")
    this.rate.addEventListener("change", new RateHandler(this))
    this.rate.type = "text"
    this.rate.value = ""
    this.rate.size = 5
    this.rate.title = "Enter a value to specify the rate. The number of factories will be determined based on the rate."
    this.element.appendChild(this.rate)
    this.displayRecipes()
}
BuildTarget.prototype = {
    constructor: BuildTarget,
    setRateLabel: function() {
        this.rateLabel.textContent = " Items/" + longRateNames[rateName] + ": "
    },
    displayRecipes: function() {
        while (this.recipeSelector.hasChildNodes()) {
            this.recipeSelector.removeChild(this.recipeSelector.lastChild)
        }
        var item = solver.items[this.itemName]
        if (item.recipes.length <= 1) {
            return
        }
        var dropdown = new Dropdown(
            this.recipeSelector,
            "target-recipe-" + recipeSelectorCount,
            new RecipeSelectorHandler(this)
        )
        recipeSelectorCount++
        for (var i = 0; i < item.recipes.length; i++) {
            var recipe = item.recipes[i]
            var image = getImage(recipe, false, dropdown.dropdown)
            dropdown.add(
                image,
                i,
                this.recipeIndex == i
            )
        }
        this.recipeSelector.appendChild(new Text(" \u00d7 "))
    },
    // Returns the rate at which this item is being requested. Also updates
    // the text boxes in response to changes in options.
    getRate: function() {
        this.setRateLabel()
        var item = solver.items[this.itemName]
        var rate = zero
        // XXX: Hmmm...
        var recipe = item.recipes[this.recipeIndex]
        if (!recipe.category && this.changedFactory) {
            this.rateChanged()
        }
        var baseRate = spec.recipeRate(recipe)
        if (baseRate) {
            baseRate = baseRate.mul(recipe.gives(item, spec))
        }
        if (this.changedFactory) {
            rate = baseRate.mul(this.factoriesValue)
            this.rate.value = displayRate(rate)
        } else {
            rate = this.rateValue
            if (baseRate) {
                var factories = rate.div(baseRate)
                this.factories.value = displayCount(factories)
            } else {
                this.factories.value = "N/A"
            }
            this.rate.value = displayRate(rate)
        }
        return rate
    },
    factoriesChanged: function() {
        this.changedFactory = true
        this.factoryLabel.classList.add(SELECTED_INPUT)
        this.rateLabel.classList.remove(SELECTED_INPUT)
        this.factoriesValue = RationalFromString(this.factories.value)
        this.rateValue = zero
        this.rate.value = ""
    },
    setFactories: function(index, factories) {
        this.recipeIndex = index
        this.factories.value = factories
        this.factoriesChanged()
    },
    rateChanged: function() {
        this.changedFactory = false
        this.factoryLabel.classList.remove(SELECTED_INPUT)
        this.rateLabel.classList.add(SELECTED_INPUT)
        this.factoriesValue = zero
        this.rateValue = RationalFromString(this.rate.value).div(displayRateFactor)
        this.factories.value = ""
    },
    setRate: function(rate) {
        this.rate.value = rate
        this.rateChanged()
    }
}
