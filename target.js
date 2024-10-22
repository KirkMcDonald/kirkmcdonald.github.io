/*Copyright 2019-2021 Kirk McDonald

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.*/
import { makeDropdown, addInputs } from "./dropdown.js"
import { spec } from "./factory.js"
import { Rational, zero, one } from "./rational.js"

const SELECTED_INPUT = "selected"

// events

function itemHandler(target) {
    return function(item) {
        target.itemKey = item.key
        target.item = item
        target.displayRecipes()
        spec.updateSolution()
    }
}

function removeHandler(target) {
    return function() {
        spec.removeTarget(target)
        spec.updateSolution()
    }
}

function changeBuildingCountHandler(target) {
    return function() {
        target.buildingsChanged()
        spec.updateSolution()
    }
}

function changeRateHandler(target) {
    return function() {
        target.rateChanged()
        spec.updateSolution()
    }
}

function resetSearch(dropdown) {
    dropdown.getElementsByClassName("search")[0].value = ""

    // unhide all child nodes
    let elems = dropdown.querySelectorAll("label, hr")
    for (let elem of elems) {
        elem.style.display = ""
    }
}

function searchTargets(event) {
    let search = this
    let search_text = search.value.toLowerCase().replace(/[^a-z0-9]+/g, "")
    let dropdown = d3.select(search.parentNode)

    if (!search_text) {
        resetSearch(search.parentNode)
        return
    }

    // handle enter key press (select target if only one is visible)
    if (event.keyCode === 13) {
        let labels = dropdown.selectAll("label")
            .filter(function() {
                return this.style.display !== "none"
            })
        // don't do anything if more than one icon is visible
        if (labels.size() === 1) {
            let input = document.getElementById(labels.attr("for"))
            input.checked = true
            input.dispatchEvent(new Event("change"))
        }
        return
    }

    // hide non-matching labels & icons
    let currentHrHasContent = false
    let lastHrWithContent = null
    dropdown.selectAll("hr, label").each(function(item) {
        if (this.tagName === "HR") {
            if (currentHrHasContent) {
                this.style.display = ""
                lastHrWithContent = this
            } else {
                this.style.display = "none"
            }
            currentHrHasContent = false
        } else {
            let title = item.name.toLowerCase().replace(/-/g, "")
            if (title.indexOf(search_text) === -1) {
                this.style.display = "none"
            } else {
                this.style.display = ""
                currentHrHasContent = true
            }
        }
    })
    if (!currentHrHasContent && lastHrWithContent !== null) {
        lastHrWithContent.style.display = "none"
    }
}

let targetCount = 0
let recipeSelectorCount = 0

export class BuildTarget {
    constructor(index, itemKey, item, itemGroups) {
        this.index = index
        this.itemKey = itemKey
        this.item = item
        // When item has multiple recipes.
        this.recipe = null
        this.defaultRecipe = null
        this.changedBuilding = true
        this.buildings = one
        this.rate = zero

        let element = d3.create("li")
            .classed("target", true)
        element.append("button")
            .classed("targetButton ui", true)
            .text("x")
            .attr("title", "Remove this item.")
            .on("click", removeHandler(this))
        this.element = element.node()

        let dropdown = makeDropdown(
            element,
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
        let itemLabel = addInputs(
            items,
            `target-${targetCount}`,
            d => d === item,
            itemHandler(this),
        )

        itemLabel.append(d => d.icon.make(32, false, dropdown.node()))

        targetCount++

        this.buildingLabel = element.append("label")
            .classed(SELECTED_INPUT, true)
            .text(" Buildings: ")
            .node()

        this.recipeSelector = element.append("span")

        this.buildingInput = element.append("input")
            .on("change", changeBuildingCountHandler(this))
            .attr("type", "text")
            .attr("value", 1)
            .attr("size", 3)
            .attr("title", "Enter a value to specify the number of buildings. The rate will be determined based on the number of items a single building can make.")
            .node()

        this.rateLabel = element.append("label")
            .node()
        this.setRateLabel()

        this.rateInput = element.append("input")
            .on("change", changeRateHandler(this))
            .attr("type", "text")
            .attr("value", "")
            .attr("size", 5)
            .attr("title", "Enter a value to specify the rate. The number of buildings will be determined based on the rate.")
            .node()
        this.displayRecipes()
    }
    setRateLabel() {
        this.rateLabel.textContent = " Items/" + spec.format.longRate + ": "
    }
    displayRecipes() {
        this.recipeSelector.selectAll("*").remove()
        let recipes = []
        let found = false
        if (!spec.ignore.has(this.item)) {
            for (let recipe of this.item.recipes) {
                if (spec.disable.has(recipe) || !recipe.isNetProducer(this.item)) {
                    continue
                }
                if (recipe === this.recipe) {
                    found = true
                }
                recipes.push(recipe)
            }
        }
        if (!found) {
            this.recipe = null
        }
        if (recipes.length > 0) {
            this.defaultRecipe = recipes[0]
        }
        if (recipes.length === 0) {
            this.defaultRecipe = null
            return
        } else if (recipes.length === 1) {
            this.recipe = recipes[0]
            return
        }
        // If there are multiple valid recipes, render the recipe dropdown.
        if (this.recipe === null) {
            this.recipe = recipes[0]
        }
        let self = this
        let dropdown = makeDropdown(this.recipeSelector)
        let inputs = dropdown.selectAll("div").data(recipes).join("div")
        let labels = addInputs(
            inputs,
            "target-recipe-" + recipeSelectorCount,
            d => self.recipe === d,
            d => {
                self.recipe = d
                spec.updateSolution()
            },
        )
        labels.append(d => d.icon.make(32, false, dropdown.node()))
        recipeSelectorCount++
        this.recipeSelector.append("span")
            .text(" \u00d7 ")
    }
    getRate() {
        this.setRateLabel()
        let rate = zero
        let recipe = this.recipe
        if ((recipe === null || recipe.category === null) && this.changedBuilding) {
            this.rateChanged()
        }
        let baseRate = null
        if (recipe !== null) {
            baseRate = spec.getRecipeRate(recipe)
            if (baseRate !== null) {
                baseRate = baseRate.mul(recipe.gives(this.item))
            }
        }
        if (this.changedBuilding) {
            rate = baseRate.mul(this.buildings)
            this.rateInput.value = spec.format.rate(rate)
        } else {
            rate = this.rate
            if (baseRate !== null) {
                let count = rate.div(baseRate)
                this.buildingInput.value = spec.format.count(count)
            } else {
                this.buildingInput.value = "N/A"
            }
            this.rateInput.value = spec.format.rate(rate)
        }
        return rate
    }
    buildingsChanged() {
        this.changedBuilding = true
        this.buildingLabel.classList.add(SELECTED_INPUT)
        this.rateLabel.classList.remove(SELECTED_INPUT)
        this.buildings = Rational.from_string(this.buildingInput.value)
        this.rate = zero
        this.rateInput.value = ""
    }
    setBuildings(count, recipe) {
        this.buildingInput.value = count
        this.recipe = recipe
        this.buildingsChanged()
    }
    rateChanged() {
        this.changedBuilding = false
        this.buildingLabel.classList.remove(SELECTED_INPUT)
        this.rateLabel.classList.add(SELECTED_INPUT)
        this.buildings = zero
        this.rate = Rational.from_string(this.rateInput.value).div(spec.format.rateFactor)
        this.buildingInput.value = ""
    }
    setRate(rate) {
        this.rateInput.value = rate
        this.rateChanged()
    }
}
