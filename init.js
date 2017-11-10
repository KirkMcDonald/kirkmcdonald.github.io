"use strict"

var recipeTable

// Contains collections of items and recipes. (solve.js)
var solver

// Contains module and factory settings, as well as other settings. (factory.js)
var spec

// Map from module name to Module object.
var modules
// Array of modules, sorted by 'order'.
var sortedModules
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
    newTargetList.classList.add("targets")
    newTargetList.appendChild(plus)
    document.body.replaceChild(newTargetList, targetList)

    var oldSteps = document.getElementById("steps")
    var newSteps = document.createElement("table")
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
    recipeTable = new RecipeTable(document.getElementById("totals"))
    if (!settings) {
        settings = {}
    }
    loadDataRunner(modName, function(data) {
        getSprites(data)
        var graph = getRecipeGraph(data)
        modules = getModules(data)
        sortedModules = sorted(modules, function(m) { return modules[m].order })
        shortModules = {}
        for (var moduleName in modules) {
            var module = modules[moduleName]
            shortModules[module.shortName()] = module
        }
        var factories = getFactories(data)
        spec = new FactorySpec(factories)
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

        renderSettings(settings)

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
                            spec.setModule(recipe, j, module)
                        }
                    }
                }
                if (beaconSettings) {
                    beaconSettings = beaconSettings.split(":")
                    var moduleName = beaconSettings[0]
                    var module = null
                    if (moduleName in modules) {
                        module = modules[moduleName]
                    } else if (moduleName in shortModules) {
                        module = shortModules[moduleName]
                    }
                    var factory = spec.getFactory(recipe)
                    var count = RationalFromFloat(Number(beaconSettings[1]))
                    if (module === spec.defaultBeacon) {
                        module = null
                    }
                    factory.beaconModule = module
                    factory.beaconCount = count
                }
            }
        }
        initDone = true
        itemUpdate()
    })
}

function init() {
    var settings = loadSettings(window.location.hash)
    renderDataSetOptions(settings)
    if ("tab" in settings) {
        currentTab = settings.tab + "_tab"
    }
    loadData(currentMod(), settings)
    // We don't need to call clickVisualize here, as we will properly render
    // the graph when we call itemUpdate() at the end of initialization.
    clickTab(currentTab)
}
