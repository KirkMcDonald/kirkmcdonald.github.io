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

// build target events

// The "+" button to add a new target.
function plusHandler() {
    addTarget()
    itemUpdate()
}

// Triggered when the item dropdown box opens.
function resetSearch(dropdown) {
    dropdown.getElementsByClassName("search")[0].value = ""

    // unhide all child nodes
    let elems = dropdown.querySelectorAll("label, hr")
    for (let elem of elems) {
        elem.style.display = ""
    }
}

// Triggered when user is searching target
function searchTargets() {
    let ev = d3.event
    let search = this
    let search_text = search.value.toLowerCase().replace(/[^a-z0-9]+/g, "")
    let dropdown = d3.select(search.parentNode)

    if (!search_text) {
        resetSearch(search.parentNode)
        return
    }

    // handle enter key press (select target if only one is visible)
    if (ev.keyCode === 13) {
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
            let title = item.name.replace(/-/g, "")
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

// Triggered when a build target's item is changed.
function ItemHandler(target) {
    return function(item) {
        target.itemName = item.name
        target.recipeIndex = 0
        target.displayRecipes()
        itemUpdate()
    }
}

// Triggered when a build target's recipe selector is changed.
function RecipeSelectorHandler(target, i) {
    target.recipeIndex = i
    itemUpdate()
}

// The "x" button to remove a target.
function RemoveHandler(target) {
    this.handleEvent = function(event) {
        build_targets.splice(target.index, 1)
        for (var i=target.index; i < build_targets.length; i++) {
            build_targets[i].index--
        }
        target.element.remove()
        itemUpdate()
    }
}

// Triggered when a "Factories:" text box is changed.
function FactoryHandler(target) {
    this.handleEvent = function(event) {
        target.factoriesChanged()
        itemUpdate()
    }
}

// Triggered when a "Rate:" text box is changed.
function RateHandler(target) {
    this.handleEvent = function(event) {
        target.rateChanged()
        itemUpdate()
    }
}

// settings events

// Obtains current data set from UI element, and resets the world with the new
// data.
function changeMod() {
    var modName = currentMod()

    reset()
    loadData(modName)
}

function changeColor(event) {
    setColorScheme(event.target.value)
    display()
}

// Triggered when the display rate is changed.
function displayRateHandler(event) {
    var value = event.target.value
    displayRateFactor = displayRates[value]
    rateName = value
    display()
}

function changeRPrec(event) {
    ratePrecision = Number(event.target.value)
    display()
}

function changeFPrec(event) {
    countPrecision = Number(event.target.value)
    display()
}

// Triggered when the "minimum assembling machine" setting is changed.
function changeMin(min) {
    setMinimumAssembler(min)
    itemUpdate()
}

// Triggered when the furnace is changed.
function changeFurnace(furnace) {
    spec.setFurnace(furnace.name)
    solver.findSubgraphs(spec)
    itemUpdate()
}

// Triggered when the chemical plant is changed.
function changeChemicalPlant(chemPlant) {
    spec.setChemicalPlant(chemPlant.name)
    solver.findSubgraphs(spec)
    itemUpdate()
}

// Triggered when the preferred fuel is changed.
function changeFuel(fuel) {
    setPreferredFuel(fuel.name)
    solver.findSubgraphs(spec)
    itemUpdate()
}

// Triggered when the preferred oil recipe is changed.
function changeOil(oil) {
    setOilRecipe(oil.priority)
    itemUpdate()
}

// Triggered when the Kovarex checkbox is toggled.
function changeKovarex(event) {
    setKovarex(event.target.checked)
    itemUpdate()
}

// Triggered when the preferred belt is changed.
function changeBelt(belt) {
    setPreferredBelt(belt.name)
    display()
}

// Triggered when the minimum pipe length is changed.
function changePipeLength(event) {
    setMinPipe(event.target.value)
    display()
}

// Triggered when the mining productivity bonus is changed.
function changeMprod() {
    spec.miningProd = getMprod()
    itemUpdate()
}

// Triggered when the default module is changed.
function changeDefaultModule(module) {
    spec.setDefaultModule(module)
    recipeTable.updateDisplayedModules()
    itemUpdate()
}

// Triggered when the default beacon module is changed.
function changeDefaultBeacon(module) {
    spec.setDefaultBeacon(module, spec.defaultBeaconCount)
    recipeTable.updateDisplayedModules()
    itemUpdate()
}

// Triggered when the default beacon count is changed.
function changeDefaultBeaconCount(event) {
    var count = RationalFromString(event.target.value)
    spec.setDefaultBeacon(spec.defaultBeacon, count)
    recipeTable.updateDisplayedModules()
    itemUpdate()
}

// Triggered when the visualizer setting box is toggled.
function toggleVisualizerSettings() {
    let classes = document.getElementById("graph-wrapper").classList
    if (classes.contains("open")) {
        classes.remove("open")
    } else {
        classes.add("open")
    }
}

// Triggered when the visualizer type is changed.
function changeVisualizerType(event) {
    visualizer = event.target.value
    display()
}

// Triggered when the visualizer direction is changed.
function changeVisualizerDirection(event) {
    visDirection = event.target.value
    display()
}

// Triggered when the max node breadth is changed.
function changeNodeBreadth(event) {
    maxNodeHeight = Number(event.target.value)
    display()
}

// Triggered when the link length is changed.
function changeLinkLength(event) {
    linkLength = Number(event.target.value)
    display()
}

// Triggered when the recipe sort order is changed.
function changeSortOrder(event) {
    sortOrder = event.target.value
    display()
}

// Triggered when the value format (decimal vs. rational) is changed.
function changeFormat(event) {
    displayFormat = event.target.value
    display()
}

// Triggered when fancy tooltip box is toggled.
function changeTooltip(event) {
    tooltipsEnabled = event.target.checked
    display()
}

// recipe row events

function IgnoreHandler(row) {
    this.handleEvent = function(event) {
        if (spec.ignore[row.name]) {
            delete spec.ignore[row.name]
            row.setIgnore(false)
        } else {
            spec.ignore[row.name] = true
            row.setIgnore(true)
        }
        itemUpdate()
    }
}

// Triggered when a factory module is changed.
function ModuleHandler(row, index) {
    return function(module) {
        if (spec.setModule(row.recipe, index, module) || isFactoryTarget(row.recipe.name)) {
            itemUpdate()
        } else {
            display()
        }
    }
}

// Triggered when the right-arrow "copy module" button is pressed.
function ModuleCopyHandler(row) {
    this.handleEvent = function(event) {
        var moduleCount = spec.moduleCount(row.recipe)
        var module = spec.getModule(row.recipe, 0)
        var needRecalc = false
        for (var i = 0; i < moduleCount; i++) {
            needRecalc = spec.setModule(row.recipe, i, module) || needRecalc
            row.setDisplayedModule(i, module)
        }
        if (needRecalc || isFactoryTarget(row.recipe.name)) {
            itemUpdate()
        } else {
            display()
        }
    }
}

// Gets Factory object for a corresponding recipe name.
function getFactory(recipeName) {
    var recipe = solver.recipes[recipeName]
    return spec.getFactory(recipe)
}

// Triggered when a beacon module is changed.
function BeaconHandler(recipeName) {
    return function(module) {
        var factory = getFactory(recipeName)
        factory.beaconModule = module
        if (isFactoryTarget(recipeName) && !factory.beaconCount.isZero()) {
            itemUpdate()
        } else {
            display()
        }
    }
}

// Triggered when a beacon module count is changed.
function BeaconCountHandler(recipeName) {
    this.handleEvent = function(event) {
        var moduleCount = RationalFromString(event.target.value)
        var factory = getFactory(recipeName)
        factory.beaconCount = moduleCount
        if (isFactoryTarget(recipeName) && factory.beaconModule) {
            itemUpdate()
        } else {
            display()
        }
    }
}

// Triggered when the up/down arrow "copy to all recipes" button is pressed.
function CopyAllHandler(name) {
    this.handleEvent = function(event) {
        var factory = spec.spec[name]
        var needRecalc = false
        for (var recipeName in spec.spec) {
            if (recipeName == name) {
                continue
            }
            var f = spec.spec[recipeName]
            if (!f) {
                continue
            }
            var recipe = solver.recipes[recipeName]
            needRecalc = factory.copyModules(f, recipe) || needRecalc || isFactoryTarget(recipeName)
        }
        recipeTable.updateDisplayedModules()
        if (needRecalc) {
            itemUpdate()
        } else {
            display()
        }
    }
}

// breakdown events

function ToggleBreakdownHandler(itemRow, breakdown) {
    this.handleEvent = function(event) {
        if (itemRow.arrowCell.classList.contains("breakdown-open")) {
            itemRow.arrowCell.classList.remove("breakdown-open")
            breakdown.row.classList.remove("breakdown-open")
        } else {
            itemRow.arrowCell.classList.add("breakdown-open")
            breakdown.row.classList.add("breakdown-open")
        }
    }
}

// items tab events

function PipeCountHandler(config) {
    this.handleEvent = function(event) {
        config.setPipes(event.target.value)
    }
}

function PipeLengthHandler(config) {
    this.handleEvent = function(event) {
        config.setLength(event.target.value)
    }
}

// graph hover events

function GraphMouseOverHandler(node) {
    node.highlight()
}

function GraphMouseLeaveHandler(node) {
    if (node !== clickedNode) {
        node.unhighlight()
    }
}

var clickedNode = null

function GraphClickHandler(node) {
    if (node === clickedNode) {
        node.unhighlight()
        clickedNode = null
    } else if (clickedNode) {
        clickedNode.unhighlight()
        clickedNode = node
    } else {
        clickedNode = node
    }
}

// tab events

var DEFAULT_TAB = "totals_tab"

var currentTab = DEFAULT_TAB

var tabMap = {
    "totals_tab": "totals_button",
    "steps_tab": "steps_button",
    "graph_tab": "graph_button",
    "settings_tab": "settings_button",
    "about_tab": "about_button",
    "faq_tab": "faq_button",
    "debug_tab": "debug_button",
}

// Triggered when a tab is clicked on.
function clickTab(tabName) {
    currentTab = tabName
    var tabs = document.getElementsByClassName("tab")
    for (var i=0; i < tabs.length; i++) {
        tabs[i].style.display = "none"
    }

    var buttons = document.getElementsByClassName("tab_button")
    for (var i=0; i < buttons.length; i++) {
        buttons[i].classList.remove("active")
    }

    document.getElementById(tabName).style.display = "block"
    var button = document.getElementById(tabMap[tabName])
    button.classList.add("active")
    if (initDone) {
        window.location.hash = "#" + formatSettings()
    }
}

// Triggered when the "Visualize" tab is clicked on.
function clickVisualize(event, tabName) {
    clickTab(event, tabName)
    renderGraph(globalTotals, spec.ignore)
}

// debug event
function toggleDebug(event) {
    showDebug = event.target.checked
    display()
}

// utility events

function toggleVisible(targetID) {
    var target = document.getElementById(targetID)
    if (target.style.display == "none") {
        target.style.display = "block"
    } else {
        target.style.display = "none"
    }
}
