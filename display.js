"use strict"

function displayValue(x, precision) {
    if (displayFormat == "rational") {
        return x.toMixed()
    } else {
        return x.toDecimal(precision)
    }
}

function displayRate(x) {
    x = x.mul(displayRateFactor)
    return displayValue(x, ratePrecision)
}

function displayCount(x) {
    if (countPrecision == 0) {
        return x.ceil().toString()
    }
    return displayValue(x, countPrecision)
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

function Belt(name, speed) {
    this.name = name
    this.speed = RationalFromFloats(speed, 60)
}

var BELTS = [
    new Belt("transport-belt", 800),
    new Belt("fast-transport-belt", 1600),
    new Belt("express-transport-belt", 2400)
]

function displaySteps(sortedTotals, totals) {
    var stepTab = document.getElementById("steps_tab")

    var oldSteps = document.getElementById("steps")
    var node = document.createElement("table")
    node.id = "steps"
    stepTab.replaceChild(node, oldSteps)

    var order = []
    var items = {}
    for (var i = 0; i < sortedTotals.length; i++) {
        var recipeName = sortedTotals[i]
        var recipeRate = totals.totals[recipeName]
        var recipe = solver.recipes[recipeName]
        for (var j = 0; j < recipe.products.length; j++) {
            var ing = recipe.products[j]
            if (!(ing.item.name in items)) {
                order.push(ing.item.name)
                items[ing.item.name] = zero
            }
            items[ing.item.name] = items[ing.item.name].add(recipeRate.mul(recipe.gives(ing.item, spec)))
        }
    }
    var headers = [
        new Header("items/" + rateName, 2),
        new Header("belts", BELTS.length * 2)
    ]
    var header = document.createElement("tr")
    for (var i = 0; i < headers.length; i++) {
        var th = document.createElement("th")
        th.textContent = headers[i].name
        th.colSpan = headers[i].colSpan
        if (i > 0) {
            th.classList.add("pad")
        }
        header.appendChild(th)
    }
    node.appendChild(header)
    for (var i = 0; i < order.length; i++) {
        var itemName = order[i]
        var item = solver.items[itemName]
        var rate = items[itemName]
        var row = document.createElement("tr")
        node.appendChild(row)
        var iconCell = document.createElement("td")
        iconCell.appendChild(getImage(itemName))
        row.appendChild(iconCell)
        var rateCell = document.createElement("td")
        rateCell.classList.add("right-align")
        var tt = document.createElement("tt")
        tt.textContent = alignRate(rate)
        rateCell.append(tt)
        row.appendChild(rateCell)

        if (item.phase == "solid") {
            for (var j = 0; j < BELTS.length; j++) {
                var belt = BELTS[j]
                var belts = rate.div(belt.speed)
                var beltCell = document.createElement("td")
                beltCell.classList.add("pad")
                beltCell.appendChild(getImage(belt.name))
                beltCell.appendChild(new Text(" \u00d7"))
                row.appendChild(beltCell)
                var beltRateCell = document.createElement("td")
                beltRateCell.classList.add("right-align")
                tt = document.createElement("tt")
                tt.textContent = alignCount(belts)
                beltRateCell.append(tt)
                row.appendChild(beltRateCell)
            }
        }
    }
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
    this.node = document.createElement("tr")
    this.node.classList.add("recipe-row")
    if (spec.ignore[recipeName]) {
        this.node.classList.add("ignore")
    }
    parentNode.appendChild(this.node)

    var nameCell = document.createElement("td")
    nameCell.className = "right-align"
    var im = getImage(recipeName)
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
    var noModImage = getImage("slot-icon-module")
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
        if (module.category != category || sortedModules.length <= 6) {
            beaconDropdown.addBreak()
            category = module.category
        }
        this.beacon[name] = beaconDropdown.add(getImage(name), name, false)
    }
    beaconCell.appendChild(new Text(" \u00D7 "))

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
    // Call whenever the minimum factory or factory count might change (e.g. in
    // response to speed modules being added/removed).
    //
    // This may change the factory icon, factory count, number (or presence)
    // of module slots, presence of the beacon info, and/or presence of the
    // module-copy buttons.
    displayFactory: function() {
        var count = spec.getCount(this.recipe, this.rate)
        if (count.isZero()) {
            this.setHasNoModules()
            return
        }
        var factory = spec.getFactory(this.recipe)
        var image = getImage(factory.name)
        image.classList.add("display")
        while (this.factoryCell.hasChildNodes()) {
            this.factoryCell.removeChild(this.factoryCell.lastChild)
        }
        this.factoryCell.appendChild(image)
        this.factoryCell.appendChild(new Text(" \u00d7"))
        this.countNode.textContent = alignCount(count)

        var moduleDelta = factory.modules.length - this.modules.length
        if (moduleDelta < 0) {
            this.modules.length = factory.modules.length
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

                var noModImage = getImage("slot-icon-module")
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
                    if (module.category != category || sortedModules.length <= 6) {
                        category = module.category
                        dropdown.addBreak()
                    }
                    inputs[name] = dropdown.add(getImage(name), name, false)
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
        Header("")
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
            }
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
}
