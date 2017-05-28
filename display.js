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
        li.innerHTML = sprintf("<tt>%.3f</tt> %s", req.rate.mul(displayRate).toFloat(), req.item.name)
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

function sorted(obj, compareFunc) {
    var keys = []
    for (var i in obj) {
        keys.push(i)
    }
    keys.sort(compareFunc)
    return keys
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
    var totals = solver.solve(rates, spec)

    window.location.hash = "#" + formatSettings()

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
        "craft/" + rateName,
        "recipe",
        "factory count",
        "real factory count",
        "modules",
        "beacons"
    ]
    var max_modules = 4
    for (var i = 0; i < headers.length; i++) {
        var th = document.createElement("th")
        th.textContent = headers[i]
        if (i == 4) {
            th.colSpan = max_modules
        }
        header.appendChild(th)
    }
    newTotals.appendChild(header)
    totalTab.replaceChild(newTotals, oldTotals)
    
    var sorted_totals = sorted(totals.totals)
    for (var i = 0; i < sorted_totals.length; i++) {
        var recipeName = sorted_totals[i]
        var recipe = solver.recipes[recipeName]
        var rate = totals.get(recipeName)
        var row = document.createElement("tr")

        var rateCell = document.createElement("td")
        rateCell.className = "right-align"
        rateCell.innerHTML = sprintf("<tt>%.3f</tt>", rate.mul(displayRate).toFloat())
        row.appendChild(rateCell)

        var nameCell = document.createElement("td")
        nameCell.className = "right-align"
        nameCell.textContent = recipeName
        row.appendChild(nameCell)

        var factoryCount = spec.getCount(recipe, rate)
        if (!factoryCount.isZero()) {
            var factory = spec.getFactory(recipe)

            var factoryCell = document.createElement("td")
            factoryCell.className = "right-align"
            factoryCell.textContent = sprintf("%s \u00d7 %d", factory.name, Math.ceil(factoryCount.toFloat()))
            row.appendChild(factoryCell)

            var realCell = document.createElement("td")
            realCell.className = "right-align"
            realCell.innerHTML = sprintf("<tt>%.3f</tt>", factoryCount.toFloat())
            row.appendChild(realCell)

            for (var j = 0; j < factory.modules.length; j++) {
                var currentModule = factory.getModule(j)

                var modCell = document.createElement("td")
                row.appendChild(modCell)

                var select = document.createElement("select")
                select.addEventListener("change", new ModuleHandler(factory, j))
                modCell.appendChild(select)

                var noMod = document.createElement("option")
                noMod.textContent = "no module"
                if (!currentModule) {
                    noMod.selected = true
                }
                select.appendChild(noMod)

                for (var name in modules) {
                    var module = modules[name]
                    if (!module.canUse(recipe)) {
                        continue
                    }
                    var option = document.createElement("option")
                    option.textContent = name
                    if (currentModule && currentModule.name == name) {
                        option.selected = true
                    }
                    select.appendChild(option)
                }
                if (j == 0) {
                    var copyButton = document.createElement("button")
                    copyButton.textContent = "\u2192"
                    copyButton.title = "copy to rest of modules"
                    copyButton.addEventListener("click", new ModuleCopyHandler(factory))
                    modCell.appendChild(copyButton)
                }
            }
            for (var j = 0; j < max_modules - factory.modules.length; j++) {
                row.appendChild(document.createElement("td"))
            }

            var currentBeacon = factory.beaconModule
            var currentCount = factory.beaconCount

            var beaconCell = document.createElement("td")

            var beaconModSelect = document.createElement("select")
            beaconModSelect.addEventListener("change", new BeaconHandler(recipeName))

            beaconCell.appendChild(beaconModSelect)

            var noBeacon = document.createElement("option")
            noBeacon.textContent = "no module"
            if (!currentBeacon) {
                noBeacon.selected = true
            }
            beaconModSelect.appendChild(noBeacon)

            for (var name in modules) {
                var module = modules[name]
                // No productivity modules in beacons.
                if (!module.productivity.isZero()) {
                    continue
                }
                var option = document.createElement("option")
                option.textContent = name
                if (currentBeacon && currentBeacon.name == name) {
                    option.selected = true
                }
                beaconModSelect.appendChild(option)
            }

            var mult = document.createElement("span")
            mult.textContent = " \u00D7 "
            beaconCell.appendChild(mult)

            var beaconCountBox = document.createElement("input")
            beaconCountBox.addEventListener("change", new BeaconCountHandler(recipeName))
            beaconCountBox.type = "number"
            beaconCountBox.value = currentCount.toFloat()
            beaconCountBox.className = "beacon"
            beaconCell.appendChild(beaconCountBox)

            row.appendChild(beaconCell)
        }

        newTotals.appendChild(row)
    }
}
