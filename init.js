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
// Array of arrays of modules, separated by category and sorted.
var moduleRows

// Array of Belt objects, sorted by speed.
var belts

// Array of Fuel objects, sorted by value.
var fuel

// Array of item groups, in turn divided into subgroups. For display purposes.
var itemGroups

// Boolean with whether to use old (0.16) calculations.
var useLegacyCalculations

// Size of the sprite sheet, as [x, y] array.
var spriteSheetSize

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
    var targetParent = document.getElementById("targetparent")
    targetParent.replaceChild(newTargetList, targetList)

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
    spriteSheetSize = mod.sheetSize
    useLegacyCalculations = mod.legacy
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
        moduleRows = []
        let category = null
        for (let moduleName of sortedModules) {
            let module = modules[moduleName]
            if (module.category !== category) {
                category = module.category
                moduleRows.push([])
            }
            moduleRows[moduleRows.length - 1].push(module)
        }
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

        belts = getBelts(data)
        fuel = getFuel(data, items)["chemical"]

        itemGroups = getItemGroups(items, data)
        solver = new Solver(items, recipes)

        renderSettings(settings)

        solver.findSubgraphs(spec)

        if ("items" in settings && settings.items != "") {
            var targets = settings.items.split(",")
            for (var i=0; i < targets.length; i++) {
                var targetString = targets[i]
                var parts = targetString.split(":")
                var name = parts[0]
                var target = addTarget(name)
                var type = parts[1]
                if (type == "f") {
                    var j = parts[2].indexOf(";")
                    if (j === -1) {
                        target.setFactories(0, parts[2])
                    } else {
                        var count = parts[2].slice(0, j)
                        var idx = Number(parts[2].slice(j+1))
                        target.setFactories(idx, count)
                        target.displayRecipes()
                    }
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
                    if (moduleName) {
                        var module
                        if (moduleName in modules) {
                            module = modules[moduleName]
                        } else if (moduleName in shortModules) {
                            module = shortModules[moduleName]
                        } else if (moduleName === "null") {
                            module = null
                        }
                        if (module !== undefined) {
                            spec.setModule(recipe, j, module)
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
                    } else if (moduleName === "null") {
                        module = null
                    }
                    var factory = spec.getFactory(recipe)
                    if (factory) {
                        var count = RationalFromFloat(Number(beaconSettings[1]))
                        factory.beaconModule = module
                        factory.beaconCount = count
                    }
                }
            }
        }
        initDone = true
        itemUpdate()

        // Prune factory spec after first solution is calculated.
        pruneSpec(globalTotals)
        window.location.hash = "#" + formatSettings()
    })
}

function init() {
    var settings = loadSettings(window.location.hash)
    if (OVERRIDE !== null) {
        addOverrideOptions(OVERRIDE)
    }
    renderDataSetOptions(settings)
    if ("tab" in settings) {
        currentTab = settings.tab + "_tab"
    }
    loadData(currentMod(), settings)
    // We don't need to call clickVisualize here, as we will properly render
    // the graph when we call itemUpdate() at the end of initialization.
    clickTab(currentTab)
}
