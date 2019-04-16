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

function formatName(name) {
    name = name.replace(new RegExp("-", 'g'), " ")
    return name[0].toUpperCase() + name.slice(1)
}

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
    var toAdd = prec - s.length + idx
    if (prec > 0) {
        toAdd += 1
    }
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

function alignPower(x, prec) {
    if (prec === undefined) {
        prec = countPrecision
    }
    var thousand = RationalFromFloat(1000)
    var i = 0
    while (thousand.less(x) && i < powerSuffixes.length - 1) {
        x = x.div(thousand)
        i++
    }
    return align(displayCount(x), prec) + " " + powerSuffixes[i]
}

var sortOrder = "topo"

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
    drop = []
    for (var name in spec.ignore) {
        if (!(name in totals.totals)) {
            drop.push(name)
        }
    }
    for (var i = 0; i < drop.length; i++) {
        delete spec.ignore[drop[i]]
    }
}

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

function pipeValues(rate) {
    var pipes = rate.div(maxPipeThroughput).ceil()
    var perPipeRate = rate.div(pipes)
    var length = pipeLength(perPipeRate).floor()
    return {pipes: pipes, length: length}
}

function ItemIcon(item, canIgnore) {
    this.item = item
    this.name = item.name
    this.extra = null
    if (canIgnore) {
        this.extra = document.createElement("span")
        this.span = document.createElement("span")
        this.extra.appendChild(this.span)
        this.extra.appendChild(document.createElement("br"))
    }
    this.icon_col = item.icon_col
    this.icon_row = item.icon_row
}
ItemIcon.prototype = {
    constructor: ItemIcon,
    setText: function(text) {
        this.span.textContent = text
    },
    renderTooltip: function() {
        return this.item.renderTooltip(this.extra)
    }
}

function BeltIcon(beltItem, beltSpeed) {
    if (!beltItem) {
        beltItem = solver.items[preferredBelt]
    }
    if (!beltSpeed) {
        beltSpeed = preferredBeltSpeed
    }
    this.item = beltItem
    this.speed = beltSpeed
    this.name = this.item.name
    this.icon_col = this.item.icon_col
    this.icon_row = this.item.icon_row
}
BeltIcon.prototype = {
    constructor: BeltIcon,
    renderTooltip: function() {
        var t = document.createElement("div")
        t.classList.add("frame")
        var title = document.createElement("h3")
        var im = getImage(this, true)
        title.appendChild(im)
        title.appendChild(new Text(formatName(this.name)))
        t.appendChild(title)
        var b = document.createElement("b")
        b.textContent = "Max throughput: "
        t.appendChild(b)
        t.appendChild(new Text(displayRate(this.speed) + " items/" + rateName))
        return t
    }
}

function ItemRow(row, item, canIgnore) {
    this.item = item
    var nameCell = document.createElement("td")
    nameCell.className = "right-align"
    this.itemIcon = new ItemIcon(item, canIgnore)
    var im = getImage(this.itemIcon)
    im.classList.add("display")
    if (canIgnore) {
        if (spec.ignore[item.name]) {
            this.itemIcon.setText("(Click to unignore.)")
        } else {
            this.itemIcon.setText("(Click to ignore.)")
        }
        im.classList.add("recipe-icon")
    }
    this.image = im
    nameCell.appendChild(im)
    row.appendChild(nameCell)

    var rateCell = document.createElement("td")
    rateCell.classList.add("right-align", "pad-right")
    var tt = document.createElement("tt")
    rateCell.appendChild(tt)
    this.rateNode = tt
    row.appendChild(rateCell)

    if (item.phase == "solid") {
        this.beltCell = document.createElement("td")
        row.appendChild(this.beltCell)
        var beltCountCell = document.createElement("td")
        beltCountCell.classList.add("right-align", "pad-right")
        this.beltCountNode = document.createElement("tt")
        beltCountCell.appendChild(this.beltCountNode)
        row.appendChild(beltCountCell)
    // Wire off pipe icon in 0.17 for now.
    } else if (item.phase == "fluid" && useLegacyCalculations) {
        var pipeCell = document.createElement("td")
        pipeCell.colSpan = 2
        pipeCell.classList.add("pad-right")
        row.appendChild(pipeCell)
        var pipeItem = solver.items["pipe"]
        pipeCell.appendChild(getImage(pipeItem, true))
        this.pipeNode = document.createElement("tt")
        pipeCell.appendChild(this.pipeNode)
    } else {
        row.appendChild(document.createElement("td"))
        row.appendChild(document.createElement("td"))
    }

    var wasteCell = document.createElement("td")
    wasteCell.classList.add("right-align", "pad-right", "waste")
    tt = document.createElement("tt")
    wasteCell.appendChild(tt)
    this.wasteNode = tt
    row.appendChild(wasteCell)
}
ItemRow.prototype = {
    constructor: ItemRow,
    setIgnore: function(ignore) {
        if (ignore) {
            this.itemIcon.setText("(Click to unignore.)")
        } else {
            this.itemIcon.setText("(Click to ignore.)")
        }
    },
    setBelt: function(itemRate) {
        while (this.beltCell.hasChildNodes()) {
            this.beltCell.removeChild(this.beltCell.lastChild)
        }
        var beltImage = getImage(new BeltIcon())
        this.beltCell.appendChild(beltImage)
        this.beltCell.appendChild(new Text(" \u00d7"))
        var beltCount = itemRate.div(preferredBeltSpeed)
        this.beltCountNode.textContent = alignCount(beltCount)
    },
    setPipe: function(itemRate) {
        // 0.17 changes these fluid calculations, but the new model is not yet
        // fully known. Wire it off in 0.17 for now.
        if (useLegacyCalculations) {
            if (itemRate.equal(zero)) {
                this.pipeNode.textContent = " \u00d7 0"
                return
            }
            var pipe = pipeValues(itemRate)
            var pipeString = ""
            if (one.less(pipe.pipes)) {
                pipeString += " \u00d7 " + pipe.pipes.toDecimal(0)
            }
            pipeString += " \u2264 " + pipe.length.toDecimal(0)
            this.pipeNode.textContent = pipeString
        }
    },
    setRate: function(itemRate, waste) {
        this.rateNode.textContent = alignRate(itemRate)
        this.wasteNode.textContent = alignRate(waste)
        if (this.item.phase == "solid") {
            this.setBelt(itemRate)
        } else if (this.item.phase == "fluid") {
            this.setPipe(itemRate)
        }
    },
}

function makePopOutCell() {
    var popOutCell = document.createElement("td")
    popOutCell.classList.add("pad")
    var popOutLink = document.createElement("a")
    popOutLink.target = "_blank"
    popOutLink.title = "Open this item in separate window."
    popOutCell.appendChild(popOutLink)
    var popOutSVG = document.createElementNS("http://www.w3.org/2000/svg", "svg")
    popOutSVG.classList.add("popout")
    popOutSVG.setAttribute("viewBox", "0 0 24 24")
    popOutSVG.setAttribute("width", "16")
    popOutSVG.setAttribute("height", "16")
    popOutLink.appendChild(popOutSVG)
    var popOutUse = document.createElementNS("http://www.w3.org/2000/svg", "use")
    popOutUse.setAttribute("href", "images/icons.svg#popout")
    popOutSVG.appendChild(popOutUse)
    return popOutCell
}

function RecipeRow(recipeName, rate, itemRate, waste) {
    this.name = recipeName
    this.recipe = solver.recipes[recipeName]
    this.rate = rate
    this.node = document.createElement("tr")
    this.node.classList.add("recipe-row")
    this.node.classList.add("display-row")
    var canIgnore = this.recipe.canIgnore()
    if (spec.ignore[recipeName]) {
        if (!canIgnore) {
            delete spec.ignore[recipeName]
        } else {
            this.node.classList.add("ignore")
        }
    }

    this.item = this.recipe.products[0].item
    this.itemRow = new ItemRow(this.node, this.item, canIgnore)
    if (canIgnore) {
        this.itemRow.image.addEventListener("click", new IgnoreHandler(this))
    }

    this.factoryRow = new FactoryRow(this.node, this.recipe, this.rate)

    var popOutCell = makePopOutCell()
    this.node.appendChild(popOutCell)
    this.popOutLink = popOutCell.firstChild

    // Set values.
    if (canIgnore) {
        this.setIgnore(spec.ignore[recipeName])
    }
    this.setRate(rate, itemRate, waste)
    this.factoryRow.updateDisplayedModules()
}
RecipeRow.prototype = {
    constructor: RecipeRow,
    appendTo: function(parentNode) {
        parentNode.appendChild(this.node)
    },
    // Call whenever this recipe's status in the ignore list changes.
    setIgnore: function(ignore) {
        if (ignore) {
            this.node.classList.add("ignore")
        } else {
            this.node.classList.remove("ignore")
        }
        this.itemRow.setIgnore(ignore)
    },
    hasModules: function() {
        return !this.node.classList.contains("no-mods")
    },
    setDownArrow: function() {
        this.factoryRow.downArrow.textContent = "\u2193"
    },
    setUpDownArrow: function() {
        this.factoryRow.downArrow.textContent = "\u2195"
    },
    setUpArrow: function() {
        this.factoryRow.downArrow.textContent = "\u2191"
    },
    updateDisplayedModules: function() {
        this.factoryRow.updateDisplayedModules()
    },
    totalPower: function() {
        if (this.factoryRow.power && this.factoryRow.power.fuel === "electric") {
            return this.factoryRow.power.power
        }
        return zero
    },
    csv: function() {
        var rate = this.rate.mul(this.recipe.gives(this.item, spec))
        var parts = [
            this.name,
            displayRate(rate),
        ]
        parts = parts.concat(this.factoryRow.csv())
        return [parts.join(",")]
    },
    // Sets the new recipe-rate for a recipe, and updates the factory count.
    setRate: function(recipeRate, itemRate, waste) {
        this.rate = recipeRate
        this.itemRow.setRate(itemRate, waste)
        this.factoryRow.displayFactory(recipeRate)
        var rate = {}
        rate[this.item.name] = itemRate
        var link = "#" + formatSettings(rate)
        this.popOutLink.href = link
    },
    setRates: function(totals, items) {
        var recipeRate = totals.get(this.name)
        var itemRate = items[this.item.name]
        var waste = totals.getWaste(this.item.name)
        this.setRate(recipeRate, itemRate, waste)
    },
    remove: function() {
        this.node.parentElement.removeChild(this.node)
    },
}

function FactoryRow(row, recipe) {
    this.node = row
    var recipeName = recipe.name
    this.recipe = recipe
    this.factory = null
    this.count = zero
    this.power = null

    this.factoryCell = document.createElement("td")
    this.factoryCell.classList.add("pad", "factory", "right-align", "leftmost")
    this.node.appendChild(this.factoryCell)

    var countCell = document.createElement("td")
    countCell.classList.add("factory", "right-align")
    var tt = document.createElement("tt")
    countCell.appendChild(tt)
    this.countNode = tt
    this.node.appendChild(countCell)

    this.modulesCell = document.createElement("td")
    this.modulesCell.classList.add("pad", "module", "factory")
    this.node.appendChild(this.modulesCell)

    this.copyButton = document.createElement("button")
    this.copyButton.classList.add("ui", "copy")
    this.copyButton.textContent = "\u2192"
    this.copyButton.title = "copy to rest of modules"
    this.copyButton.addEventListener("click", new ModuleCopyHandler(this))
    this.modulesCell.appendChild(this.copyButton)

    this.dropdowns = []
    this.modules = []

    var beaconCell = document.createElement("td")
    beaconCell.classList.add("pad", "module", "factory")
    let {inputs} = moduleDropdown(
        d3.select(beaconCell),
        "mod-" + recipeName + "-beacon",
        d => d === null,
        BeaconHandler(recipeName),
        d => d === null || d.canBeacon(),
    )
    this.beacon = inputs
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
    downArrowCell.classList.add("module", "factory")
    this.downArrow = document.createElement("button")
    this.downArrow.classList.add("ui")
    this.downArrow.textContent = "\u2195"
    this.downArrow.title = "copy this recipe's modules to all other recipes"
    this.downArrow.addEventListener("click", new CopyAllHandler(recipeName))
    downArrowCell.appendChild(this.downArrow)
    this.node.appendChild(downArrowCell)

    this.fuelCell = document.createElement("td")
    this.fuelCell.classList.add("pad", "factory")
    this.node.appendChild(this.fuelCell)
    var powerCell = document.createElement("td")
    powerCell.classList.add("factory", "right-align")
    tt = document.createElement("tt")
    powerCell.appendChild(tt)
    this.powerNode = tt
    this.node.appendChild(powerCell)
}
FactoryRow.prototype = {
    constructor: FactoryRow,
    setPower: function(power) {
        while (this.fuelCell.hasChildNodes()) {
            this.fuelCell.removeChild(this.fuelCell.lastChild)
        }
        if (power.fuel === "electric") {
            this.powerNode.textContent = alignPower(power.power)
        } else if (power.fuel === "chemical") {
            var fuelImage = getImage(preferredFuel)
            this.fuelCell.appendChild(fuelImage)
            this.fuelCell.appendChild(new Text(" \u00d7"))
            this.powerNode.textContent = alignRate(power.power.div(preferredFuel.value)) + "/" + rateName
        }
    },
    setHasModules: function() {
        this.node.classList.remove("no-mods")
    },
    setHasNoModules: function() {
        this.node.classList.add("no-mods")
    },
    // Call whenever the minimum factory or factory count might change (e.g. in
    // response to speed modules being added/removed).
    //
    // This may change the factory icon, factory count, number (or presence)
    // of module slots, presence of the beacon info, and/or presence of the
    // module-copy buttons.
    displayFactory: function(rate) {
        this.count = spec.getCount(this.recipe, rate)
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
        if (this.recipe.displayGroup !== null || this.recipe.name !== this.recipe.products[0].item.name) {
            this.factoryCell.appendChild(getImage(this.recipe))
            this.factoryCell.appendChild(new Text(" : "))
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
                let self = this
                var index = this.dropdowns.length
                var installedModule = this.factory.modules[index]
                let {dropdown, inputs} = moduleDropdown(
                    d3.select(this.modulesCell),
                    "mod-" + this.recipe.name + "-" + index,
                    d => d === installedModule,
                    ModuleHandler(this, index),
                    d => d === null || d.canUse(self.recipe),
                )
                this.dropdowns.push(dropdown.parentNode)
                this.modules.push(inputs)
            }
        }
        if (moduleDelta != 0) {
            if (this.dropdowns.length > 1) {
                this.modulesCell.insertBefore(this.copyButton, this.dropdowns[1])
            } else {
                this.modulesCell.appendChild(this.copyButton)
            }
        }
        if (this.modules.length > 0) {
            this.setHasModules()
        } else {
            this.setHasNoModules()
        }
        this.power = this.factory.powerUsage(spec, this.count)
        this.setPower(this.power)
    },
    updateDisplayedModules: function() {
        var moduleCount = spec.moduleCount(this.recipe)
        if (moduleCount === 0) {
            return
        }
        for (var i = 0; i < moduleCount; i++) {
            var module = spec.getModule(this.recipe, i)
            this.setDisplayedModule(i, module)
        }
        // XXX
        var beacon = spec.getBeaconInfo(this.recipe)
        this.setDisplayedBeacon(beacon.module, beacon.count)
    },
    setDisplayedModule: function(index, module) {
        var name
        if (module) {
            name = module.name
        } else {
            name = NO_MODULE
        }
        this.modules[index][name].checked = true
    },
    setDisplayedBeacon: function(module, count) {
        var name
        if (module) {
            name = module.name
        } else {
            name = NO_MODULE
        }
        this.beacon[name].checked = true
        this.beaconCount.value = count.toString()
    },
    csv: function() {
        var parts = []
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
            parts.push(displayCount(this.power.power))
        } else {
            parts.push("")
        }
        return parts.join(",")
    },
}

function GroupRow(group, itemRates, totals) {
    this.name = group.id
    this.group = group
    this.items = {}
    for (var i = 0; i < group.recipes.length; i++) {
        var recipe = group.recipes[i]
        for (var j = 0; j < recipe.products.length; j++) {
            var ing = recipe.products[j]
            this.items[ing.item.name] = ing.item
        }
    }
    this.itemNames = Object.keys(this.items)
    var recipeCount = group.recipes.length
    var tableRows = Math.max(this.itemNames.length, recipeCount)
    this.rows = []
    this.itemRows = []
    this.itemRates = []
    this.factoryRows = []
    for (var i = 0; i < tableRows; i++) {
        var row = document.createElement("tr")
        row.classList.add("display-row")
        row.classList.add("group-row")
        if (i < this.itemNames.length) {
            this.itemRows.push(new ItemRow(row, this.items[this.itemNames[i]], false))
        } else {
            row.appendChild(document.createElement("td"))
            row.appendChild(document.createElement("td"))
            row.appendChild(document.createElement("td"))
            row.appendChild(document.createElement("td"))
            var dummyWaste = document.createElement("td")
            dummyWaste.classList.add("waste")
            row.appendChild(dummyWaste)
        }
        if (i < recipeCount) {
            var recipe = group.recipes[i]
            this.factoryRows.push(new FactoryRow(row, recipe, totals.get(recipe.name)))
        } else {
            for (var j = 0; j < 7; j++) {
                var cell = document.createElement("td")
                cell.classList.add("factory")
                if (j == 0) {
                    cell.classList.add("leftmost")
                }
                row.appendChild(cell)
            }
        }
        this.rows.push(row)
        // TODO: Making this work properly with GroupRow reqires a little more
        //       thought. Dummy it out for now.
        /*if (i === 0) {
            var popOutCell = makePopOutCell()
            row.appendChild(popOutCell)
            this.popOutLink = popOutCell.firstChild
        } else {*/
            row.appendChild(document.createElement("td"))
        /*}*/
    }
    this.rows[0].classList.add("group-top-row")
    row.classList.add("group-bottom-row")
    this.setRates(totals, itemRates)
    this.updateDisplayedModules()
}
GroupRow.prototype = {
    constructor: GroupRow,
    appendTo: function(parentNode) {
        for (var i = 0; i < this.rows.length; i++) {
            parentNode.appendChild(this.rows[i])
        }
    },
    groupMatches: function(group) {
        return this.group.equal(group)
    },
    setRates: function(totals, itemRates) {
        this.itemRates = []
        var rates = {}
        for (var i = 0; i < this.itemNames.length; i++) {
            var itemName = this.itemNames[i]
            var rate = itemRates[itemName]
            rates[itemName] = rate
            this.itemRates.push(rate)
            var waste = totals.getWaste(itemName)
            rate = rate.sub(waste)
            this.itemRows[i].setRate(rate, waste)
        }
        for (var i = 0; i < this.factoryRows.length; i++) {
            var row = this.factoryRows[i]
            var recipeName = row.recipe.name
            row.displayFactory(totals.get(recipeName))
        }
    },
    totalPower: function() {
        var power = zero
        for (var i = 0; i < this.factoryRows.length; i++) {
            var p = this.factoryRows[i].power
            if (p.fuel === "electric") {
                power = power.add(p.power)
            }
        }
        return power
    },
    csv: function() {
        var lines = []
        for (var i = 0; i < this.itemNames.length; i++) {
            var itemName = this.itemNames[i]
            var rate = displayRate(this.itemRates[i])
            var parts = [itemName, rate, "", "", "", "", "", ""]
            lines.push(parts.join(","))
        }
        return lines
    },
    hasModules: function() {
        for (var i = 0; i < this.factoryRows.length; i++) {
            if (this.factoryRows[i].modules.length > 0) {
                return true
            }
        }
        return false
    },
    setDownArrow: function() {
        for (var i = 0; i < this.factoryRows.length; i++) {
            var row = this.factoryRows[i]
            if (row.modules.length > 0) {
                row.downArrow.textContent = "\u2193"
                return
            }
        }
    },
    setUpDownArrow: function() {
        for (var i = 0; i < this.factoryRows.length; i++) {
            this.factoryRows[i].downArrow.textContent = "\u2195"
        }
    },
    setUpArrow: function() {
        for (var i = this.factoryRows.length - 1; i >= 0; i--) {
            var row = this.factoryRows[i]
            if (row.modules.length > 0) {
                row.downArrow.textContent = "\u2191"
                return
            }
        }
    },
    updateDisplayedModules: function() {
        for (var i = 0; i < this.factoryRows.length; i++) {
            this.factoryRows[i].updateDisplayedModules()
        }
    },
    remove: function() {
        for (var i = 0; i < this.rows.length; i++) {
            var row = this.rows[i]
            row.parentElement.removeChild(row)
        }
    },
}

function RecipeGroup(id) {
    this.id = id
    this.recipes = []
}
RecipeGroup.prototype = {
    constructor: RecipeGroup,
    equal: function(other) {
        if (this.id !== other.id) {
            return false
        }
        if (this.recipes.length != other.recipes.length) {
            return false
        }
        for (var i = 0; i < this.recipes.length; i++) {
            if (this.recipes[i].name != other.recipes[i].name) {
                return false
            }
        }
        return true
    },
}

function RecipeTable(node) {
    this.node = node
    var headers = [
        Header("items/" + rateName, 2),
        Header("belts", 2),
        Header("surplus/" + rateName),
        Header("factories", 2),
        Header("modules", 1),
        Header("beacons", 1),
        Header(""),
        Header("power", 2),
        Header("")
    ]
    var header = document.createElement("tr")
    header.classList.add("factory-header")
    for (var i = 0; i < headers.length; i++) {
        var th = document.createElement("th")
        if (i == 0) {
            this.recipeHeader = th
        }
        if (i == 2) {
            this.wasteHeader = th
            th.classList.add("waste")
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
    this.totalRow.classList.add("display-row")
    var dummyWaste = document.createElement("td")
    dummyWaste.classList.add("waste")
    this.totalRow.appendChild(dummyWaste)
    var totalLabelCell = document.createElement("td")
    totalLabelCell.colSpan = 10
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
        this.recipeHeader.textContent = "items/" + rateName
        this.wasteHeader.textContent = "surplus/" + rateName
    },
    updateDisplayedModules: function() {
        for (var i = 0; i < this.rowArray.length; i++) {
            var row = this.rowArray[i]
            row.updateDisplayedModules()
        }
    },
    displaySolution: function(totals) {
        this.setRecipeHeader()
        var sortedTotals
        if (sortOrder == "topo") {
            sortedTotals = totals.topo
        } else {
            sortedTotals = sorted(totals.totals)
        }
        //var itemOrder = []
        var items = {}
        var groups = []
        var groupMap = {}
        var group
        for (var i = 0; i < sortedTotals.length; i++) {
            var recipeName = sortedTotals[i]
            var recipeRate = totals.totals[recipeName]
            var recipe = solver.recipes[recipeName]
            for (var j = 0; j < recipe.products.length; j++) {
                var ing = recipe.products[j]
                if (!(ing.item.name in items)) {
                    //itemOrder.push(ing.item.name)
                    items[ing.item.name] = zero
                }
                items[ing.item.name] = items[ing.item.name].add(recipeRate.mul(recipe.gives(ing.item, spec)))
            }
            if (recipe.displayGroup === null) {
                group = new RecipeGroup(null)
                groups.push(group)
            } else {
                if (recipe.displayGroup in groupMap) {
                    group = groupMap[recipe.displayGroup]
                } else {
                    group = new RecipeGroup(recipe.displayGroup)
                    groupMap[recipe.displayGroup] = group
                    groups.push(group)
                }
            }
            group.recipes.push(recipe)
        }
        // XXX: Rework this, too.
        //displaySteps(items, itemOrder, totals)
        var last
        var newRowArray = []
        var downArrowShown = false
        var sameRows = true
        var i = 0
        var totalPower = zero
        var csvLines = ["item,item rate,factory,count,modules,beacon module,beacon count,power"]
        var csvWidth = csvLines[0].length
        var knownRows = {}
        var drop = []
        for (var i = 0; i < groups.length; i++) {
            var group = groups[i]
            // XXX: Bluh
            var rowName = group.id
            if (!rowName) {
                rowName = group.recipes[0].name
            }
            knownRows[rowName] = true
            var row = this.rows[rowName]
            var groupMatch = false
            if (group.id === null || row && row.groupMatches(group)) {
                groupMatch = true
            }
            if (row && groupMatch) {
                if (sameRows && rowName != this.rowArray[i].name) {
                    sameRows = false
                }
                // Don't rearrange the DOM if we don't need to.
                if (!sameRows) {
                    row.appendTo(this.node)
                }
                row.setRates(totals, items)
            } else {
                if (group.id === null) {
                    var rate = totals.get(rowName)
                    var recipe = group.recipes[0]
                    var itemName = recipe.products[0].item.name
                    var itemRate = items[itemName]
                    var waste = totals.getWaste(rowName)
                    row = new RecipeRow(rowName, rate, itemRate, waste)
                } else {
                    if (row) {
                        row.remove()
                    }
                    row = new GroupRow(group, items, totals)
                }
                row.appendTo(this.node)
                this.rows[rowName] = row
                sameRows = false
            }
            totalPower = totalPower.add(row.totalPower())
            var newCSVLines = row.csv()
            for (var j = 0; j < newCSVLines.length; j++) {
                var csvLine = newCSVLines[j]
                if (csvLine.length > csvWidth) {
                    csvWidth = csvLine.length
                }
                csvLines.push(csvLine)
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
        for (var recipeName in this.rows) {
            if (!(recipeName in knownRows)) {
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

        var wasteCells = document.querySelectorAll("td.waste, th.waste")
        var showWaste = Object.keys(totals.waste).length > 0
        for (var i = 0; i < wasteCells.length; i++) {
            var cell = wasteCells[i]
            if (showWaste) {
                cell.classList.remove("waste-hide")
            } else {
                cell.classList.add("waste-hide")
            }
        }
    },
}

var timesDisplayed = zero

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
    if (showDebug) {
        renderDebug()
    }

    timesDisplayed = timesDisplayed.add(one)
    var dc = document.getElementById("display_count")
    dc.textContent = timesDisplayed.toDecimal()
}
