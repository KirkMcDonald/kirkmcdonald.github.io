/*Copyright 2015-2019 Kirk McDonald

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.*/
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
    // Special case: rocket-part and rocket-launch are linked in a weird way.
    if (recipeName === "rocket-part") {
        if (isFactoryTarget("rocket-launch")) {
            return true
        }
    }
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

    let dropdown = makeDropdown(
        d3.select(this.element),
        d => d.select(".search").node().focus(),
        d => resetSearch(d.node()),
    )
    dropdown.classed("itemDropdown", true)
    dropdown.append("input")
        .classed("search", true)
        .attr("placeholder", "Search")
        .on("keyup", searchTargets)
    let group = dropdown.selectAll("div")
        .data(itemGroups)
        .join("div")
    group.filter((d, i) => i > 0)
        .append("hr")
    let items = group.selectAll("div")
        .data(d => d)
        .join("div")
            .selectAll("span")
            .data(d => d)
            .join("span")
    let labels = addInputs(
        items,
        "target-" + targetCount,
        d => d.name === this.itemName,
        ItemHandler(this),
    )
    labels.append(d => getImage(d, false, dropdown.node()))

    // Use a single global target count, as a given target's index can change.
    targetCount++

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
        let self = this
        let dropdown = makeDropdown(d3.select(this.recipeSelector))
        let inputs = dropdown.selectAll("div").data(item.recipes).join("div")
        let labels = addInputs(
            inputs,
            "target-recipe-" + recipeSelectorCount,
            (d, i) => self.recipeIndex === i,
            (d, i) => RecipeSelectorHandler(self, i),
        )
        labels.append(d => getImage(d, false, dropdown.node()))
        recipeSelectorCount++
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
