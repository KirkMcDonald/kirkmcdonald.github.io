/*Copyright 2015-2020 Kirk McDonald

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

// data set
function Modification(name, filename, legacy, sheetSize) {
    this.name = name
    this.filename = filename
    this.legacy = legacy
    this.sheetSize = sheetSize
}

var MODIFICATIONS = {
    "1-0-0": new Modification("Vanilla 1.0.0", "vanilla-1.0.0.json", false, [480, 512]),
    "1-0-0x": new Modification("Vanilla 1.0.0 - Expensive", "vanilla-1.0.0-expensive.json", false, [480, 512]),
}

var DEFAULT_MODIFICATION = "1-0-0"

function addOverrideOptions(version) {
    var tag = "local-" + version.replace(/\./g, "-")
    MODIFICATIONS[tag] = new Modification("Local game data " + version, "local-" + version + ".json")
    MODIFICATIONS[tag + "x"] = new Modification("Local game data " + version + " - Expensive", "local-" + version + "-expensive.json")
    DEFAULT_MODIFICATION = tag
}


// Ideally we'd write this as a generalized function, but for now we can hard-
// code these version upgrades.
var modUpdates = {
}

function normalizeDataSetName(modName) {
    let newName = modUpdates[modName]
    if (newName) {
        modName = newName
    }
    if (modName in MODIFICATIONS) {
        return modName
    }
    return DEFAULT_MODIFICATION
}

function renderDataSetOptions(settings) {
    var modSelector = document.getElementById("data_set")
    var configuredMod = normalizeDataSetName(settings.data)
    for (var modName in MODIFICATIONS) {
        var mod = MODIFICATIONS[modName]
        var option = document.createElement("option")
        option.textContent = mod.name
        option.value = modName
        if (configuredMod && configuredMod === modName || !configuredMod && modName === DEFAULT_MODIFICATION) {
            option.selected = true
        }
        modSelector.appendChild(option)
    }
}

// Returns currently-selected data set.
function currentMod() {
    var elem = document.getElementById("data_set")
    return elem.value
}

// color scheme
var DEFAULT_COLOR_SCHEME = "default"

var colorScheme

function renderColorScheme(settings) {
    var color = DEFAULT_COLOR_SCHEME
    if ("c" in settings) {
        color = settings.c
    }
    setColorScheme(color)
    var colorSelector = document.getElementById("color_scheme")
    if (!colorSelector.hasChildNodes()) {
        for (var i = 0; i < colorSchemes.length; i++) {
            var scheme = colorSchemes[i]
            var option = document.createElement("option")
            option.textContent = scheme.displayName
            option.value = scheme.name
            if (scheme.name === color) {
                option.selected = true
            }
            colorSelector.appendChild(option)
        }
    }
}

function setColorScheme(schemeName) {
    for (var i = 0; i < colorSchemes.length; i++) {
        if (colorSchemes[i].name === schemeName) {
            colorScheme = colorSchemes[i]
            colorScheme.apply()
            return
        }
    }
}

// display rate
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

var displayRateFactor = displayRates[DEFAULT_RATE]
var rateName = DEFAULT_RATE

function renderRateOptions(settings) {
    rateName = DEFAULT_RATE
    if ("rate" in settings) {
        rateName = settings.rate
    }
    displayRateFactor = displayRates[rateName]
    var oldNode = document.getElementById("display_rate")
    var cell = oldNode.parentNode
    var node = document.createElement("form")
    node.id = "display_rate"
    for (var name in displayRates) {
        var rate = displayRates[name]
        var input = document.createElement("input")
        input.id = name + "_rate"
        input.type = "radio"
        input.name = "rate"
        input.value = name
        if (rate.equal(displayRateFactor)) {
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
    cell.replaceChild(node, oldNode)
}

// precisions
var DEFAULT_RATE_PRECISION = 3
var ratePrecision = DEFAULT_RATE_PRECISION

var DEFAULT_COUNT_PRECISION = 1
var countPrecision = DEFAULT_COUNT_PRECISION

function renderPrecisions(settings) {
    ratePrecision = DEFAULT_RATE_PRECISION
    if ("rp" in settings) {
        ratePrecision = Number(settings.rp)
    }
    document.getElementById("rprec").value = ratePrecision
    countPrecision = DEFAULT_COUNT_PRECISION
    if ("cp" in settings) {
        countPrecision = Number(settings.cp)
    }
    document.getElementById("fprec").value = countPrecision
}

// minimum assembler
var DEFAULT_MINIMUM = "1"

var minimumAssembler = DEFAULT_MINIMUM

function renderMinimumAssembler(settings) {
    var min = DEFAULT_MINIMUM
    // Backward compatibility.
    if ("use_3" in settings && settings.use_3 == "true") {
        min = "3"
    }
    var assemblers = spec.factories["crafting"]
    if ("min" in settings) {
        min = settings.min
        if (Number(settings.min) > assemblers.length) {
            min = assemblers.length
        }
    }
    setMinimumAssembler(min)
    var oldNode = document.getElementById("minimum_assembler")
    var cell = oldNode.parentNode
    var node = document.createElement("span")
    node.id = "minimum_assembler"
    let dropdown = makeDropdown(d3.select(node))
    let inputs = dropdown.selectAll("div").data(assemblers).join("div")
    let labels = addInputs(
        inputs,
        "assembler_dropdown",
        (d, i) => String(i + 1) === min,
        (d, i) => changeMin(String(i + 1)),
    )
    labels.append(d => getImage(d, false, dropdown.node()))
    cell.replaceChild(node, oldNode)
}

function setMinimumAssembler(min) {
    spec.setMinimum(min)
    minimumAssembler = min
}

// furnace

// Assigned during FactorySpec initialization.
var DEFAULT_FURNACE

function renderFurnace(settings) {
    var furnaceName = DEFAULT_FURNACE
    if ("furnace" in settings) {
        furnaceName = settings.furnace
    }
    if (furnaceName !== spec.furnace.name) {
        spec.setFurnace(furnaceName)
    }
    var oldNode = document.getElementById("furnace")
    var cell = oldNode.parentNode
    var node = document.createElement("span")
    node.id = "furnace"
    let furnaces = spec.factories["smelting"]
    let dropdown = makeDropdown(d3.select(node))
    let inputs = dropdown.selectAll("div").data(furnaces).join("div")
    let labels = addInputs(
        inputs,
        "furnace_dropdown",
        d => d.name === furnaceName,
        changeFurnace,
    )
    labels.append(d => getImage(d, false, dropdown.node()))
    cell.replaceChild(node, oldNode)
}

// chemical plant

// Assigned during FactorySpec initialization.
var DEFAULT_CHEM_PLANT

function renderChemicalPlant(settings) {
    let chemPlantName = DEFAULT_CHEM_PLANT
    if ("chemicalPlant" in settings) {
        chemPlantName = settings.chemical_plant
    }
    if (chemPlantName !== spec.chemical_plant.name) {
        spec.setChemicalPlant(chemPlantName)
    }
    let oldNode = document.getElementById("chemical_plant")

    if (spec.factories["chemistry"].length < 2) {
        //Nothing to choose, so kill the node
        oldNode.parentElement.parentElement.hidden = "hidden"
    } else {
        oldNode.parentElement.parentElement.hidden = ""
    }

    let cell = oldNode.parentNode
    let node = document.createElement("span")
    node.id = "chemical_plant"
    let chemPlants = spec.factories["chemistry"]
    let dropdown = makeDropdown(d3.select(node))
    let inputs = dropdown.selectAll("div").data(chemPlants).join("div")
    let labels = addInputs(
        inputs,
        "chemical_plant_dropdown",
        d => d.name === chemPlantName,
        changeChemicalPlant,
    )
    labels.append(d => getImage(d, false, dropdown.node()))
    cell.replaceChild(node, oldNode)
}

// fuel
var DEFAULT_FUEL = "coal"

var preferredFuel

function renderFuel(settings) {
    var fuelName = DEFAULT_FUEL
    if ("fuel" in settings) {
        fuelName = settings.fuel
    }
    setPreferredFuel(fuelName)
    var oldNode = document.getElementById("fuel")
    var cell = oldNode.parentNode
    var node = document.createElement("span")
    node.id = "fuel"
    let dropdown = makeDropdown(d3.select(node))
    let inputs = dropdown.selectAll("div").data(fuel).join("div")
    let labels = addInputs(
        inputs,
        "fuel_dropdown",
        d => d.name === fuelName,
        changeFuel,
    )
    labels.append(d => {
        let im = getImage(d, false, dropdown.node())
        im.title += " (" + d.valueString() + ")"
        return im
    })
    cell.replaceChild(node, oldNode)
}

function setPreferredFuel(name) {
    for (var i = 0; i < fuel.length; i++) {
        var f = fuel[i]
        if (f.name === name) {
            preferredFuel = f
        }
    }
}

// oil
function Oil(recipeName, priorityName) {
    this.name = recipeName
    this.priority = priorityName
}

var OIL_OPTIONS = [
    new Oil("advanced-oil-processing", "default"),
    new Oil("basic-oil-processing", "basic"),
    new Oil("coal-liquefaction", "coal")
]

var DEFAULT_OIL = "default"

var OIL_EXCLUSION = {
    "default": {},
    "basic": {"advanced-oil-processing": true},
    "coal": {"advanced-oil-processing": true, "basic-oil-processing": true}
}

var oilGroup = DEFAULT_OIL

function renderOil(settings) {
    var oil = DEFAULT_OIL
    // Named "p" for historical reasons.
    if ("p" in settings) {
        oil = settings.p
    }
    setOilRecipe(oil)
    var oldNode = document.getElementById("oil")
    var cell = oldNode.parentNode
    var node = document.createElement("span")
    node.id = "oil"
    let dropdown = makeDropdown(d3.select(node))
    let inputs = dropdown.selectAll("div").data(OIL_OPTIONS).join("div")
    let labels = addInputs(
        inputs,
        "oil_dropdown",
        d => d.priority === oil,
        changeOil,
    )
    labels.append(d => getImage(solver.recipes[d.name], false, dropdown.node()))
    cell.replaceChild(node, oldNode)
}

function setOilRecipe(name) {
    solver.removeDisabledRecipes(OIL_EXCLUSION[oilGroup])
    oilGroup = name
    solver.addDisabledRecipes(OIL_EXCLUSION[oilGroup])
}

// kovarex
var DEFAULT_KOVAREX = true

var kovarexEnabled

function renderKovarex(settings) {
    var k = DEFAULT_KOVAREX
    if ("k" in settings) {
        k = settings.k !== "off"
    }
    setKovarex(k)
    var input = document.getElementById("kovarex")
    input.checked = k
}

function setKovarex(enabled) {
    kovarexEnabled = enabled
    if (enabled) {
        solver.removeDisabledRecipes({"kovarex-enrichment-process": true})
    } else {
        solver.addDisabledRecipes({"kovarex-enrichment-process": true})
    }
}

// belt
var DEFAULT_BELT = "transport-belt"

var preferredBelt = DEFAULT_BELT
var preferredBeltSpeed = null

function renderBelt(settings) {
    var pref = DEFAULT_BELT
    if ("belt" in settings) {
        pref = settings.belt
    }
    setPreferredBelt(pref)
    var oldNode = document.getElementById("belt")
    var cell = oldNode.parentNode
    var node = document.createElement("span")
    node.id = "belt"
    let dropdown = makeDropdown(d3.select(node))
    let inputs = dropdown.selectAll("div").data(belts).join("div")
    let labels = addInputs(
        inputs,
        "belt_dropdown",
        d => d.name === preferredBelt,
        changeBelt,
    )
    labels.append(d => getImage(new BeltIcon(solver.items[d.name], d.speed), false, dropdown.node()))
    cell.replaceChild(node, oldNode)
}

function setPreferredBelt(name) {
    for (var i = 0; i < belts.length; i++) {
        var belt = belts[i]
        if (belt.name === name) {
            preferredBelt = name
            preferredBeltSpeed = belt.speed
        }
    }
}

// pipe
var DEFAULT_PIPE = RationalFromFloat(17)

var minPipeLength = DEFAULT_PIPE
var maxPipeThroughput = null

function renderPipe(settings) {
    var pipe = DEFAULT_PIPE.toDecimal(0)
    if ("pipe" in settings) {
        pipe = settings.pipe
    }
    setMinPipe(pipe)
    document.getElementById("pipe_length").value = minPipeLength.toDecimal(0)
}

function setMinPipe(lengthString) {
    minPipeLength = RationalFromString(lengthString)
    maxPipeThroughput = pipeThroughput(minPipeLength)
}

// mining productivity bonus
var DEFAULT_MINING_PROD = "0"

function renderMiningProd(settings) {
    var mprod = DEFAULT_MINING_PROD
    if ("mprod" in settings) {
        mprod = settings.mprod
    }
    var mprodInput = document.getElementById("mprod")
    mprodInput.value = mprod
    spec.miningProd = getMprod()
}

function getMprod() {
    var mprod = document.getElementById("mprod").value
    return RationalFromFloats(Number(mprod), 100)
}

// default module
function renderDefaultModule(settings) {
    var defaultModule = null
    if ("dm" in settings) {
        defaultModule = shortModules[settings.dm]
    }
    spec.setDefaultModule(defaultModule)

    var oldDefMod = document.getElementById("default_module")
    var cell = oldDefMod.parentNode
    var node = document.createElement("span")
    node.id = "default_module"
    moduleDropdown(
        d3.select(node),
        "default_module_dropdown",
        d => d === defaultModule,
        changeDefaultModule,
    )
    cell.replaceChild(node, oldDefMod)
}

// default beacon
function renderDefaultBeacon(settings) {
    var defaultBeacon = null
    var defaultCount = zero
    if ("db" in settings) {
        defaultBeacon = shortModules[settings.db]
    }
    if ("dbc" in settings) {
        defaultCount = RationalFromString(settings.dbc)
    }
    spec.setDefaultBeacon(defaultBeacon, defaultCount)

    var dbcField = document.getElementById("default_beacon_count")
    dbcField.value = defaultCount.toDecimal(0)

    var oldDefMod = document.getElementById("default_beacon")
    var cell = oldDefMod.parentNode
    var node = document.createElement("span")
    node.id = "default_beacon"
    moduleDropdown(
        d3.select(node),
        "default_beacon_dropdown",
        d => d === defaultBeacon,
        changeDefaultBeacon,
        d => d === null || d.canBeacon(),
    )
    cell.replaceChild(node, oldDefMod)
}

// visualizer settings
let DEFAULT_VISUALIZER = "sankey"

let visualizer = DEFAULT_VISUALIZER

function renderVisualizerType(settings) {
    visualizer = DEFAULT_VISUALIZER
    if ("vis" in settings) {
        visualizer = settings.vis
    }
    let input = document.getElementById("vis_" + visualizer)
    input.checked = true
}

let DEFAULT_DIRECTION = "right"

let visDirection = DEFAULT_DIRECTION

function renderVisualizerDirection(settings) {
    visDirection = DEFAULT_DIRECTION
    if ("vd" in settings) {
        visDirection = settings.vd
    }
    let input = document.getElementById("visdir_" + visDirection)
    input.checked = true
}

const DEFAULT_NODE_BREADTH = 175

let maxNodeHeight = DEFAULT_NODE_BREADTH

function renderNodeBreadth(settings) {
    maxNodeHeight = DEFAULT_NODE_BREADTH
    if ("nh" in settings) {
        maxNodeHeight = Number(settings.nh)
    }
    let input = document.getElementById("vis-node-breadth")
    input.value = maxNodeHeight
}

const DEFAULT_LINK_LENGTH = 200

let linkLength = DEFAULT_LINK_LENGTH

function renderLinkLength(settings) {
    linkLength = DEFAULT_LINK_LENGTH
    if ("ll" in settings) {
        linkLength = Number(settings.ll)
    }
    let input = document.getElementById("vis-link-length")
    input.value = linkLength
}

// value format
var DEFAULT_FORMAT = "decimal"

var displayFormat = DEFAULT_FORMAT

var displayFormats = {
    "d": "decimal",
    "r": "rational"
}

function renderValueFormat(settings) {
    displayFormat = DEFAULT_FORMAT
    if ("vf" in settings) {
        displayFormat = displayFormats[settings.vf]
    }
    var input = document.getElementById(displayFormat + "_format")
    input.checked = true
}

// tooltips
var DEFAULT_TOOLTIP = true

var tooltipsEnabled = DEFAULT_TOOLTIP

function renderTooltip(settings) {
    tooltipsEnabled = DEFAULT_TOOLTIP
    if ("t" in settings) {
        tooltipsEnabled = settings.t !== "off"
    }
    var input = document.getElementById("tooltip")
    input.checked = tooltipsEnabled
}

// debug tab
var DEFAULT_DEBUG = false

var showDebug = DEFAULT_DEBUG

function renderShowDebug(settings) {
    showDebug = DEFAULT_DEBUG
    if ("debug" in settings) {
        showDebug = settings.debug === "on"
    }
    var debug = document.getElementById("render_debug")
    debug.checked = showDebug
}

// all
function renderSettings(settings) {
    renderTooltip(settings)
    renderColorScheme(settings)
    renderRateOptions(settings)
    renderPrecisions(settings)
    renderMinimumAssembler(settings)
    renderFurnace(settings)
    renderChemicalPlant(settings)
    renderFuel(settings)
    renderOil(settings)
    renderKovarex(settings)
    renderBelt(settings)
    renderPipe(settings)
    renderMiningProd(settings)
    renderDefaultModule(settings)
    renderDefaultBeacon(settings)
    renderVisualizerType(settings)
    renderVisualizerDirection(settings)
    renderNodeBreadth(settings)
    renderLinkLength(settings)
    renderValueFormat(settings)
}
