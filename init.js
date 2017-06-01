"use strict"

function Modification(name, filename) {
    this.name = name
    this.filename = filename
}

var MODIFICATIONS = {
    "0-15-16": new Modification("Vanilla 0.15.16", "vanilla-0.15.16.json"),
    "0-15-16x": new Modification("Vanilla 0.15.16 - Expensive", "vanilla-0.15.16-expensive.json"),
}

var DEFAULT_MODIFICATION = "0-15-16"

// Contains collections of items and recipes. (solve.js)
var solver

// Contains module and factory settings, as well as other settings. (factory.js)
var spec

// Map from module name to Module object.
var modules

// Map from short module name to Module object.
var shortModules

// Array of item groups, in turn divided into subgroups. For display purposes.
var itemGroups

var initDone = false

// Set the page back to a state immediately following initial setup, but before
// the dataset is loaded for the first time.
//
// This is intended to be called when the top-level dataset is changed.
// Therefore, it also resets the fragment and settings.
function reset() {
    window.location.hash = ""

    build_targets = []
    var targetList = document.getElementById("targets")
    var plus = targetList.lastChild
    var newTargetList = document.createElement("ul")
    newTargetList.id = "targets"
    newTargetList.appendChild(plus)
    document.body.replaceChild(newTargetList, targetList)

    var oldSteps = document.getElementById("steps")
    var newSteps = document.createElement("ul")
    newSteps.id = "steps"
    oldSteps.parentNode.replaceChild(newSteps, oldSteps)

    var oldTotals = document.getElementById("totals")
    var newTotals = document.createElement("table")
    newTotals.id = "totals"
    oldTotals.parentNode.replaceChild(newTotals, oldTotals)
}

function loadDataRunner(modName, callback) {
    var xobj = new XMLHttpRequest()
    var mod = MODIFICATIONS[modName]
    if (!mod) {
        mod = MODIFICATIONS[DEFAULT_MODIFICATION]
    }
    var filename = "data/" + mod.filename
    xobj.overrideMimeType("application/json")
    xobj.open("GET", filename, true)
    xobj.onreadystatechange = function() {
        if (xobj.readyState == 4 && xobj.status == "200") {
            var data = JSON.parse(xobj.responseText)
            callback(data)
        }
    }
    xobj.send(null)
}

function loadData(modName, settings) {
    if (!settings) {
        settings = {}
    }
    if ("data" in settings && settings.data != "") {
        modName = settings.data
    }
    loadDataRunner(modName, function(data) {
        var min = "1"
        // Backward compatibility.
        if ("use_3" in settings && settings.use_3 == "true") {
            min = "3"
        }
        if ("min" in settings && (settings.min == "1" || settings.min == "2" || settings.min == "3")) {
            min = settings.min
        }
        var minDropdown = document.getElementById("minimum_assembler")
        minDropdown.value = min
        getSprites(data)
        var graph = getRecipeGraph(data)
        modules = getModules(data)
        shortModules = {}
        for (var moduleName in modules) {
            var module = modules[moduleName]
            shortModules[module.shortName()] = module
        }
        var factories = getFactories(data)
        spec = new FactorySpec(factories)
        spec.setMinimum(min)
        if ("mprod" in settings) {
            setMprod(settings.mprod)
            var mprod = document.getElementById("mprod")
            mprod.value = settings.mprod
        }
        if ("ignore" in settings) {
            var ignore = settings.ignore.split(",")
            for (var i = 0; i < ignore.length; i++) {
                spec.ignore[ignore[i]] = true
            }
        }

        var items = graph[0]
        var recipes = graph[1]
        itemGroups = getItemGroups(items, data)
        solver = new Solver(items, recipes)
        
        if ("items" in settings && settings.items != "") {
            var targets = settings.items.split(",")
            for (var i=0; i < targets.length; i++) {
                var targetString = targets[i]
                var parts = targetString.split(":")
                var name = parts[0]
                var target = addTarget(name)
                var type = parts[1]
                if (type == "f") {
                    target.setFactories(parts[2])
                } else if (type == "r") {
                    target.setRate(parts[2])
                } else {
                    throw new Error("unknown target type")
                }
            }
        } else {
            addTarget()
        }
        if ("modules" in settings && settings.modules != "") {
            var moduleSettings = settings.modules.split(",")
            for (var i=0; i < moduleSettings.length; i++) {
                var bothSettings = moduleSettings[i].split(";")
                var factoryModuleSettings = bothSettings[0]
                var beaconSettings = bothSettings[1]

                var singleModuleSettings = factoryModuleSettings.split(":")
                var recipeName = singleModuleSettings[0]
                var recipe = recipes[recipeName]
                var factory = spec.getFactory(recipe)
                var moduleNameList = singleModuleSettings.slice(1)
                for (var j=0; j < moduleNameList.length; j++) {
                    var moduleName = moduleNameList[j]
                    if (moduleName && moduleName != "null") {
                        var module
                        if (moduleName in modules) {
                            module = modules[moduleName]
                        } else if (moduleName in shortModules) {
                            module = shortModules[moduleName]
                        }
                        if (module) {
                            factory.setModule(j, module)
                        }
                    }
                }
                if (beaconSettings) {
                    beaconSettings = beaconSettings.split(":")
                    var moduleName = beaconSettings[0]
                    var module
                    if (moduleName in modules) {
                        module = modules[moduleName]
                    } else if (moduleName in shortModules) {
                        module = shortModules[moduleName]
                    }
                    if (module) {
                        var count = RationalFromFloat(Number(beaconSettings[1]))
                        factory.beaconModule = module
                        factory.beaconCount = count
                    }
                }
            }
        }
        initDone = true
        itemUpdate()
    })
}

function init() {
    var settings = loadSettings(window.location.hash)
    if ("rate" in settings) {
        rateName = settings.rate
        displayRateFactor = displayRates[settings.rate]
    }
    if ("tab" in settings) {
        currentTab = settings.tab + "_tab"
    }
    var modSelector = document.getElementById("data_set")
    for (var modName in MODIFICATIONS) {
        var mod = MODIFICATIONS[modName]
        var option = document.createElement("option")
        option.textContent = mod.name
        option.value = modName
        if (settings.data && settings.data == modName || !settings.data && modName == DEFAULT_MODIFICATION) {
            option.selected = true
        }
        modSelector.appendChild(option)
    }
    loadData(DEFAULT_MODIFICATION, settings)
    // We don't need to call clickVisualize here, as we will properly render
    // the graph when we call itemUpdate() at the end of initialization.
    clickTab(currentTab)
    addRateOptions(document.getElementById("display_rate"))
}
