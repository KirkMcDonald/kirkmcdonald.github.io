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
import { DEFAULT_RATE, DEFAULT_RATE_PRECISION, DEFAULT_COUNT_PRECISION, DEFAULT_FORMAT } from "./align.js"
import { DEFAULT_TAB, currentTab, DEFAULT_VISUALIZER, visualizerType, DEFAULT_RENDER, visualizerRender, isDefaultVisDirection, visualizerDirection } from "./events.js"
import { spec, DEFAULT_BELT, DEFAULT_FUEL } from "./factory.js"
import { Rational } from "./rational.js"
import { currentMod, DEFAULT_TITLE, DEFAULT_COLOR_SCHEME, colorScheme } from "./settings.js"
import { sorted } from "./sort.js"

function getModuleKey(module) {
    let moduleKey
    if (module === null) {
        moduleKey = "null"
    } else {
        moduleKey = module.shortName()
    }
    return moduleKey
}

export function formatSettings(excludeTitle, overrideTab, targets) {
    let settings = ""
    if (!excludeTitle && document.title !== DEFAULT_TITLE) {
        settings += "title=" + encodeURIComponent(document.title) + "&"
    }
    settings += "data=" + currentMod() + "&"
    let tab = currentTab
    if (overrideTab) {
        tab = overrideTab
    }
    if (tab !== DEFAULT_TAB) {
        settings += "tab=" + tab + "&"
    }
    if (colorScheme.key !== DEFAULT_COLOR_SCHEME) {
        settings += "c=" + colorScheme.key + "&"
    }
    if (spec.format.rateName !== DEFAULT_RATE) {
        settings += "rate=" + spec.format.rateName + "&"
    }
    if (spec.format.ratePrecision !== DEFAULT_RATE_PRECISION) {
        settings += "rp=" + spec.format.ratePrecision + "&"
    }
    if (spec.format.countPrecision !== DEFAULT_COUNT_PRECISION) {
        settings += "cp=" + spec.format.countPrecision + "&"
    }
    if (spec.format.displayFormat !== DEFAULT_FORMAT) {
        settings += "vf=" + spec.format.displayFormat[0] + "&"
    }
    if (!spec.miningProd.isZero()) {
        let hundred = Rational.from_float(100)
        let mprod = spec.miningProd.mul(hundred).toString()
        settings += "mprod=" + mprod + "&"
    }
    let buildings = []
    let groupSet = new Set(spec.buildings.values())
    for (let group of groupSet) {
        if (group.building !== group.getDefault()) {
            buildings.push(group.building.key)
        }
    }
    if (buildings.length > 0) {
        settings += "buildings=" + buildings.join(",") + "&"
    }
    if (spec.advancedBuildings.size > 0) {
        let advancedKeys = Array.from(spec.advancedBuildings)
            .map(b => b.key)
            .join(",")
        settings += "advancedbuildings=" + advancedKeys + "&"
    }
    if (spec.belt.key !== DEFAULT_BELT) {
        settings += "belt=" + spec.belt.key + "&"
    }
    if (spec.fuel.key !== DEFAULT_FUEL) {
        settings += "fuel=" + spec.fuel.key + "&"
    }
    if (spec.defaultModule !== null) {
        settings += "dm=" + spec.defaultModule.shortName() + "&"
    }
    if (spec.secondaryDefaultModule !== null) {
        settings += "dm2=" + spec.secondaryDefaultModule.shortName() + "&"
    }
    if (!spec.isDefaultDefaultBeacon()) {
        let parts = []
        for (let module of spec.defaultBeacon) {
            if (module === null) {
                parts.push("null")
            } else {
                parts.push(module.shortName())
            }
        }
        settings += "db=" + parts.join(":") + "&"
    }
    if (!spec.defaultBeaconCount.isZero()) {
        settings += "dbc=" + spec.defaultBeaconCount.toDecimal(0) + "&"
    }
    if (visualizerType !== DEFAULT_VISUALIZER) {
        settings += "vt=" + visualizerType + "&"
    }
    if (visualizerRender !== DEFAULT_RENDER) {
        settings += "vr=" + visualizerRender + "&"
    }
    if (!isDefaultVisDirection()) {
        settings += "vd=" + visualizerDirection + "&"
    }

    settings += "items="
    let targetStrings = []
    if (targets) {
        for (let [item, rate] of targets) {
            targetStrings.push(`${item.key}:r:${rate.mul(spec.format.rateFactor).toString()}`)
        }
    } else {
        for (let target of spec.buildTargets) {
            let targetString = ""
            if (target.changedBuilding) {
                targetString = `${target.itemKey}:f:${target.buildingInput.value}`
                if (target.recipe !== null && target.recipe !== target.defaultRecipe) {
                    targetString += `:${target.recipe.key}`
                }
            } else {
                targetString = `${target.itemKey}:r:${target.rate.mul(spec.format.rateFactor).toString()}`
            }
            targetStrings.push(targetString)
        }
    }
    settings += targetStrings.join(",")

    let ignore = []
    for (let item of spec.ignore) {
        ignore.push(item.key)
    }
    if (ignore.length > 0) {
        settings += "&ignore=" + ignore.join(",")
    }

    if (!spec.isDefaultPlanet()) {
        let planets = []
        for (let p of sorted(spec.selectedPlanets, p => p.order)) {
            planets.push(p.key)
        }
        settings += "&planet=" + planets.join(",")
    }
    let { disable, enable } = spec.getNetDisable()
    if (disable.size !== 0) {
        let parts = []
        for (let d of disable) {
            parts.push(d.key)
        }
        settings += "&disable=" + parts.join(",")
    }
    if (enable.size !== 0) {
        let parts = []
        for (let d of enable) {
            parts.push(d.key)
        }
        settings += "&enable=" + parts.join(",")
    }

    let moduleSettings = []
    for (let [recipe, moduleSpec] of spec.spec) {
        if (!spec.lastTotals || !spec.lastTotals.rates.has(recipe)) {
            continue
        }
        let modules = []
        let beacon = ""
        let any = false
        for (let module of moduleSpec.modules) {
            if (module !== spec.getDefaultModule(recipe)) {
                modules.push(getModuleKey(module))
                any = true
            }
        }
        if (moduleSpec.beaconModules[0] !== spec.defaultBeacon[0] || moduleSpec.beaconModules[1] !== spec.defaultBeacon[1] || !moduleSpec.beaconCount.equal(spec.defaultBeaconCount)) {
            let beaconKeys = []
            for (let module of moduleSpec.beaconModules) {
                beaconKeys.push(getModuleKey(module))
            }
            beacon = beaconKeys.join(":") + ":" + moduleSpec.beaconCount.toString()
            any = true
        }
        if (any) {
            let s = recipe.key + ":" + modules.join(":")
            if (beacon !== "") {
                s += ";" + beacon
            }
            moduleSettings.push(s)
        }
    }
    if (moduleSettings.length > 0) {
        settings += "&modules=" + moduleSettings.join(",")
    }

    if (!spec.isDefaultPriority()) {
        let priority = []
        for (let level of spec.priority) {
            let keys = []
            for (let { recipe, weight } of level) {
                keys.push(`${recipe.key}=${weight.toString()}`)
            }
            priority.push(keys.join(","))
        }
        settings += "&priority=" + priority.join(";")
    }

    if (spec.debug) {
        settings += "&debug=1"
    }

    let zip = "zip=" + window.btoa(String.fromCharCode.apply(null, pako.deflateRaw(settings)))
    if (zip.length < settings.length) {
        return zip
    }
    return settings
}

export function loadSettings(fragment) {
    let settings = new Map()
    fragment = fragment.substr(1)
    let pairs = fragment.split("&")
    for (let pair of pairs) {
        let i = pair.indexOf("=")
        if (i === -1) {
            continue
        }
        let name = pair.substr(0, i)
        let value = pair.substr(i + 1)
        settings.set(name, value)
    }
    if (settings.has("zip")) {
        let z = window.atob(settings.get("zip"))
        let a = z.split("").map(c => c.charCodeAt(0))
        let unzip = pako.inflateRaw(a, { to: "string" })
        return loadSettings("#" + unzip)
    }
    return settings
}
