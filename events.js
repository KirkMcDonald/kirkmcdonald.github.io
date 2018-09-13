"use strict"

// build target events

// The "+" button to add a new target.
function plusHandler() {
    addTarget()
    itemUpdate()
}

// Triggered when mouse enters the dropdown box
function resetSearch(ev) {
    ev.target.getElementsByClassName("search")[0].value = ""

    // unhide all child nodes
    var elems = ev.target.querySelectorAll("label, br, hr")
    for (var i = 0; i < elems.length; i++) {
        elems[i].style.display = ""
    }
}

// Triggered when user is searching target
function searchTargets(ev) {
    var search = ev.target
    var search_text = search.value.toLowerCase().replace(/[^a-z0-9]+/g, "")

    if (!search_text) {
        resetSearch({target: search.parentNode})
        return
    }

    // handle enter key press (select target if only one is visible)
    if (ev.keyCode === 13) {
        var visibleLabels = [];
        var labels = search.parentNode.getElementsByTagName("label")
        for (var i = 0; i < labels.length; i++) {
            var label = labels[i]
            if (label.style.display != "none") {
                visibleLabels.push(label)
            }
        }
        // don't do anything if more than one icon is visible
        if (visibleLabels.length === 1) {
            var item = visibleLabels[0].title
            var selector = "input[value=" + item + "]"
            var input = search.parentNode.querySelector(selector)
            input.checked = true
            input.dispatchEvent(new Event("change"))
        }
        return
    }

    var elems = search.parentNode.querySelectorAll("hr, br, label")
    var currentHrHasContent, currentBrHasContent;
    var lastHrWithContent;
    // hide non-matching labels & icons
    for (var i = 0; i < elems.length; i++) {
        var elem = elems[i]
        if (elem.tagName === "HR") {
            if (currentHrHasContent) {
                elem.style.display = ""
                lastHrWithContent = elem
            }
            else {
                elem.style.display = "none"
            }
            currentHrHasContent = false
            currentBrHasContent = false
        }
        else if (elem.tagName === "BR") {
            if (currentBrHasContent) {
                elem.style.display = ""
            }
            else {
                elem.style.display = "none"
            }
            currentBrHasContent = false
        }
        else {
            var input = document.getElementById(elem.htmlFor)
            var title = input.value.replace(/-/g, "")
            // if title contains the search phrase
            if (title.indexOf(search_text) != -1) {
                elem.style.display = ""
                currentHrHasContent = true
                currentBrHasContent = true
            }
            else {
                elem.style.display = "none"
            }
        }
    }
    // hide trailing horizonal rule
    if (lastHrWithContent) {
        lastHrWithContent.style.display = "none"
    }
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
function changeMin(event) {
    setMinimumAssembler(event.target.value)
    itemUpdate()
}

// Triggered when the furnace is changed.
function changeFurnace(event) {
    spec.setFurnace(event.target.value)
    solver.findSubgraphs(spec)
    itemUpdate()
}

// Triggered when the preferred fuel is changed.
function changeFuel(event) {
    setPreferredFuel(event.target.value)
    solver.findSubgraphs(spec)
    itemUpdate()
}

// Triggered when the preferred oil recipe is changed.
function changeOil(event) {
    setOilRecipe(event.target.value)
    itemUpdate()
}

// Triggered when the Kovarex checkbox is toggled.
function changeKovarex(event) {
    setKovarex(event.target.checked)
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

// Triggered when the default module is changed.
function changeDefaultModule(event) {
    var module
    if (event.target.value === NO_MODULE) {
        module = null
    } else {
        module = shortModules[event.target.value]
    }
    spec.setDefaultModule(module)
    recipeTable.updateDisplayedModules()
    itemUpdate()
}

// Triggered when the default beacon module is changed.
function changeDefaultBeacon(event) {
    var module
    if (event.target.value === NO_MODULE) {
        module = null
    } else {
        module = shortModules[event.target.value]
    }
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
    this.handleEvent = function(event) {
        var moduleName = event.target.value
        var module
        if (moduleName === NO_MODULE) {
            module = null
        } else {
            module = modules[moduleName]
        }
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
    this.handleEvent = function(event) {
        var moduleName = event.target.value
        var module
        if (moduleName === NO_MODULE) {
            module = null
        } else {
            module = modules[moduleName]
        }
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
