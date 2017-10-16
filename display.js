"use strict"

function displayRate(x) {
    x = x.mul(displayRateFactor)
    if (displayFormat == "rational") {
        return x.toMixed()
    } else {
        return x.toDecimal(ratePrecision)
    }
}

function displayCount(x) {
    if (displayFormat == "rational") {
        return x.toMixed()
    } else {
        return x.toUpDecimal(countPrecision)
    }
}

function align(s, prec) {
    if (displayFormat == "rational") {
        return s
    }
    var idx = s.indexOf(".")
    if (idx == -1) {
        idx = s.length
    }
    var toAdd = prec - s.length + idx + 1
    while (toAdd > 0) {
        s += "\u00A0"
        toAdd--
    }
    return s
}

function alignRate(x) {
    return align(displayRate(x), ratePrecision)
}

function alignCount(x) {
    return align(displayCount(x), countPrecision)
}

var powerSuffixes = ["\u00A0W", "kW", "MW", "GW", "TW", "PW"]

function alignPower(x) {
    var thousand = RationalFromFloat(1000)
    var i = 0
    while (thousand.less(x) && i < powerSuffixes.length - 1) {
        x = x.div(thousand)
        i++
    }
    return alignCount(x) + " " + powerSuffixes[i]
}

var sortOrder = "topo"

var globalTotals

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
    globalTotals = solver.solve(rates, spec.ignore, spec)
    display()
}

function Header(name, colSpan) {
    if (!colSpan) {
        colSpan = 1
    }
    return {"name": name, "colSpan": colSpan}
}

var NO_MODULE = "no module"

function RecipeRow(parentNode, recipeName, rate) {
    this.name = recipeName
    this.recipe = solver.recipes[recipeName]
    this.rate = rate
    this.factory = null
    this.count = zero
    this.power = zero
    this.node = document.createElement("tr")
    this.node.classList.add("recipe-row")
    if (spec.ignore[recipeName]) {
        this.node.classList.add("ignore")
    }
    parentNode.appendChild(this.node)

    var nameCell = document.createElement("td")
    nameCell.className = "right-align"
    var im = getImage(this.recipe)
    if (spec.ignore[recipeName]) {
        im.title += " (click to unignore)"
    } else {
        im.title += " (click to ignore)"
    }
    im.classList.add("display")
    im.classList.add("recipe-icon")
    im.addEventListener("click", new IgnoreHandler(this))
    this.image = im
    nameCell.appendChild(im)
    this.node.appendChild(nameCell)

    var rateCell = document.createElement("td")
    rateCell.classList.add("right-align")
    var tt = document.createElement("tt")
    rateCell.appendChild(tt)
    this.rateNode = tt
    this.node.appendChild(rateCell)

    this.factoryCell = document.createElement("td")
    this.factoryCell.classList.add("pad")
    this.node.appendChild(this.factoryCell)

    var countCell = document.createElement("td")
    countCell.classList.add("right-align")
    tt = document.createElement("tt")
    countCell.appendChild(tt)
    this.countNode = tt
    this.node.appendChild(countCell)

    this.modulesCell = document.createElement("td")
    this.modulesCell.classList.add("pad")
    this.modulesCell.classList.add("module")
    this.node.appendChild(this.modulesCell)

    this.copyButton = document.createElement("button")
    this.copyButton.classList.add("ui")
    this.copyButton.textContent = "\u2192"
    this.copyButton.title = "copy to rest of modules"
    this.copyButton.addEventListener("click", new ModuleCopyHandler(this))
    this.modulesCell.appendChild(this.copyButton)

    this.dropdowns = []
    this.modules = []

    var beaconCell = document.createElement("td")
    beaconCell.classList.add("pad")
    beaconCell.classList.add("module")
    var beaconHandler = new BeaconHandler(recipeName)
    var beaconDropdown = new Dropdown(
        beaconCell,
        "mod-" + recipeName + "-beacon",
        beaconHandler
    )
    var noModImage = getExtraImage("slot_icon_module")
    noModImage.title = NO_MODULE
    this.beacon = {}
    this.beacon[NO_MODULE] = beaconDropdown.add(noModImage, NO_MODULE, true)
    var category = ""
    for (var j = 0; j < sortedModules.length; j++) {
        var name = sortedModules[j]
        var module = modules[name]
        // No productivity modules in beacons.
        if (!module.canBeacon()) {
            continue
        }
        if (module.category != category) {
            category = module.category
            beaconDropdown.addBreak()
        }
        this.beacon[name] = beaconDropdown.add(getImage(module), name, false)
    }
    var beaconX = document.createElement("span")
    beaconX.appendChild(new Text(" \u00D7 "))
    beaconCell.appendChild(beaconX)

    this.beaconCount = document.createElement("input")
    this.beaconCount.addEventListener("change", new BeaconCountHandler(recipeName))
    this.beaconCount.type = "number"
    this.beaconCount.value = 0
    this.beaconCount.classList.add("beacon")
    this.beaconCount.title = "The number of broadcasted modules which will affect this factory."
    beaconCell.appendChild(this.beaconCount)
    this.node.appendChild(beaconCell)

    var downArrowCell = document.createElement("td")
    downArrowCell.classList.add("module")
    this.downArrow = document.createElement("button")
    this.downArrow.classList.add("ui")
    this.downArrow.textContent = "\u2195"
    this.downArrow.title = "copy this recipe's modules to all other recipes"
    this.downArrow.addEventListener("click", new CopyAllHandler(recipeName))
    downArrowCell.appendChild(this.downArrow)
    this.node.appendChild(downArrowCell)

    var powerCell = document.createElement("td")
    powerCell.classList.add("right-align")
    powerCell.classList.add("pad")
    tt = document.createElement("tt")
    powerCell.appendChild(tt)
    this.powerNode = tt
    this.node.appendChild(powerCell)

    // Set values.
    this.setIgnore(spec.ignore[recipeName])
    this.setRate(rate)
    this.setModules()
}
RecipeRow.prototype = {
    constructor: RecipeRow,
    // Call whenever this recipe's status in the ignore list changes.
    setIgnore: function(ignore) {
        if (ignore) {
            this.node.classList.add("ignore")
            this.image.title = this.name + " (click to unignore)"
        } else {
            this.node.classList.remove("ignore")
            this.image.title = this.name + " (click to ignore)"
        }
    },
    setHasModules: function() {
        this.node.classList.remove("no-mods")
    },
    setHasNoModules: function() {
        this.node.classList.add("no-mods")
    },
    hasModules: function() {
        return !this.node.classList.contains("no-mods")
    },
    setDownArrow: function() {
        this.downArrow.textContent = "\u2193"
    },
    setUpDownArrow: function() {
        this.downArrow.textContent = "\u2195"
    },
    setUpArrow: function() {
        this.downArrow.textContent = "\u2191"
    },
    setPower: function(watts) {
        this.powerNode.textContent = alignPower(watts)
    },
    csv: function() {
        var itemRate = ""
        if (this.recipe.products.length == 1) {
            var ing = this.recipe.products[0]
            if (ing.item.name == this.recipe.name) {
                var rate = this.rate.mul(this.recipe.gives(ing.item, spec))
                itemRate = displayRate(rate)
            }
        }
        var parts = [
            this.name,
            displayRate(this.rate),
            itemRate,
        ]
        if (this.count.isZero()) {
            parts.push("")
            parts.push("")
        } else {
            parts.push(this.factory.name)
            parts.push(displayCount(this.count))
        }
        if (this.factory && this.factory.modules.length > 0) {
            var modules = []
            for (var i = 0; i < this.factory.modules.length; i++) {
                var module = this.factory.modules[i]
                if (module) {
                    modules.push(module.shortName())
                } else {
                    modules.push("")
                }
            }
            parts.push(modules.join("/"))
            if (this.factory.beaconModule && !this.factory.beaconCount.isZero()) {
                parts.push(this.factory.beaconModule.shortName())
                parts.push(displayCount(this.factory.beaconCount))
            } else {
                parts.push("")
                parts.push("")
            }
        } else {
            parts.push("")
            parts.push("")
            parts.push("")
        }
        if (this.factory) {
            parts.push(displayCount(this.power))
        } else {
            parts.push("")
        }
        return parts.join(",")
    },
    // Call whenever the minimum factory or factory count might change (e.g. in
    // response to speed modules being added/removed).
    //
    // This may change the factory icon, factory count, number (or presence)
    // of module slots, presence of the beacon info, and/or presence of the
    // module-copy buttons.
    displayFactory: function() {
        this.count = spec.getCount(this.recipe, this.rate)
        if (this.count.isZero()) {
            this.setHasNoModules()
            return
        }
        this.factory = spec.getFactory(this.recipe)
        var image = getImage(this.factory.factory)
        image.classList.add("display")
        while (this.factoryCell.hasChildNodes()) {
            this.factoryCell.removeChild(this.factoryCell.lastChild)
        }
        this.factoryCell.appendChild(image)
        this.factoryCell.appendChild(new Text(" \u00d7"))
        this.countNode.textContent = alignCount(this.count)

        var moduleDelta = this.factory.modules.length - this.modules.length
        if (moduleDelta < 0) {
            this.modules.length = this.factory.modules.length
            for (var i = moduleDelta; i < 0; i++) {
                this.dropdowns.pop().remove()
            }
        } else if (moduleDelta > 0) {
            for (var i = 0; i < moduleDelta; i++) {
                var index = this.dropdowns.length
                var dropdown = new Dropdown(
                    this.modulesCell,
                    "mod-" + this.name + "-" + index,
                    new ModuleHandler(this, index)
                )
                this.dropdowns.push(dropdown)
                var inputs = {}
                this.modules.push(inputs)

                var noModImage = getExtraImage("slot_icon_module")
                noModImage.title = NO_MODULE
                var input = dropdown.add(noModImage, NO_MODULE, true)
                inputs[NO_MODULE] = input
                var category = ""

                for (var j = 0; j < sortedModules.length; j++) {
                    var name = sortedModules[j]
                    var module = modules[name]
                    if (!module.canUse(this.recipe)) {
                        continue
                    }
                    if (module.category != category) {
                        category = module.category
                        dropdown.addBreak()
                    }
                    inputs[name] = dropdown.add(getImage(module), name, false)
                }
            }
        }
        if (moduleDelta != 0) {
            if (this.dropdowns.length > 1) {
                this.modulesCell.insertBefore(this.copyButton, this.dropdowns[1].dropdown)
            } else {
                this.modulesCell.appendChild(this.copyButton)
            }
        }
        if (this.modules.length > 0) {
            this.setHasModules()
        } else {
            this.setHasNoModules()
        }
        this.power = this.factory.powerUsage(this.count)
        this.setPower(this.power)
    },
    setModules: function() {
        var factory = spec.getFactory(this.recipe)
        if (!factory) {
            return
        }
        for (var i = 0; i < factory.modules.length; i++) {
            var module = factory.modules[i]
            this.setModule(i, module)
        }
        this.setBeacon(factory.beaconModule, factory.beaconCount)
    },
    setModule: function(index, module) {
        var name
        if (module) {
            name = module.name
        } else {
            name = NO_MODULE
        }
        this.modules[index][name].checked = true
    },
    setBeacon: function(module, count) {
        var name
        if (module) {
            name = module.name
        } else {
            name = NO_MODULE
        }
        this.beacon[name].checked = true
        this.beaconCount.value = count.toString()
    },
    // Sets the new recipe-rate for a recipe, and updates the factory count.
    setRate: function(rate) {
        this.rate = rate
        this.rateNode.textContent = alignRate(rate)
        this.displayFactory()
    },
    remove: function() {
        this.node.parentElement.removeChild(this.node)
    },
}

function RecipeTable(node) {
    this.node = node
    var headers = [
        Header("recipe craft/" + rateName, 2),
        Header("factories", 2),
        Header("modules", 1),
        Header("beacons", 1),
        Header(""),
        Header("power")
    ]
    var header = document.createElement("tr")
    for (var i = 0; i < headers.length; i++) {
        var th = document.createElement("th")
        if (i == 0) {
            this.recipeHeader = th
        }
        th.textContent = headers[i].name
        th.colSpan = headers[i].colSpan
        if (i > 0) {
            th.classList.add("pad")
        }
        header.appendChild(th)
    }
    node.appendChild(header)
    this.totalRow = document.createElement("tr")
    var totalLabelCell = document.createElement("td")
    totalLabelCell.colSpan = 7
    totalLabelCell.classList.add("right-align")
    var totalLabel = document.createElement("b")
    totalLabel.textContent = "total power:"
    totalLabelCell.appendChild(totalLabel)
    this.totalRow.appendChild(totalLabelCell)
    var totalCell = document.createElement("td")
    totalCell.classList.add("right-align")
    this.totalNode = document.createElement("tt")
    totalCell.appendChild(this.totalNode)
    this.totalRow.appendChild(totalCell)

    this.rowArray = []
    this.rows = {}
}
RecipeTable.prototype = {
    constructor: RecipeTable,
    setRecipeHeader: function() {
        this.recipeHeader.textContent = "recipe craft/" + rateName
    },
    displaySolution: function(totals) {
        this.setRecipeHeader()
        var sortedTotals
        if (sortOrder == "topo") {
            sortedTotals = totals.topo
        } else {
            sortedTotals = sorted(totals.totals)
        }
        // XXX: Rework this, too.
        displaySteps(sortedTotals, totals)
        var last
        var newRowArray = []
        var downArrowShown = false
        var sameRows = true
        var i = 0
        var totalPower = zero
        var csvLines = ["recipe,rate,item rate,factory,count,modules,beacon module,beacon count,power"]
        var csvWidth = csvLines[0].length
        for (var i = 0; i < sortedTotals.length; i++) {
            var recipeName = sortedTotals[i]
            var rate = totals.get(recipeName)
            var row
            if (recipeName in this.rows) {
                row = this.rows[recipeName]
                if (sameRows && recipeName != this.rowArray[i].name) {
                    sameRows = false
                }
                // Don't rearrange the DOM if we don't need to.
                if (!sameRows) {
                    this.node.appendChild(row.node)
                }
                row.setRate(rate)
            } else {
                row = new RecipeRow(this.node, recipeName, rate)
                this.rows[recipeName] = row
                sameRows = false
            }
            totalPower = totalPower.add(row.power)
            var csvLine = row.csv()
            if (csvLine.length > csvWidth) {
                csvWidth = csvLine.length
            }
            csvLines.push(csvLine)
            newRowArray.push(row)
            if (row.hasModules()) {
                last = row
                if (downArrowShown) {
                    row.setUpDownArrow()
                } else {
                    downArrowShown = true
                    row.setDownArrow()
                }
            }
        }
        this.rowArray = newRowArray
        if (last) {
            last.setUpArrow()
        }
        var drop = []
        for (var recipeName in this.rows) {
            if (!(recipeName in totals.totals)) {
                drop.push(recipeName)
            }
        }
        for (var i = 0; i < drop.length; i++) {
            this.rows[drop[i]].remove()
            delete this.rows[drop[i]]
        }
        this.node.appendChild(this.totalRow)
        this.totalNode.textContent = alignPower(totalPower)
        var csv = document.getElementById("csv")
        csv.value = csvLines.join("\n") + "\n"
        csv.cols = csvWidth + 2
        csv.rows = csvLines.length + 2
    },
    getRow: function(recipeName) {
        return this.rows[recipeName]
    },
}

// Re-renders the current solution, without re-computing it.
function display() {
    // Update the display of the target rate text boxes, if needed.
    for (var i = 0; i < build_targets.length; i++) {
        build_targets[i].getRate()
    }
    var totals = globalTotals

    window.location.hash = "#" + formatSettings()

    if (currentTab == "graph_tab") {
        renderGraph(totals, spec.ignore)
    }
    recipeTable.displaySolution(totals)
    renderDebug()
}
