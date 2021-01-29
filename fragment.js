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

function formatSettings(targets) {
    var settings = ""
    if (currentTab != DEFAULT_TAB) {
        settings += "tab=" + currentTab.slice(0, currentTab.indexOf("_")) + "&"
    }
    if (showDebug != DEFAULT_DEBUG) {
        settings += "debug=on&"
    }
    var mod = currentMod()
    settings += "data=" + mod + "&"
    if (colorScheme.name != DEFAULT_COLOR_SCHEME) {
        settings += "c=" + colorScheme.name + "&"
    }
    if (rateName != DEFAULT_RATE) {
        settings += "rate=" + rateName + "&"
    }
    if (ratePrecision != DEFAULT_RATE_PRECISION) {
        settings += "rp=" + ratePrecision + "&"
    }
    if (countPrecision != DEFAULT_COUNT_PRECISION) {
        settings += "cp=" + countPrecision + "&"
    }
    if (minimumAssembler != DEFAULT_MINIMUM) {
        settings += "min=" + minimumAssembler + "&"
    }
    if (spec.furnace.name != DEFAULT_FURNACE) {
        settings += "furnace=" + spec.furnace.name + "&"
    }
    if (preferredFuel.name != DEFAULT_FUEL) {
        settings += "fuel=" + preferredFuel.name + "&"
    }
    if (oilGroup != DEFAULT_OIL) {
        settings += "p=" + oilGroup + "&"
    }
    if (kovarexEnabled != DEFAULT_KOVAREX) {
        settings += "k=off&"
    }
    if (preferredBelt != DEFAULT_BELT) {
        settings += "belt=" + preferredBelt + "&"
    }
    if (!minPipeLength.equal(DEFAULT_PIPE)) {
        settings += "pipe=" + minPipeLength.toDecimal(0) + "&"
    }
    if (!spec.miningProd.isZero()) {
        var hundred = RationalFromFloat(100)
        var mprod = spec.miningProd.mul(hundred).toString()
        settings += "mprod=" + mprod + "&"
    }
    if (spec.defaultModule) {
        settings += "dm=" + spec.defaultModule.shortName() + "&"
    }
    if (spec.defaultBeacon) {
        settings += "db=" + spec.defaultBeacon.shortName() + "&"
    }
    if (!spec.defaultBeaconCount.isZero()) {
        settings += "dbc=" + spec.defaultBeaconCount.toDecimal(0) + "&"
    }
    if (visualizer !== DEFAULT_VISUALIZER) {
        settings += "vis=" + visualizer + "&"
    }
    if (visDirection !== DEFAULT_DIRECTION) {
        settings += "vd=" + visDirection + "&"
    }
    if (maxNodeHeight !== DEFAULT_NODE_BREADTH) {
        settings += "nh=" + maxNodeHeight + "&"
    }
    if (linkLength !== DEFAULT_LINK_LENGTH) {
        settings += "ll=" + linkLength + "&"
    }
    if (displayFormat != DEFAULT_FORMAT) {
        settings += "vf=" + displayFormat[0] + "&"
    }
    if (tooltipsEnabled != DEFAULT_TOOLTIP) {
        settings += "t=off&"
    }

    settings += "items="
    var targetStrings = []
    if (!targets) {
        for (var i = 0; i < build_targets.length; i++) {
            var target = build_targets[i]
            var targetString = ""
            if (target.changedFactory) {
                targetString = sprintf("%s:f:%s", target.itemName, target.factories.value)
                if (target.recipeIndex != 0) {
                    targetString += ";" + target.recipeIndex
                }
            } else {
                targetString = sprintf("%s:r:%s", target.itemName, target.rateValue.mul(displayRateFactor).toString())
            }
            targetStrings.push(targetString)
        }
    } else {
        for (var itemName in targets) {
            var rate = targets[itemName]
            var targetString = sprintf("%s:r:%s", itemName, rate.mul(displayRateFactor).toString())
            targetStrings.push(targetString)
        }
    }
    settings += targetStrings.join(",")
    var ignore = []
    for (var recipeName in spec.ignore) {
        if (recipeName in globalTotals.totals) {
            ignore.push(recipeName)
        }
    }
    if (ignore.length > 0) {
        settings += "&ignore=" + ignore.join(",")
    }
    var specs = []
    for (var recipeName in spec.spec) {
        if (!(recipeName in globalTotals.totals)) {
            continue
        }
        var factory = spec.spec[recipeName]
        var modules = []
        var beacon = ""
        var any = false
        for (var i=0; i < factory.modules.length; i++) {
            var module = factory.modules[i]
            if (module !== spec.defaultModule) {
                var moduleName
                if (module) {
                    moduleName = module.shortName()
                } else {
                    moduleName = "null"
                }
                modules.push(moduleName)
                any = true
            }
        }
        if (factory.beaconModule !== spec.defaultBeacon || !factory.beaconCount.equal(spec.defaultBeaconCount)) {
            var beaconModule = factory.beaconModule
            var moduleName
            if (beaconModule) {
                moduleName = beaconModule.shortName()
            } else {
                moduleName = "null"
            }
            beacon = sprintf("%s:%d", moduleName, factory.beaconCount.toFloat())
            any = true
        }
        if (any) {
            var recipeSpec = sprintf("%s:%s", recipeName, modules.join(":"))
            if (beacon != "") {
                recipeSpec += ";" + beacon
            }
            specs.push(recipeSpec)
        }
    }
    if (specs.length > 0) {
        settings += "&modules=" + specs.join(",")
    }
    var zip = "zip=" + window.btoa(pako.deflateRaw(settings, {to: "string"}))
    if (zip.length < settings.length) {
        return zip
    }
    return settings
}

function loadSettings(fragment) {
    var settings = {}
    fragment = fragment.substr(1)
    var pairs = fragment.split("&")
    for (var i=0; i < pairs.length; i++) {
        var j = pairs[i].indexOf("=")
        if (j == -1) {
            continue
        }
        var name = pairs[i].substr(0, j)
        var value = pairs[i].substr(j + 1)
        settings[name] = value
    }
    if ("zip" in settings) {
        var unzip = pako.inflateRaw(window.atob(settings.zip), {to: "string"})
        return loadSettings("#" + unzip)
    }
    return settings
}
