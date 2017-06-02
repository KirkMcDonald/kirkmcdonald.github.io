"use strict"

// data set
function Modification(name, filename) {
    this.name = name
    this.filename = filename
}

var MODIFICATIONS = {
    "0-15-16": new Modification("Vanilla 0.15.16", "vanilla-0.15.16.json"),
    "0-15-16x": new Modification("Vanilla 0.15.16 - Expensive", "vanilla-0.15.16-expensive.json"),
}

var DEFAULT_MODIFICATION = "0-15-16"

function renderDataSetOptions(settings) {
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
}

// Returns currently-selected data set.
function currentMod() {
    var elem = document.getElementById("data_set")
    return elem.value
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
    if ("rate" in settings) {
        rateName = settings.rate
        displayRateFactor = displayRates[settings.rate]
    }
    var tab = document.getElementById("settings_tab")
    var oldNode = document.getElementById("display_rate")
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
    tab.replaceChild(node, oldNode)
}

// precisions
var DEFAULT_RATE_PRECISION = 3
var ratePrecision = DEFAULT_RATE_PRECISION

var DEFAULT_COUNT_PRECISION = 1
var countPrecision = DEFAULT_COUNT_PRECISION

function renderPrecisions(settings) {
    if ("rp" in settings) {
        ratePrecision = Number(settings.rp)
        document.getElementById("rprec").value = ratePrecision
    }
    if ("cp" in settings) {
        countPrecision = Number(settings.cp)
        document.getElementById("fprec").value = countPrecision
    }
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
    if ("min" in settings && Number(min) >= 1 && Number(min) <= assemblers.length) {
        min = settings.min
    }
    spec.setMinimum(min)
    minimumAssembler = min
    var tab = document.getElementById("settings_tab")
    var oldNode = document.getElementById("minimum_assembler")
    var node = document.createElement("span")
    node.id = "minimum_assembler"
    var dropdown = new Dropdown(node, "assembler_dropdown", changeMin)
    for (var i = 0; i < assemblers.length; i++) {
        var assembler = assemblers[i].name
        var image = getImage(assembler)
        dropdown.add(
            image,
            String(i + 1),
            String(i + 1) === min
        )
    }
    tab.replaceChild(node, oldNode)
}

// mining productivity bonus
function renderMiningProd(settings) {
    if ("mprod" in settings) {
        var mprod = document.getElementById("mprod")
        mprod.value = settings.mprod
    }
    spec.miningProd = getMprod()
}

function getMprod() {
    var mprod = document.getElementById("mprod").value
    return RationalFromFloats(Number(mprod), 100)
}

// all
function renderSettings(settings) {
    renderRateOptions(settings)
    renderPrecisions(settings)
    renderMinimumAssembler(settings)
    renderMiningProd(settings)
}
