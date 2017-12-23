"use strict"

function formatSettings() {
    var settings = ""
    if (currentTab != DEFAULT_TAB) {
        settings += "tab=" + currentTab.slice(0, currentTab.indexOf("_")) + "&"
    }
    var mod = currentMod()
    if (mod != DEFAULT_MODIFICATION) {
        settings += "data=" + mod + "&"
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
    if (displayFormat != DEFAULT_FORMAT) {
        settings += "vf=" + displayFormat[0] + "&"
    }
    if (theme.name != DEFAULT_THEME.name) {
        settings += "theme=" + theme.name + "&"
    }

    settings += "items="
    var targetStrings = []
    for (var i = 0; i < build_targets.length; i++) {
        var target = build_targets[i]
        var targetString = ""
        if (target.changedFactory) {
            targetString = sprintf("%s:f:%s", target.itemName, target.factories.value)
        } else {
            targetString = sprintf("%s:r:%s", target.itemName, target.rateValue.mul(displayRateFactor).toString())
        }
        targetStrings.push(targetString)
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
            if (module) {
                modules.push(module.shortName())
                any = true
            }
        }
        if (factory.beaconModule || !factory.beaconCount.equal(spec.defaultBeaconCount)) {
            var beaconModule = factory.beaconModule
            if (!beaconModule) {
                beaconModule = spec.defaultBeacon
            }
            if (beaconModule) {
                any = true
                var moduleName = beaconModule.shortName()
                beacon = sprintf("%s:%d", moduleName, factory.beaconCount.toFloat())
            }
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
