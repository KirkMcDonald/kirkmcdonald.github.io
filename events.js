"use strict"

function displayRateHandler(event) {
    var value = event.target.value
    displayRate = displayRates[value]
    rateName = value
    itemUpdate()
}

function plusHandler() {
    addTarget()
    itemUpdate()
}

function ItemHandler(target) {
    this.handleEvent = function(event) {
        target.itemName = event.target.value
        itemUpdate()
    }
}

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

function FactoryHandler(target) {
    this.handleEvent = function(event) {
        target.factoriesChanged()
        itemUpdate()
    }
}

function RateHandler(target) {
    this.handleEvent = function(event) {
        target.rateChanged()
        itemUpdate()
    }
}

function getMinimumValue() {
    var min = document.getElementById("minimum_assembler")
    return min.value
}

function changeMin() {
    spec.setMinimum(getMinimumValue())
    itemUpdate()
}

function changeMprod(event) {
    var bonus = event.target.value
    setMprod(bonus)
    itemUpdate()
}

function setMprod(bonus) {
    var mprod = RationalFromFloats(Number(bonus), 100)
    spec.miningProd = mprod
}

function changeSortOrder(event) {
    sortOrder = event.target.value
    itemUpdate()
}

function getFactory(recipeName) {
    var recipe = solver.recipes[recipeName]
    return spec.getFactory(recipe)
}

function ModuleHandler(factory, index) {
    this.handleEvent = function(event) {
        var moduleName = event.target.value
        var module = modules[moduleName]
        factory.setModule(index, module)
        itemUpdate()
    }
}

function ModuleCopyHandler(factory) {
    this.handleEvent = function(event) {
        var module = factory.getModule(0)
        for (var i = 0; i < factory.modules.length; i++) {
            factory.setModule(i, module)
        }
        itemUpdate()
    }
}

function BeaconHandler(recipeName) {
    this.handleEvent = function(event) {
        var moduleName = event.target.value
        var module = modules[moduleName]
        var factory = getFactory(recipeName)
        factory.beaconModule = module
        itemUpdate()
    }
}

function BeaconCountHandler(recipeName) {
    this.handleEvent = function(event) {
        var moduleCount = RationalFromFloats(event.target.value, 1)
        var factory = getFactory(recipeName)
        factory.beaconCount = moduleCount
        itemUpdate()
    }
}

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

function toggleVisible(id) {
    var elem = document.getElementById(id)
    if (elem.style.display == "none") {
        elem.style.display = "block"
    } else {
        elem.style.display = "none"
    }
}

function currentMod() {
    var elem = document.getElementById("data_set")
    return elem.value
}

function changeMod() {
    var modName = currentMod()

    reset()
    loadData(modName)
}

var currentTab = "totals_tab"

function clickTab(event, tabName) {
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
    event.currentTarget.classList.add("active")
}

function clickVisualize(event, tabName) {
    clickTab(event, tabName)
    renderGraph(globalTotals)
}

