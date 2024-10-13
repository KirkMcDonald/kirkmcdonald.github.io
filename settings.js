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
import { dropdown } from "./dropdown.js"
import { DEFAULT_TAB, clickTab, DEFAULT_VISUALIZER, visualizerType, setVisualizerType, DEFAULT_RENDER, visualizerRender, setVisualizerRender } from "./events.js"
import { spec, resourcePurities, DEFAULT_BELT } from "./factory.js"
import { getRecipeGroups } from "./groups.js"
import { shortModules, moduleRows, moduleDropdown } from "./module.js"
import { Rational, zero } from "./rational.js"
import { renderRecipe } from "./recipe.js"

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
    d3.select("#targets li.target").remove()

    let targetSetting = settings.get("items")
    if (targetSetting !== undefined && targetSetting !== "") {
        let targets = targetSetting.split(",")
        for (let targetString of targets) {
            let parts = targetString.split(":")
            let itemKey = parts[0]
            let target = spec.addTarget(itemKey)
            let type = parts[1]
            if (type === "f") {
                let recipe = null
                if (parts.length > 3) {
                    let recipeKey = parts[3]
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
            let moduleSpec = spec.getModuleSpec(recipe)
            for (let i = 0; i < moduleKeyList.length; i++) {
                let moduleKey = moduleKeyList[i]
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
        rates.push({rateName, longRateName})
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
        .attr("checked", d => d.rateName === rateName ? "" : null)
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
        .on("change", function(event, d) {
            setColorScheme(event.target.value)
            spec.display()
        })
        .selectAll("option")
        .data(colorSchemes)
        .join("option")
            .attr("value", d => d.key)
            .attr("selected", d => d.key === color ? true : null)
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

// belt

function beltHandler(event, belt) {
    spec.belt = belt
    spec.display()
}

function pipeHandler(event, pipe) {
    spec.pipe = pipe
    spec.display()
}

function renderBelts(settings) {
    let beltKey = DEFAULT_BELT
    if (settings.has("belt")) {
        beltKey = settings.get("belt")
    }
    spec.belt = spec.belts.get(beltKey)

    let belts = []
    for (let [beltKey, belt] of spec.belts) {
        belts.push(belt)
    }
    let form = d3.select("#belt_selector")
    form.selectAll("*").remove()
    let beltOption = form.selectAll("span")
        .data(belts)
        .join("span")
    beltOption.append("input")
        .attr("id", d => "belt." + d.key)
        .attr("type", "radio")
        .attr("name", "belt")
        .attr("value", d => d.key)
        .attr("checked", d => d === spec.belt ? "" : null)
        .on("change", beltHandler)
    beltOption.append("label")
        .attr("for", d => "belt." + d.key)
        .append(d => d.icon.make(32))
}

// visualizer

function renderVisualizer(settings) {
    if (settings.has("vt")) {
        setVisualizerType(settings.get("vt"))
    } else {
        setVisualizerType(DEFAULT_VISUALIZER)
    }
    d3.select(`#${visualizerType}_type`).attr("checked", true)
    if (settings.has("vr")) {
        setVisualizerRender(settings.get("vr"))
    } else {
        setVisualizerRender(DEFAULT_RENDER)
    }
    d3.select(`#${visualizerRender}_render`).attr("checked", true)
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
    moduleDropdown(select, [cell])
    cell = new SecondaryModuleCell()
    select = d3.select("#secondary_module")
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
        spec.setDefaultBeacon(this.module, this.cell.index)
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
    moduleDropdown(select, cells)
    d3.select("#default_beacon_count")
        .attr("value", defaultCount.toDecimal())
        .on("change", (event) => {
            spec.setDefaultBeaconCount(Rational.from_string(event.target.value))
            spec.display()
        })
}

// recipe disabling

function renderRecipes(settings) {
    if (settings.has("disable")) {
        let keys = settings.get("disable").split(",")
        for (let k of keys) {
            let recipe = spec.recipes.get(k)
            if (recipe) {
                spec.setDisable(recipe)
            }
        }
    } else {
        spec.setDefaultDisable()
    }

    let allGroups = getRecipeGroups(new Set(spec.recipes.values()))
    let groups = []
    for (let group of allGroups) {
        if (group.size > 1) {
            groups.push(Array.from(group))
        }
    }

    let div = d3.select("#recipe_toggles")
    div.selectAll("*").remove()
    let recipe = div.selectAll("div")
        .data(groups)
        .join("div")
            .classed("toggle-row", true)
            .selectAll("div")
            .data(d => d)
            .join("div")
                .classed("toggle recipe", true)
                .classed("selected", d => !spec.disable.has(d))
                .attr("title", d => d.name)
                .on("click", function(event, d) {
                    let disabled = spec.disable.has(d)
                    d3.select(this).classed("selected", disabled)
                    if (disabled) {
                        spec.setEnable(d)
                    } else {
                        spec.setDisable(d)
                    }
                    spec.updateSolution()
                })
    renderRecipe(recipe)
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
    d3.select("#render_debug").attr("checked", spec.debug ? true : null)
}

export function renderSettings(settings) {
    renderTitle(settings)
    renderIgnore(settings)
    renderRateOptions(settings)
    renderPrecisions(settings)
    renderValueFormat(settings)
    renderColorScheme(settings)
    renderBelts(settings)
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
