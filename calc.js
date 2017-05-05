function displaySteps(reqs, steps) {
    reqs.sort(function(a, b) {
        if (a.item.name < b.item.name) {
            return -1
        } else if (a.item.name > b.item.name) {
            return 1
        } else return 0
    })
    for (var i=0; i < reqs.length; i++) {
        var req = reqs[i]
        var li = document.createElement("li")
        li.innerHTML = sprintf("<tt>%.3f</tt> %s", req.rate, req.item.name)
        steps.appendChild(li)
        if (req.dependencies.length > 0) {
            var subUL = document.createElement("ul")
            li.appendChild(subUL)
            displaySteps(req.dependencies, subUL)
        }
    }
}

function sorted(obj, compareFunc) {
    var keys = []
    for (var i in obj) {
        keys.push(i)
    }
    keys.sort(compareFunc)
    return keys
}

function itemUpdate() {
    var requirements = []
    var totals = new Totals()
    for (var i=0; i<build_targets.length; i++) {
        var target = build_targets[i]
        var item = items[target.itemName]
        var rate = target.getRate()
        var reqs = item.requirements(rate)
        var innerRequirements = reqs[0]
        requirements.push(Requirement(rate, item, innerRequirements))
        reqs[1].add(target.itemName, rate)
        totals.merge(reqs[1])
    }

    window.location.hash = "#" + formatSettings()

    var oldSteps = document.getElementById("steps")
    var newSteps = document.createElement("ul")
    newSteps.id = "steps"
    document.body.replaceChild(newSteps, oldSteps)

    displaySteps(requirements, newSteps)

    var oldTotals = document.getElementById("totals")
    var newTotals = document.createElement("table")
    newTotals.id = "totals"
    var header = document.createElement("tr")
    header.innerHTML = '<th>rate</th><th>item</th><th>factory count</th><th>real factory count</th><th colspan="4">modules</th>'
    newTotals.appendChild(header)
    document.body.replaceChild(newTotals, oldTotals)
    
    var sorted_totals = sorted(totals.totals)
    for (var i in sorted_totals) {
        var itemName = sorted_totals[i]
        var rate = totals.get(itemName)
        var row = document.createElement("tr")

        var rateCell = document.createElement("td")
        rateCell.className = "right-align"
        rateCell.innerHTML = sprintf("<tt>%.3f</tt>", rate)
        row.appendChild(rateCell)

        var nameCell = document.createElement("td")
        nameCell.className = "right-align"
        nameCell.textContent = itemName
        row.appendChild(nameCell)

        factoryInfo = items[itemName].factories(rate)
        var factoryCount = factoryInfo[0]
        if (factoryCount) {
            var factory = factoryInfo[2]

            var factoryCell = document.createElement("td")
            factoryCell.className = "right-align"
            factoryCell.textContent = sprintf("%s x%d", factory.name, factoryCount)
            row.appendChild(factoryCell)

            var realCell = document.createElement("td")
            realCell.className = "right-align"
            realCell.innerHTML = sprintf("<tt>%.3f</tt>", factoryInfo[1])
            row.appendChild(realCell)

            var currentModules = moduleSpec[itemName]

            for (var j=0; j<factory.modules; j++) {
                var currentSpec = null
                if (currentModules) {
                    currentSpec = currentModules.getModule(j)
                }

                var modCell = document.createElement("td")
                row.appendChild(modCell)

                var select = document.createElement("select")
                select.addEventListener("change", new ModuleHandler(itemName, j))
                modCell.appendChild(select)

                var noMod = document.createElement("option")
                noMod.textContent = "no module"
                if (!currentSpec) {
                    noMod.selected = true
                }
                select.appendChild(noMod)

                for (var name in modules) {
                    var module = modules[name]
                    if (module.limit
                            && Object.keys(module.limit).length > 0
                            && !(itemName in module.limit)) {
                        continue
                    }
                    var option = document.createElement("option")
                    option.textContent = name
                    if (currentSpec && currentSpec.name == name) {
                        option.selected = true
                    }
                    select.appendChild(option)
                }
            }
        }
        newTotals.appendChild(row)
    }
}

////
// Event handling.
////

var DEFAULT_ITEM = "advanced-circuit"

var build_targets = []

function addTarget(itemName) {
    var target = new BuildTarget(build_targets.length, itemName)
    build_targets.push(target)
    var targetList = document.getElementById("targets")
    var plus = targetList.replaceChild(target.element, targetList.lastChild)
    targetList.appendChild(plus)
    return target
}

function plusHandler() {
    addTarget()
    itemUpdate()
}

function ItemHandler(target) {
    this.handleEvent = function(event) {
        target.itemName = event.target.value
        itemUpdate()
    }
}

function RemoveHandler(target) {
    this.handleEvent = function(event) {
        build_targets.splice(target.index, 1)
        for (var i=target.index; i < build_targets.length; i++) {
            build_targets[i].index--
        }
        target.element.remove()
        itemUpdate()
    }
}

function FactoryHandler(target) {
    this.handleEvent = function(event) {
        target.factoriesChanged()
        itemUpdate()
    }
}

function RateHandler(target) {
    this.handleEvent = function(event) {
        target.rateChanged()
        itemUpdate()
    }
}

function BuildTarget(index, itemName) {
    if (!itemName) {
        itemName = DEFAULT_ITEM
    }
    this.index = index
    this.itemName = itemName
    this.changedFactory = true
    this.element = document.createElement("li")

    var itemSelector = document.createElement("select")
    itemSelector.addEventListener("change", new ItemHandler(this))
    this.element.appendChild(itemSelector)

    var sortedItems = sorted(items)
    for (var i=0; i<sortedItems.length; i++) {
        var item = sortedItems[i]
        var option = document.createElement("option")
        option.textContent = item
        option.value = item
        if (item == this.itemName) {
            option.selected = true
        }
        itemSelector.appendChild(option)
    }

    var remover = document.createElement("a")
    remover.addEventListener("click", new RemoveHandler(this))
    remover.textContent = "x"
    this.element.appendChild(remover)

    this.element.appendChild(document.createElement("br"))

    this.factoryLabel = document.createElement("label")
    this.factoryLabel.className = "bold"
    // TODO: htmlFor
    this.factoryLabel.textContent = "Factories:"
    this.element.appendChild(this.factoryLabel)

    this.factories = document.createElement("input")
    this.factories.addEventListener("change", new FactoryHandler(this))
    this.factories.type = "text"
    this.factories.value = 1
    this.factories.size = 3
    this.element.appendChild(this.factories)

    this.rateLabel = document.createElement("label")
    this.rateLabel.textContent = "Rate:"
    this.element.appendChild(this.rateLabel)

    this.rate = document.createElement("input")
    this.rate.addEventListener("change", new RateHandler(this))
    this.rate.type = "text"
    this.rate.value = ""
    this.rate.size = 5
    this.element.appendChild(this.rate)
}
BuildTarget.prototype = {
    constructor: BuildTarget,
    // Returns the rate at which this item is being requested. Also updates
    // the text boxes in response to changes in options.
    getRate: function() {
        var item = items[this.itemName]
        var rate = 0
        if (this.changedFactory) {
            rate = item.rate(this.factories.value)
            this.rate.value = rate
        } else {
            rate = Number(this.rate.value)
            var factories = item.factories(rate)[0]
            this.factories.value = factories
        }
        return rate
    },
    factoriesChanged: function() {
        this.changedFactory = true
        this.factoryLabel.className = "bold"
        this.rateLabel.className = ""
    },
    setFactories: function(factories) {
        this.factories.value = factories
        this.factoriesChanged()
    },
    rateChanged: function() {
        this.changedFactory = false
        this.factoryLabel.className = ""
        this.rateLabel.className = "bold"
    },
    setRate: function(rate) {
        this.rate.value = rate
        this.rateChanged()
    }
}

function itemChanged() {
    moduleSpec = {}
    itemUpdate()
}

function getThreeValue() {
    var checkbox = document.getElementById("use_3")
    return checkbox.checked
}

function threeUpdate() {
    var graph = getRecipeGraph(data, getThreeValue())
    items = graph[0]
    itemUpdate()
}

function ModuleHandler(itemName, index) {
    this.handleEvent = function(event) {
        moduleUpdate(event, itemName, index)
    }
}

function moduleUpdate(event, itemName, x) {
    var moduleName = event.target.value
    setModule(itemName, x, moduleName)
    itemUpdate()
}

function toggleVisible(id) {
    var elem = document.getElementById(id)
    if (elem.style.display == "none") {
        elem.style.display = "block"
    } else {
        elem.style.display = "none"
    }
}

function currentMod() {
    var elem = document.getElementById("data_set")
    return elem.value
}

function changeMod() {
    var modName = currentMod()

    reset()
    loadData(modName)
}

////
// Initialization
////

function Modification(name, filename) {
    this.name = name
    this.filename = filename
}

var MODIFICATIONS = {
    "0-15-9": new Modification("Vanilla 0.15.9", "vanilla-0.15.9.json"),
    "0-15-9x": new Modification("Vanilla 0.15.9 - Expensive", "vanilla-0.15.9-expensive.json"),
    "0-15-1": new Modification("Vanilla 0.15.1", "vanilla-0.15.1.json"),
    "vanilla": new Modification("Vanilla 0.14.22", "vanilla.json"),
    "revolution": new Modification("Research Revolution", "revolution.json"),
}

var DEFAULT_MODIFICATION = "0-15-9"

// Global mapping of item name to Item, Resource, or MineableResource object.
var items

// Global mapping of module name to Module object.
var modules

// Global containing game data source.
var data

// Set the page back to a state immediately following initial setup, but before
// the dataset is loaded for the first time.
//
// This is intended to be called when the top-level dataset is changed.
// Therefore, it also resets the fragment and settings.
function reset() {
    window.location.hash = ""

    build_targets = []
    var targetList = document.getElementById("targets")
    var plus = targetList.lastChild
    var newTargetList = document.createElement("ul")
    newTargetList.id = "targets"
    newTargetList.appendChild(plus)
    document.body.replaceChild(newTargetList, targetList)

    var oldSteps = document.getElementById("steps")
    var newSteps = document.createElement("ul")
    newSteps.id = "steps"
    document.body.replaceChild(newSteps, oldSteps)

    var oldTotals = document.getElementById("totals")
    var newTotals = document.createElement("table")
    newTotals.id = "totals"
    document.body.replaceChild(newTotals, oldTotals)
}

function loadDataRunner(modName, callback) {
    var xobj = new XMLHttpRequest()
    var mod = MODIFICATIONS[modName]
    var filename = "data/" + mod.filename
    xobj.overrideMimeType("application/json")
    xobj.open("GET", filename, true)
    xobj.onreadystatechange = function() {
        if (xobj.readyState == 4 && xobj.status == "200") {
            data = JSON.parse(xobj.responseText)
            callback(data)
        }
    }
    xobj.send(null)
}

function loadData(modName, settings) {
    if (!settings) {
        settings = {}
    }
    if ("data" in settings && settings.data != "") {
        modName = settings.data
    }
    loadDataRunner(modName, function(data) {
        var useThree = false
        if ("use_3" in settings && settings.use_3 == "true") {
            useThree = true
            var checkbox = document.getElementById("use_3")
            checkbox.checked = true
        }
        var graph = getRecipeGraph(data, useThree)
        loadModules(data)

        items = graph[0]
        
        if ("items" in settings && settings.items != "") {
            var targets = settings.items.split(",")
            for (var i=0; i < targets.length; i++) {
                var targetString = targets[i]
                var parts = targetString.split(":")
                var name = parts[0]
                var target = addTarget(name)
                var type = parts[1]
                if (type == "f") {
                    target.setFactories(parts[2])
                } else if (type == "r") {
                    target.setRate(parts[2])
                } else {
                    throw new Error("unknown target type")
                }
            }
        } else {
            addTarget()
        }
        if ("modules" in settings && settings.modules != "") {
            var moduleSettings = settings.modules.split(",")
            for (var i=0; i < moduleSettings.length; i++) {
                var singleModuleSettings = moduleSettings[i].split(":")
                var itemName = singleModuleSettings[0]
                var modules = singleModuleSettings.slice(1)
                for (var j=0; j < modules.length; j++) {
                    var moduleName = modules[j]
                    if (moduleName && moduleName != "null") {
                        setModule(itemName, j, modules[j])
                    }
                }
            }
        }
        itemUpdate()
    })
}

function init() {
    var settings = loadSettings(window.location.hash)
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
    loadData(DEFAULT_MODIFICATION, settings)
}
