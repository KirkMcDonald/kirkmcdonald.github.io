"use strict"

// build target events

// The "+" button to add a new target.
function plusHandler() {
    addTarget()
    itemUpdate()
}

// Triggered when a build target's item is changed.
function ItemHandler(target) {
    this.handleEvent = function(event) {
        target.itemName = event.target.value
        itemUpdate()
    }
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

// Obtains the current "minimum assembling machine" setting.
function getMinimumValue() {
    var min = document.getElementById("minimum_assembler")
    return min.value
}

// Triggered when the "minimum assembling machine" setting is changed.
function changeMin() {
    spec.setMinimum(getMinimumValue())
    itemUpdate()
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

// Triggered when the mining productivity bonus is changed.
function changeMprod(event) {
    var bonus = event.target.value
    setMprod(bonus)
    itemUpdate()
}

// Called to change the mining productivity bonus (on init or event).
function setMprod(bonus) {
    var mprod = RationalFromFloats(Number(bonus), 100)
    spec.miningProd = mprod
}

// Triggered when the recipe sort order is changed.
function changeSortOrder(event) {
    sortOrder = event.target.value
    itemUpdate()
}

// Returns currently-selected data set.
function currentMod() {
    var elem = document.getElementById("data_set")
    return elem.value
}

// Obtains current data set from UI element, and resets the world with the new
// data.
function changeMod() {
    var modName = currentMod()

    reset()
    loadData(modName)
}

function changeFormat(event) {
    displayFormat = event.target.value
    display()
}

// recipe row events

function IgnoreHandler(recipeName) {
    this.handleEvent = function(event) {
        if (spec.ignore[recipeName]) {
            delete spec.ignore[recipeName]
        } else {
            spec.ignore[recipeName] = true
        }
        itemUpdate()
    }
}

// Triggered when a factory module is changed.
function ModuleHandler(factory, index) {
    this.handleEvent = function(event) {
        var moduleName = event.target.value
        var module = modules[moduleName]
        factory.setModule(index, module)
        itemUpdate()
    }
}

// Triggered when the right-arrow "copy module" button is pressed.
function ModuleCopyHandler(factory) {
    this.handleEvent = function(event) {
        var module = factory.getModule(0)
        for (var i = 0; i < factory.modules.length; i++) {
            factory.setModule(i, module)
        }
        itemUpdate()
    }
}

// Gets Factory object for a corresponding recipe name.
function getFactory(recipeName) {
    var recipe = solver.recipes[recipeName]
    return spec.getFactory(recipe)
}

// Triggered when a beacon module is changed.
function BeaconHandler(recipeName) {
    this.handleEvent = function(event) {
        var moduleName = event.target.value
        var module = modules[moduleName]
        var factory = getFactory(recipeName)
        factory.beaconModule = module
        itemUpdate()
    }
}

// Triggered when a beacon module count is changed.
function BeaconCountHandler(recipeName) {
    this.handleEvent = function(event) {
        var moduleCount = RationalFromFloats(event.target.value, 1)
        var factory = getFactory(recipeName)
        factory.beaconCount = moduleCount
        itemUpdate()
    }
}

// Triggered when the up/down arrow "copy to all recipes" button is pressed.
function CopyAllHandler(name) {
    this.handleEvent = function(event) {
        var factory = spec.spec[name]
        for (var recipeName in spec.spec) {
            if (recipeName == name) {
                continue
            }
            var f = spec.spec[recipeName]
            if (!f) {
                continue
            }
            var recipe = solver.recipes[recipeName]
            factory.copyModules(f, recipe)
        }
        itemUpdate()
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

