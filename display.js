"use strict"

function displaySteps(reqs, steps) {
    reqs.sort(function(a, b) {
        if (a.item.name < b.item.name) {
            return -1
        } else if (a.item.name > b.item.name) {
            return 1
        } else return 0
    })
    for (var i=0; i < reqs.length; i++) {
        var req = reqs[i]
        var li = document.createElement("li")
        li.appendChild(getImage(req.item.name))
        li.appendChild(new Text(" \u00d7 "))
        var tt = document.createElement("tt")
        tt.textContent = sprintf("%.3f", req.rate.mul(displayRate).toFloat())
        li.appendChild(tt)
        steps.appendChild(li)
        if (req.dependencies.length > 0) {
            var subUL = document.createElement("ul")
            li.appendChild(subUL)
            displaySteps(req.dependencies, subUL)
        }
    }
}

var seconds = one
var minutes = RationalFromFloat(60)
var hours = RationalFromFloat(3600)

var displayRates = {
    "s": seconds,
    "m": minutes,
    "h": hours,
}
var longRateNames = {
    "s": "second",
    "m": "minute",
    "h": "hour",
}

var DEFAULT_RATE = "m"

var displayRate = displayRates[DEFAULT_RATE]
var rateName = DEFAULT_RATE

var sortOrder = "topo"

function addRateOptions(node) {
    for (var name in displayRates) {
        var rate = displayRates[name]
        var input = document.createElement("input")
        input.id = name + "_rate"
        input.type = "radio"
        input.name = "rate"
        input.value = name
        if (rate.equal(displayRate)) {
            input.checked = true
        }
        input.addEventListener("change", displayRateHandler)
        node.appendChild(input)
        var label = document.createElement("label")
        label.htmlFor = name + "_rate"
        label.textContent = "items/" + longRateNames[name]
        node.appendChild(label)
        node.appendChild(document.createElement("br"))
    }
}

function pruneSpec(totals) {
    var drop = []
    for (var name in spec.spec) {
        if (!(name in totals.totals)) {
            drop.push(name)
        }
    }
    for (var i = 0; i < drop.length; i++) {
        delete spec.spec[drop[i]]
    }
}

var globalTotals

function makeDropdown(cell, isShort) {
    var dropdown = document.createElement("div")
    dropdown.classList.add("dropdown")
    if (isShort) {
        dropdown.classList.add("shortDropdown")
    }
    cell.appendChild(dropdown)
    var form = document.createElement("form")
    dropdown.appendChild(form)
    return form
}

function makeDropdownEntry(id, form, checked, value, labelContent, handler) {
    var input = document.createElement("input")
    input.id = id
    input.name = "mod"
    input.type = "radio"
    input.value = value
    input.checked = checked
    input.addEventListener("change", handler)
    form.appendChild(input)
    var label = document.createElement("label")
    label.htmlFor = id
    label.appendChild(labelContent)
    label.title = value
    form.appendChild(label)
}

// The main top-level calculation function. Called whenever the solution
// requires recalculation.
//
// This function obtains the set of item-rates to solve for from build_targets,
// the set of modules from spec, and obtains a solution from solver. The
// factory counts are then obtained from the solution using the spec.
function itemUpdate() {
    var rates = {}
    for (var i = 0; i < build_targets.length; i++) {
        var target = build_targets[i]
        var rate = target.getRate()
        rates[target.itemName] = rate
    }
    globalTotals = solver.solve(rates, spec)
    display()
}

// Re-renders the current solution, without re-computing it.
function display() {
    var totals = globalTotals
    pruneSpec(totals)

    window.location.hash = "#" + formatSettings()

    if (currentTab == "graph_tab") {
        renderGraph(totals)
    }
    var stepTab = document.getElementById("steps_tab")

    var oldSteps = document.getElementById("steps")
    var newSteps = document.createElement("ul")
    newSteps.id = "steps"
    stepTab.replaceChild(newSteps, oldSteps)

    displaySteps(totals.reqs.dependencies, newSteps)

    var totalTab = document.getElementById("totals_tab")

    var oldTotals = document.getElementById("totals")
    var newTotals = document.createElement("table")
    newTotals.id = "totals"
    var header = document.createElement("tr")
    var headers = [
        "recipe",
        "craft/" + rateName,
        "factory count",
        "real factory count",
        "modules",
        "beacons"
    ]
    var max_modules = 4
    for (var i = 0; i < headers.length; i++) {
        var th = document.createElement("th")
        th.textContent = headers[i]
        th.style.setProperty("padding-left", "1em")
        if (headers[i] == "modules") {
            th.colSpan = max_modules + 1
        } else if (headers[i] == "beacons") {
            th.colSpan = 2
        }
        header.appendChild(th)
    }
    newTotals.appendChild(header)
    totalTab.replaceChild(newTotals, oldTotals)
    
    var downArrowShown = false
    var sorted_totals = sorted(totals.totals)
    if (sortOrder == "topo") {
        sorted_totals = totals.topo
    } else {
        sorted_totals = sorted(totals.totals)
    }
    for (var i = 0; i < sorted_totals.length; i++) {
        var recipeName = sorted_totals[i]
        var recipe = solver.recipes[recipeName]
        var rate = totals.get(recipeName)
        var row = document.createElement("tr")

        var nameCell = document.createElement("td")
        nameCell.className = "right-align"
        nameCell.appendChild(getImage(recipeName))
        row.appendChild(nameCell)

        var rateCell = document.createElement("td")
        rateCell.className = "right-align"
        rateCell.innerHTML = sprintf("<tt>%.3f</tt>", rate.mul(displayRate).toFloat())
        row.appendChild(rateCell)

        var factoryCount = spec.getCount(recipe, rate)
        if (!factoryCount.isZero()) {
            var factory = spec.getFactory(recipe)

            var factoryCell = document.createElement("td")
            var image = getImage(factory.name)
            factoryCell.appendChild(image)
            factoryCell.appendChild(new Text(sprintf(" \u00d7 %d", Math.ceil(factoryCount.toFloat()))))
            factoryCell.style.setProperty("padding-left", "1em")
            row.appendChild(factoryCell)

            var realCell = document.createElement("td")
            realCell.className = "right-align"
            realCell.innerHTML = sprintf("<tt>%.3f</tt>", factoryCount.toFloat())
            row.appendChild(realCell)

            for (var j = 0; j < factory.modules.length; j++) {
                var currentModule = factory.getModule(j)

                var modCell = document.createElement("td")
                row.appendChild(modCell)

                var form = makeDropdown(modCell)

                var handler = new ModuleHandler(factory, j)
                var noModImage = getImage("slot-icon-module")
                noModImage.title = "no module"
                makeDropdownEntry(
                    "mod-" + recipeName + "-" + j + "-nomod",
                    form,
                    !currentModule,
                    "no module",
                    noModImage,
                    handler
                )

                for (var name in modules) {
                    var module = modules[name]
                    if (!module.canUse(recipe)) {
                        continue
                    }
                    makeDropdownEntry(
                        "mod-" + recipeName + "-" + j + "-" + name,
                        form,
                        currentModule && currentModule.name == name,
                        name,
                        getImage(name),
                        handler
                    )
                }
                if (j == 0) {
                    var buttonCell = document.createElement("td")
                    row.append(buttonCell)
                    var copyButton = document.createElement("button")
                    copyButton.textContent = "\u2192"
                    copyButton.title = "copy to rest of modules"
                    copyButton.addEventListener("click", new ModuleCopyHandler(factory))
                    buttonCell.appendChild(copyButton)
                }
            }
            var dummiesNeeded = max_modules - factory.modules.length
            if (dummiesNeeded == max_modules) {
                dummiesNeeded++
            }
            for (var j = 0; j < dummiesNeeded; j++) {
                row.appendChild(document.createElement("td"))
            }

            if (factory.factory.canBeacon()) {
                var currentBeacon = factory.beaconModule
                var currentCount = factory.beaconCount

                var beaconCell = document.createElement("td")
                beaconCell.style.setProperty("padding-left", "1em")

                var beaconForm = makeDropdown(beaconCell)
                var beaconHandler = new BeaconHandler(recipeName)

                var noModImage = getImage("slot-icon-module")
                noModImage.title = "no module"
                makeDropdownEntry(
                    "mod-" + recipeName + "-beacon-nomod",
                    beaconForm,
                    !currentBeacon,
                    "no module",
                    noModImage,
                    beaconHandler
                )

                for (var name in modules) {
                    var module = modules[name]
                    // No productivity modules in beacons.
                    if (!module.productivity.isZero()) {
                        continue
                    }
                    makeDropdownEntry(
                        "mod-" + recipeName + "-beacon-" + name,
                        beaconForm,
                        currentBeacon && currentBeacon.name == name,
                        name,
                        getImage(name),
                        beaconHandler
                    )
                }
                row.appendChild(beaconCell)

                var countCell = document.createElement("td")
                var mult = document.createElement("span")
                mult.textContent = " \u00D7 "
                countCell.appendChild(mult)

                var beaconCountBox = document.createElement("input")
                beaconCountBox.addEventListener("change", new BeaconCountHandler(recipeName))
                beaconCountBox.type = "number"
                beaconCountBox.value = currentCount.toFloat()
                beaconCountBox.className = "beacon"
                beaconCountBox.title = "The number of broadcasted modules which will affect this factory."
                countCell.appendChild(beaconCountBox)
                row.appendChild(countCell)

                var downArrowCell = document.createElement("td")
                var downArrow = document.createElement("button")
                if (!downArrowShown) {
                    downArrowShown = true
                    downArrow.textContent = "\u2193"
                } else {
                    downArrow.textContent = "\u2195"
                }
                downArrow.title = "copy this recipe's modules to all other recipes"
                downArrow.addEventListener("click", new CopyAllHandler(recipeName))
                downArrowCell.appendChild(downArrow)
                row.appendChild(downArrowCell)
            }
        }

        newTotals.appendChild(row)
    }
    downArrow.textContent = "\u2191"
}
