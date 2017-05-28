"use strict"

function formatSettings() {
    var settings = ""
    var mod = currentMod()
    if (mod != DEFAULT_MODIFICATION) {
        settings += "data=" + mod + "&"
    }
    if (rateName != DEFAULT_RATE) {
        settings += "rate=" + rateName + "&"
    }

    settings += "items="
    var targetStrings = []
    for (var i = 0; i < build_targets.length; i++) {
        var target = build_targets[i]
        var targetString = ""
        if (target.changedFactory) {
            targetString = sprintf("%s:f:%s", target.itemName, target.factories.value)
        } else {
            targetString = sprintf("%s:r:%s", target.itemName, target.rate.value)
        }
        targetStrings.push(targetString)
    }
    settings += targetStrings.join(",")
    var min = getMinimumValue()
    if (min != "1") {
        settings += "&min=" + getMinimumValue()
    }
    var specs = []
    for (var recipeName in spec.spec) {
        var factory = spec.spec[recipeName]
        var modules = []
        var beacon = ""
        var any = false
        for (var i=0; i < factory.modules.length; i++) {
            var module = factory.modules[i]
            if (module) {
                modules.push(module.name)
                any = true
            }
        }
        if (factory.beaconModule && !factory.beaconCount.isZero()) {
            any = true
            beacon = sprintf("%s:%d", factory.beaconModule.name, factory.beaconCount.toFloat())
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
    return settings
}
