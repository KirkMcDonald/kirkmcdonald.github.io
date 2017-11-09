"use strict"

// correctly handle back/forward buttons

var mouseOnPage = true
document.addEventListener("DOMContentLoaded", function() {
    document.body.addEventListener("mouseenter", function() {
        mouseOnPage = true
    });
    document.body.addEventListener("mouseleave", function() {
        mouseOnPage = false
    });
});
window.addEventListener("hashchange", function() {
    if (!mouseOnPage) {
        var settings = loadSettings(window.location.hash)
        if ("tab" in settings) {
            currentTab = settings.tab + "_tab"
        }
        if ("data" in settings && settings.data != currentMod()) {
            document.getElementById("data_set").value = settings.data
            changeMod()
        }
        renderSettings(settings)
        loadModules(settings)
        loadItems(settings, "dontChangeHash")
        clickTab(currentTab, "dontChangeHash")
    }
});

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
        // don't remove the last element
        if (build_targets.length <= 1) {
            return false;
        }
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
function changeMin(event) {
    setMinimumAssembler(event.target.value)
    itemUpdate()
}

// Triggered when the furnace is changed.
function changeFurnace(event) {
    spec.setFurnace(event.target.value)
    itemUpdate()
}

// Triggered when the preferred belt is changed.
function changeBelt(event) {
    setPreferredBelt(event.target.value)
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

function settingsAction(event) {
    var action = event.target.value
    if (action == "reset") {
        var s = {}
        s.rate = DEFAULT_RATE
        s.rp = DEFAULT_RATE_PRECISION
        s.cp = DEFAULT_COUNT_PRECISION
        s.min = DEFAULT_MINIMUM
        s.furnace = DEFAULT_FURNACE
        s.belt = DEFAULT_BELT
        s.pipe = DEFAULT_PIPE.toDecimal(0)
        s.mprod = 0
        s.vf = DEFAULT_FORMAT[0]
        renderSettings(s)
        display()
        itemUpdate()
    }
    else if (action == "load") {
        // load from localStorage
        var s = JSON.parse(localStorage.getItem("settings"))
        renderSettings(s)
        display()
        itemUpdate()
    }
    else if (action == "save") {
        // show load settings button
        var loadBtn = document.getElementById("settings_load").style.display = ""

        // get current settings
        var s = {}
        s.rate = rateName
        s.rp = ratePrecision
        s.cp = countPrecision
        s.min = minimumAssembler
        s.furnace = spec.furnace.name
        s.belt = preferredBelt
        s.pipe = minPipeLength.toDecimal(0)
        s.mprod = spec.miningProd.mul(RationalFromFloat(100)).toString()
        s.vf = displayFormat[0]

        // save the stringified version
        localStorage.setItem("settings", JSON.stringify(s))
    }
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
    this.handleEvent = function(event) {
        var moduleName = event.target.value
        var module = modules[moduleName]
        if (spec.getFactory(row.recipe).setModule(index, module) || isFactoryTarget(row.name)) {
            itemUpdate()
        } else {
            display()
        }
    }
}

// Triggered when the right-arrow "copy module" button is pressed.
function ModuleCopyHandler(row) {
    this.handleEvent = function(event) {
        var factory = spec.getFactory(row.recipe)
        var module = factory.getModule(0)
        var needRecalc = false
        for (var i = 0; i < factory.modules.length; i++) {
            needRecalc = factory.setModule(i, module) || needRecalc
            row.setDisplayedModule(i, module)
        }
        if (needRecalc || isFactoryTarget(row.name)) {
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
    this.handleEvent = function(event) {
        var moduleName = event.target.value
        var module = modules[moduleName]
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
        var moduleCount = RationalFromFloats(event.target.value, 1)
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
        for (var i = 0; i < recipeTable.rowArray.length; i++) {
            var row = recipeTable.rowArray[i]
            row.updateDisplayedModules()
        }
        if (needRecalc) {
            itemUpdate()
        } else {
            display()
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
    this.handleEvent = function(event) {
        node.highlight()
    }
}

function GraphMouseLeaveHandler(node) {
    this.handleEvent = function(event) {
        if (node !== clickedNode) {
            node.unhighlight()
        }
    }
}

var clickedNode = null

function GraphClickHandler(node) {
    this.handleEvent = function(event) {
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
function clickTab(tabName, dontChangeHash) {
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
    if (!dontChangeHash) {
        window.location.hash = "#" + formatSettings()
    }
}

// Triggered when the "Visualize" tab is clicked on.
function clickVisualize(event, tabName) {
    clickTab(event, tabName)
    renderGraph(globalTotals, spec.ignore)
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
