/*Copyright 2019-2021 Kirk McDonald

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.*/
import { DEFAULT_RATE, DEFAULT_RATE_PRECISION, DEFAULT_COUNT_PRECISION, DEFAULT_FORMAT, longRateNames } from "./align.js"
import { colorSchemes } from "./color.js"
import { DEFAULT_TAB, clickTab, DEFAULT_VISUALIZER, visualizerType, setVisualizerType, DEFAULT_RENDER, visualizerRender, setVisualizerRender, visualizerDirection, getDefaultVisDirection, setVisualizerDirection } from "./events.js"
import { spec, DEFAULT_PLANET, DEFAULT_BELT, DEFAULT_FUEL, buildingSort } from "./factory.js"
import { getRecipeCategories, titleCase } from "./groups.js"
import { changeMod } from "./init.js"
import { shortModules, moduleRows, moduleDropdown } from "./module.js"
import { Rational, zero } from "./rational.js"
import { sorted } from "./sort.js"

// data set

// This setting is somewhat special. It prompts a reset of the full calculator
// state.
class Modification {
    constructor(name, filename, legacy) {
        this.name = name
        this.filename = filename
        this.legacy = legacy
    }
}

export let MODIFICATIONS = new Map([
    ["2-0-10", new Modification("Vanilla 2.0.10", "vanilla-2.0.10.json", false)],
    ["1-1-110", new Modification("Vanilla 1.1.110", "vanilla-1.1.110.json", true)],
    ["1-1-110x", new Modification("Vanilla 1.1.110 - Expensive", "vanilla-1.1.110-expensive.json", true)],
    ["space-age-2-0-11", new Modification("Space Age 2.0.11 (WORK IN PROGRESS)", "space-age-2.0.11.json", false)],
])

let DEFAULT_MODIFICATION = "2-0-10"

// Ideally we'd write this as a generalized function, but for now we can hard-
// code these version upgrades.
var modUpdates = new Map([
    ["2-0-6", "2-0-10"],
    ["2-0-7", "2-0-10"],
    ["1-1-19", "1-1-110"],
    ["1-1-19x", "1-1-110x"],
    ["space-age-2-0-10", "space-age-2-0-11"],
])

function normalizeDataSetName(modName) {
    let newName = modUpdates.get(modName)
    if (newName !== undefined) {
        modName = newName
    }
    if (MODIFICATIONS.has(modName)) {
        return modName
    }
    return DEFAULT_MODIFICATION
}

// Unlike most "renderSetting" functions, this is called exactly once, on
// initialization, and so does not need to wipe and re-render its UI elements.
export function renderDataSetOptions(settings) {
    let modSelector = document.getElementById("data_set")
    d3.select(modSelector).on("change", function (event) {
        changeMod()
    })
    let configuredMod = normalizeDataSetName(settings.get("data"))
    for (let [modName, mod] of MODIFICATIONS) {
        let option = document.createElement("option")
        option.textContent = mod.name
        option.value = modName
        if (configuredMod && configuredMod === modName || !configuredMod && modName === DEFAULT_MODIFICATION) {
            option.selected = true
        }
        modSelector.appendChild(option)
    }
}

// Returns currently-selected data set.
export function currentMod() {
    let elem = document.getElementById("data_set")
    return elem.value
}

// There are several things going on with this control flow. Settings should
// work like this:
// 1) Settings are parsed from the URL fragment into the settings Map.
// 2) Each setting's `render` function is called.
// 3) If the setting is not present in the map, a default value is used.
// 4) The setting is applied.
// 5) The setting's GUI is placed into a consistent state.
// Remember to add the setting to fragment.js, too!

// tab

function renderTab(settings) {
    let tabName = DEFAULT_TAB
    if (settings.has("tab")) {
        tabName = settings.get("tab")
    }
    clickTab(tabName)
}

// build targets

function renderTargets(settings) {
    spec.buildTargets = []
    d3.selectAll("#targets li.target").remove()

    let targetSetting = settings.get("items")
    if (targetSetting !== undefined && targetSetting !== "") {
        let targets = targetSetting.split(",")
        for (let targetString of targets) {
            let parts = targetString.split(":")
            let itemKey = parts[0]
            if (!spec.items.has(itemKey)) {
                console.log("unknown item:", itemKey)
                continue
            }
            let target = spec.addTarget(itemKey)
            let type = parts[1]
            if (type === "f") {
                let recipe = null
                if (parts.length > 3) {
                    let recipeKey = parts[3]
                    if (!spec.recipes.has(recipeKey)) {
                        console.log("unknown recipe:", recipeKey)
                        continue
                    }
                    recipe = spec.recipes.get(recipeKey)
                }
                target.setBuildings(parts[2], recipe)
                target.displayRecipes()
            } else if (type === "r") {
                target.setRate(parts[2])
            } else {
                throw new Error("unknown target type")
            }
        }
    } else {
        spec.addTarget()
    }
}

// modules

function getModule(moduleKey) {
    let module
    if (spec.modules.has(moduleKey)) {
        module = spec.modules.get(moduleKey)
    } else if (shortModules.has(moduleKey)) {
        module = shortModules.get(moduleKey)
    } else if (moduleKey === "null") {
        module = null
    }
    if (module === undefined) {
        console.log("unknown module:", moduleKey)
        return null
    }
    return module
}

// NOTE: Buildings must be configured before modules!
function renderModules(settings) {
    let two = Rational.from_float(2)
    let moduleString = settings.get("modules")
    if (moduleString !== undefined && moduleString !== "") {
        for (let recipeSetting of moduleString.split(",")) {
            let [buildingModuleSettings, beaconSettings] = recipeSetting.split(";")
            let [recipeKey, ...moduleKeyList] = buildingModuleSettings.split(":")
            let recipe = spec.recipes.get(recipeKey)
            if (recipe === undefined) {
                console.log("unknown recipe:", recipeKey)
                continue
            }
            let moduleSpec = spec.getModuleSpec(recipe)
            for (let i = 0; i < moduleKeyList.length; i++) {
                let moduleKey = moduleKeyList[i]
                if (moduleKey === "") {
                    continue
                }
                let module = getModule(moduleKey)
                if (module !== undefined) {
                    moduleSpec.setModule(i, module)
                }
            }
            if (beaconSettings !== undefined) {
                let beaconParts = beaconSettings.split(":")
                // The legacy beacon config was simply in the form
                // "module:module count". If the count is even, then it is
                // adapted to the new format by dividing it by two and placing
                // the specified module in both slots. Otherwise, a single slot
                // is filled and the count is used as the beacon count.
                let module1
                let module2
                let count
                if (beaconParts.length === 2) {
                    let module = getModule(beaconParts[0])
                    count = Rational.from_string(beaconParts[1])
                    let divmod = count.divmod(two)
                    if (divmod.remainder.isZero()) {
                        module1 = module
                        module2 = module
                        count = divmod.quotient
                    } else {
                        module1 = module
                        module2 = null
                    }
                } else {
                    module1 = getModule(beaconParts[0])
                    module2 = getModule(beaconParts[1])
                    count = Rational.from_string(beaconParts[2])
                }
                moduleSpec.setBeaconModule(module1, 0)
                moduleSpec.setBeaconModule(module2, 1)
                moduleSpec.setBeaconCount(count)
            }
        }
    }
}

// ignore

function renderIgnore(settings) {
    spec.ignore.clear()
    // UI will be rendered later, as part of the solution.
    let ignoreSetting = settings.get("ignore")
    if (ignoreSetting !== undefined && ignoreSetting !== "") {
        let ignore = ignoreSetting.split(",")
        for (let itemKey of ignore) {
            let item = spec.items.get(itemKey)
            if (item === undefined) {
                console.log("unknown item:", itemKey)
                continue
            }
            spec.ignore.add(item)
        }
    }
}

// title

export const DEFAULT_TITLE = "Factorio Calculator"

export function setTitle(s) {
    if (s === "") {
        document.title = DEFAULT_TITLE
    } else {
        document.title = s
    }
}

function renderTitle(settings) {
    let input = d3.select("#title_setting").node()
    let title = ""
    if (settings.has("title")) {
        title = decodeURIComponent(settings.get("title"))
    }
    input.value = title
    setTitle(title)
}

// display rate

function rateHandler() {
    spec.format.setDisplayRate(this.value)
    spec.display()
}

function renderRateOptions(settings) {
    let rateName = DEFAULT_RATE
    if (settings.has("rate")) {
        rateName = settings.get("rate")
    }
    spec.format.setDisplayRate(rateName)
    let rates = []
    for (let [rateName, longRateName] of longRateNames) {
        rates.push({ rateName, longRateName })
    }
    let form = d3.select("#display_rate")
    form.selectAll("*").remove()
    let rateOption = form.selectAll("span")
        .data(rates)
        .join("span")
    rateOption.append("input")
        .attr("id", d => d.rateName + "_rate")
        .attr("type", "radio")
        .attr("name", "rate")
        .attr("value", d => d.rateName)
        .property("checked", d => d.rateName === rateName)
        .on("change", rateHandler)
    rateOption.append("label")
        .attr("for", d => d.rateName + "_rate")
        .text(d => "items/" + d.longRateName)
    rateOption.append("br")
}

// precisions

function renderPrecisions(settings) {
    spec.format.ratePrecision = DEFAULT_RATE_PRECISION
    if (settings.has("rp")) {
        spec.format.ratePrecision = Number(settings.get("rp"))
    }
    d3.select("#rprec").attr("value", spec.format.ratePrecision)
    spec.format.countPrecision = DEFAULT_COUNT_PRECISION
    if (settings.has("cp")) {
        spec.format.countPrecision = Number(settings.get("cp"))
    }
    d3.select("#cprec").attr("value", spec.format.countPrecision)
}

// value format

let displayFormats = new Map([
    ["d", "decimal"],
    ["r", "rational"],
])

function renderValueFormat(settings) {
    spec.format.displayFormat = DEFAULT_FORMAT
    if (settings.has("vf")) {
        spec.format.displayFormat = displayFormats.get(settings.get("vf"))
    }
    let input = document.getElementById(spec.format.displayFormat + "_format")
    input.checked = true
}

// mining productivity

function renderMiningProd(settings) {
    let mprod = "0"
    if (settings.has("mprod")) {
        mprod = settings.get("mprod")
    }
    let mprodInput = document.getElementById("mprod")
    mprodInput.value = mprod
    spec.miningProd = Rational.from_string(mprod).div(Rational.from_float(100))
}

// color scheme
export const DEFAULT_COLOR_SCHEME = "default"

export let colorScheme

function renderColorScheme(settings) {
    let color = DEFAULT_COLOR_SCHEME
    if (settings.has("c")) {
        color = settings.get("c")
    }
    setColorScheme(color)
    d3.select("#color_scheme")
        .on("change", function (event, d) {
            setColorScheme(event.target.value)
            spec.display()
        })
        .selectAll("option")
        .data(colorSchemes)
        .join("option")
        .attr("value", d => d.key)
        .property("selected", d => d.key === color)
        .text(d => d.name)
}

function setColorScheme(schemeKey) {
    for (let scheme of colorSchemes) {
        if (scheme.key === schemeKey) {
            colorScheme = scheme
            colorScheme.apply()
            return
        }
    }
}

// buildings

function renderBuildings(settings) {
    let groupSet = new Set()
    for (let [cat, group] of spec.buildings) {
        if (group.buildings.length > 1) {
            groupSet.add(group)
        }
    }
    for (let group of groupSet) {
        group.building = group.getDefault()
    }
    if (settings.has("buildings")) {
        let buildingKeys = settings.get("buildings").split(",")
        for (let key of buildingKeys) {
            let building = spec.buildingKeys.get(key)
            if (building === undefined) {
                console.log("unknown building:", key)
                continue
            }
            spec.setMinimumBuilding(building)
        }
    }

    // It doesn't really matter how we order these, but pick something just to
    // make it consistent.
    let groups = sorted(groupSet, g => g.getDefault().name)
    let groupIndex = new Map()
    for (let [i, g] of groups.entries()) {
        for (let building of g.buildings) {
            groupIndex.set(building, i)
        }
    }
    let div = d3.select("#building_selector")
    div.selectAll("*").remove()
    let set = div.selectAll("div")
        .data(groups)
        .join("div")
        .classed("radio-setting", true)
    radioSetting(
        set,
        d => `building_selector_${groupIndex.get(d)}`,
        d => d.buildings,
        d => d === spec.getBuildingGroup(d).building,
        (event, d) => {
            spec.setMinimumBuilding(d)
            spec.updateSolution()
        },
    )
}

// belt

function beltHandler(event, belt) {
    spec.belt = belt
    spec.display()
}

let radioInput = 0
let radioLabel = 0
function radioSetting(form, name, data, checked, onchange) {
    let option = form.selectAll("span")
        .data(data)
        .join("span")
    option.append("input")
        .attr("id", d => `radio-input-${radioInput++}`)
        .attr("type", "radio")
        .attr("name", name)
        .attr("value", d => d.key)
        .property("checked", d => checked(d))
        .on("change", onchange)
    option.append("label")
        .attr("for", d => `radio-input-${radioLabel++}`)
        .append(d => d.icon.make(32))
}

function renderBelts(settings) {
    let beltKey = DEFAULT_BELT
    if (settings.has("belt")) {
        let b = settings.get("belt")
        if (spec.belts.has(b)) {
            beltKey = b
        } else {
            console.log("unknown belt:", b)
        }
    }
    spec.belt = spec.belts.get(beltKey)

    let belts = []
    for (let [beltKey, belt] of spec.belts) {
        belts.push(belt)
    }
    let form = d3.select("#belt_selector")
    form.selectAll("*").remove()
    radioSetting(
        form,
        "belt",
        belts,
        d => d === spec.belt,
        beltHandler,
    )
}

// fuel

function fuelHandler(event, fuel) {
    spec.fuel = fuel
    spec.updateSolution()
}

function renderFuel(settings) {
    let fuelKey = DEFAULT_FUEL
    if (settings.has("fuel")) {
        let f = settings.get("fuel")
        if (spec.fuels.has(f)) {
            fuelKey = f
        } else {
            console.log("unknown fuel:", f)
        }
    }
    spec.fuel = spec.fuels.get(fuelKey)

    let fuels = Array.from(spec.fuels.values())
    let form = d3.select("#fuel_selector")
    form.selectAll("*").remove()
    radioSetting(
        form,
        "fuel",
        fuels,
        d => d === spec.fuel,
        fuelHandler,
    )
}

// visualizer

function renderVisualizer(settings) {
    if (settings.has("vt")) {
        setVisualizerType(settings.get("vt"))
    } else {
        setVisualizerType(DEFAULT_VISUALIZER)
    }
    d3.select(`#${visualizerType}_type`).property("checked", true)
    if (settings.has("vr")) {
        setVisualizerRender(settings.get("vr"))
    } else {
        setVisualizerRender(DEFAULT_RENDER)
    }
    d3.select(`#${visualizerRender}_render`).property("checked", true)
    if (settings.has("vd")) {
        setVisualizerDirection(settings.get("vd"))
    } else {
        setVisualizerDirection(getDefaultVisDirection())
    }
    d3.select(`#${visualizerDirection}_direction`).property("checked", true)
}

// default module

class DefaultModuleInput {
    constructor(cell, module) {
        this.cell = cell
        this.module = module
    }
    checked() {
        return this.module === spec.defaultModule
    }
    choose() {
        spec.setDefaultModule(this.module)
        spec.updateSolution()
    }
}
class DefaultModuleCell {
    constructor() {
        this.name = "default_module_dropdown"
        this.inputRows = []
        for (let row of moduleRows) {
            let inputRow = []
            for (let module of row) {
                inputRow.push(new DefaultModuleInput(this, module))
            }
            this.inputRows.push(inputRow)
        }
    }
}
class SecondaryModuleInput {
    constructor(cell, module) {
        this.cell = cell
        this.module = module
    }
    checked() {
        return this.module === spec.secondaryDefaultModule
    }
    choose() {
        spec.setSecondaryDefaultModule(this.module)
        spec.updateSolution()
    }
}
class SecondaryModuleCell {
    constructor() {
        this.name = "secondary_module_dropdown"
        this.inputRows = []
        for (let row of moduleRows) {
            let inputRow = []
            for (let module of row) {
                inputRow.push(new SecondaryModuleInput(this, module))
            }
            this.inputRows.push(inputRow)
        }
    }
}

function renderDefaultModule(settings) {
    let defaultModule = null
    if (settings.has("dm")) {
        defaultModule = getModule(settings.get("dm"))
    }
    spec.setDefaultModule(defaultModule)
    let secondaryModule = null
    if (settings.has("dm2")) {
        secondaryModule = getModule(settings.get("dm2"))
    }
    spec.setSecondaryDefaultModule(secondaryModule)

    let cell = new DefaultModuleCell()
    let select = d3.select("#default_module")
    select.selectAll("*").remove()
    moduleDropdown(select, [cell])
    cell = new SecondaryModuleCell()
    select = d3.select("#secondary_module")
    select.selectAll("*").remove()
    moduleDropdown(select, [cell])
}

// default beacon

class DefaultBeaconInput {
    constructor(cell, module) {
        this.cell = cell
        this.module = module
    }
    checked() {
        return this.module === spec.defaultBeacon[this.cell.index]
    }
    choose() {
        let self = this
        let oldModule = spec.defaultBeacon[this.cell.index]
        spec.setDefaultBeacon(this.module, this.cell.index)
        if (this.cell.index === 0) {
            let modules = spec.defaultBeacon
            if (oldModule === modules[1]) {
                spec.setDefaultBeacon(this.module, 1)
                d3.selectAll("#default_beacon span.module-wrapper:nth-child(2) input")
                    .property("checked", d => self.module === d.module)
            }
        }
        spec.updateSolution()
    }
}
class DefaultBeaconCell {
    constructor(index) {
        this.name = `default_beacon_dropdown_${index}`
        this.index = index
        this.inputRows = []
        for (let row of moduleRows) {
            let inputRow = []
            for (let module of row) {
                if (module === null || module.canBeacon()) {
                    inputRow.push(new DefaultBeaconInput(this, module))
                }
            }
            this.inputRows.push(inputRow)
        }
    }
}

function renderDefaultBeacon(settings) {
    let defaultBeacon = [null, null]
    let defaultCount = zero
    let legacy = false
    if (settings.has("db")) {
        let keys = settings.get("db").split(":")
        if (keys.length === 1) {
            legacy = true
        }
        for (let i = 0; i < keys.length; i++) {
            defaultBeacon[i] = getModule(keys[i])
        }
    }
    if (settings.has("dbc")) {
        defaultCount = Rational.from_string(settings.get("dbc"))
    }
    if (legacy) {
        let two = Rational.from_float(2)
        let divmod = defaultCount.divmod(two)
        if (divmod.remainder.isZero()) {
            defaultBeacon = [defaultBeacon[0], defaultBeacon[0]]
            defaultCount = divmod.quotient
        }
    }
    for (let i = 0; i < defaultBeacon.length; i++) {
        spec.setDefaultBeacon(defaultBeacon[i], i)
    }
    spec.setDefaultBeaconCount(defaultCount)

    let cells = [new DefaultBeaconCell(0), new DefaultBeaconCell(1)]
    let select = d3.select("#default_beacon")
    select.selectAll("*").remove()
    moduleDropdown(select, cells)
    d3.select("#default_beacon_count")
        .attr("value", defaultCount.toDecimal())
        .on("change", (event) => {
            spec.setDefaultBeaconCount(Rational.from_string(event.target.value))
            spec.updateSolution()
        })
}

// recipe disabling

function renderRecipes(settings) {
    let havePlanets = spec.planets && spec.planets.size > 1
    let planetRow = d3.select("#planet_setting_row")
    if (havePlanets) {
        planetRow.style("display", null)
        let planetKeys = []
        if (settings.has("planet")) {
            let s = settings.get("planet")
            if (s !== "") {
                planetKeys = s.split(",")
            }
        } else {
            planetKeys = [DEFAULT_PLANET]
        }
        for (let key of planetKeys) {
            if (spec.planets.has(key)) {
                spec.selectPlanet(spec.planets.get(key))
            }
        }
    } else {
        planetRow.style("display", "none")
    }

    if (settings.has("disable") || settings.has("enable")) {
        if (settings.has("disable")) {
            let keys = settings.get("disable").split(",")
            for (let k of keys) {
                let recipe = spec.recipes.get(k)
                if (recipe) {
                    spec.setDisable(recipe)
                }
            }
        }
        if (settings.has("enable")) {
            let keys = settings.get("enable").split(",")
            for (let k of keys) {
                let recipe = spec.recipes.get(k)
                if (recipe) {
                    spec.setEnable(recipe)
                }
            }
        }
    } else if (!havePlanets) {
        spec.setDefaultDisable()
    }

    let allGroups = getRecipeCategories(new Set(spec.recipes.values()))
    let groups = new Map();
    for (let [category, group] of allGroups) {
        if (group.size > 1) {
            groups.set(category, sorted(group, (recipe) => {
                let item = null
                if (recipe.products.length > 0) {
                    item = recipe.products[0].item
                }
                if (category == "recycling" && recipe.ingredients.length > 0) {
                    // Sort recycling recipes by their ingredient, so it follows a familiar order
                    item = recipe.ingredients[0].item
                }
                if (item != null) {
                    return item.group + "-" + item.subgroup + "-" + item.order
                }
                return "zzz-" + recipe.order
            }))
        }
    }

    let planetDiv = d3.select("#planet_selector")
        .classed("toggle-list", true)
    planetDiv.selectAll("*").remove()
    if (havePlanets) {
        let planets = sorted(spec.planets.values(), p => p.order)
        planetDiv.selectAll("div")
            .data(planets)
            .join("div")
            .classed("toggle", true)
            .classed("selected", d => spec.selectedPlanets.has(d))
            .on("click", function (event, d) {
                if (event.shiftKey) {
                    event.preventDefault()
                    let selected = spec.selectedPlanets.has(d)
                    d3.select(this).classed("selected", !selected)
                    if (selected) {
                        spec.unselectPlanet(d)
                    } else {
                        spec.selectPlanet(d)
                    }
                } else {
                    spec.selectOnePlanet(d)
                    d3.selectAll("#planet_selector .toggle")
                        .classed("selected", d => spec.selectedPlanets.has(d))
                }
                d3.selectAll("#recipe_toggles .toggle")
                    .classed("selected", d => !spec.disable.has(d))

                d3.selectAll("#recipe_toggles .category-label.toggle ")
                    .each(function () {
                        let categoryId = d3.select(this).attr("id")
                        let isSelected = groups.get(categoryId)
                            .some(recipe => !spec.disable.has(recipe))

                        d3.select(this).classed("selected", isSelected);
                    })

                spec.updateSolution()
            })
            .append(d => d.icon.make(32))
    }

    let div = d3.select("#recipe_toggles")
        .classed("toggle-list", true)
    div.selectAll("*").remove()

    for (const [category, recipes] of groups) {
        let categoryDiv = div.append("div")
            .attr("class", "toggle-row category")

        categoryDiv.append("div")
            .text(titleCase(category))
            .attr("class", "category-label toggle")
            .attr("id", category)
            .classed("selected", _ => recipes.some(recipe => !spec.disable.has(recipe)))
            .on("click", function (event, d) {
                let disabled = true
                recipes.forEach(recipe => {
                    if (!spec.disable.has(recipe)) {
                        disabled = false
                    }
                })

                if (disabled) {
                    recipes.forEach(recipe => {
                        if (spec.disable.has(recipe)) {
                            spec.setEnable(recipe)
                        }
                    })
                } else {
                    recipes.forEach(recipe => {
                        if (!spec.disable.has(recipe)) {
                            spec.setDisable(recipe)
                        }
                    })
                }

                d3.selectAll("#recipe_toggles .toggle.recipe")
                    .classed("selected", d => !spec.disable.has(d))

                d3.select(this).classed("selected", disabled)

                spec.updateSolution()
            })

        categoryDiv.append("div")

        let recipeGroup = categoryDiv.selectAll("div.recipe")
            .data(recipes)

        recipeGroup.enter()
            .append("div")
            .attr("class", "toggle recipe")
            .classed("selected", d => !spec.disable.has(d))
            .on("click", function (event, d) {
                let disabled = spec.disable.has(d)
                d3.select(this).classed("selected", disabled)
                if (disabled) {
                    spec.setEnable(d)
                } else {
                    spec.setDisable(d)
                }

                spec.updateSolution()
            })
            .append("div")
            .attr("class", "recipe-icon")
            .append(d => d.icon.make(32))
    }
}

// resource priority

function renderResourcePriorities(settings) {
    spec.setDefaultPriority()
    if (settings.has("priority")) {
        let tiers = []
        let keys = settings.get("priority").split(";")
        outer: for (let tierStr of keys) {
            let tier = []
            for (let pair of tierStr.split(",")) {
                // Backward compatibility: If this is using the old format,
                // ignore the whole thing and bail.
                if (pair.indexOf("=") === -1) {
                    console.log("bailing:", pair)
                    tiers = null
                    break outer
                }
                let [key, weightStr] = pair.split("=")
                if (!spec.isValidPriorityKey(key)) {
                    console.log("invalid priority key:", key)
                    continue
                }
                tier.push([key, Rational.from_string(weightStr)])
            }
            tiers.push(tier)
        }
        if (tiers !== null) {
            spec.setPriorities(tiers)
        }
    }
}

// debug

function renderDebugCheckbox(settings) {
    spec.debug = settings.has("debug")
    d3.select("#render_debug").property("checked", spec.debug)
}

export function renderSettings(settings) {
    renderTitle(settings)
    renderIgnore(settings)
    renderRateOptions(settings)
    renderPrecisions(settings)
    renderValueFormat(settings)
    renderMiningProd(settings)
    renderColorScheme(settings)
    renderBuildings(settings)
    renderBelts(settings)
    renderFuel(settings)
    renderVisualizer(settings)
    renderDefaultModule(settings)
    renderDefaultBeacon(settings)
    renderResourcePriorities(settings)
    renderRecipes(settings)
    renderTargets(settings)
    renderModules(settings)
    renderDebugCheckbox(settings)
    renderTab(settings)
}
