function formatSettings() {
    var settings = "data=" + currentMod()

    settings += "&items="
    var targetStrings = []
    for (var i=0; i < build_targets.length; i++) {
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
    settings += "&use_3="
    if (getThreeValue()) {
        settings += "true"
    } else {
        settings += "false"
    }
    settings += "&modules="
    var itemSpecs = []
    for (var itemName in moduleSpec) {
        var moduleSet = moduleSpec[itemName]
        var modules = []
        for (var i=0; i < moduleSet.modules.length; i++) {
            var module = moduleSet.modules[i]
            if (module) {
                modules.push(module.name)
            } else {
                modules.push("null")
            }
        }
        var itemSpec = sprintf("%s:%s", itemName, modules.join(":"))
        itemSpecs.push(itemSpec)
    }
    settings += itemSpecs.join(",")
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
        //var pair = pairs[i].split("=", 1)
        //settings[pair[0]] = pair[1]
        var name = pairs[i].substr(0, j)
        var value = pairs[i].substr(j + 1)
        settings[name] = value
    }
    return settings
}
