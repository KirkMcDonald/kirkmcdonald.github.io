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
    var totals = {}
    for (var i=0; i<build_targets.length; i++) {
        var target = build_targets[i]
        var item = items[target.itemName]
        var rate = target.getRate()
        var reqs = item.requirements(rate)
        var innerRequirements = reqs[0]
        requirements.push(Requirement(rate, item, innerRequirements))
        reqs[1][target.itemName] = rate
        addCounts(totals, reqs[1])
    }

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
    
    var sorted_totals = sorted(totals)
    for (var i in sorted_totals) {
        var item = sorted_totals[i]
        var rate = totals[item]
        var row = document.createElement("tr")

        var rateCell = document.createElement("td")
        rateCell.className = "right-align"
        rateCell.innerHTML = sprintf("<tt>%.3f</tt>", rate)
        row.appendChild(rateCell)

        var nameCell = document.createElement("td")
        nameCell.className = "right-align"
        nameCell.textContent = item
        row.appendChild(nameCell)

        factoryInfo = items[item].factories(rate)
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

            var currentModules = moduleSpec[item]

            for (var j=0; j<factory.modules; j++) {
                var currentSpec = null
                if (currentModules) {
                    currentSpec = currentModules.getModule(j)
                }

                var modCell = document.createElement("td")
                row.appendChild(modCell)

                var select = document.createElement("select")
                select.addEventListener("change", new ModuleHandler(item, j))
                modCell.appendChild(select)

                var noMod = document.createElement("option")
                noMod.textContent = "no module"
                if (!currentSpec) {
                    noMod.selected = true
                }
                select.appendChild(noMod)

                modloop: for (var name in modules) {
                    var module = modules[name]
                    if (module.limit) {
                        var valid = false
                        for (var k=0; k < module.limit.length; k++) {
                            if (module.limit[k] == item) {
                                valid = true
                            }
                        }
                        if (!valid) continue modloop
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

function addTarget() {
    var target = new BuildTarget(build_targets.length)
    build_targets.push(target)
    var targetList = document.getElementById("targets")
    var plus = targetList.replaceChild(target.element, targetList.lastChild)
    targetList.appendChild(plus)
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
        target.changedFactory = true
        target.factoryLabel.className = "bold"
        target.rateLabel.className = ""
        itemUpdate()
    }
}

function RateHandler(target) {
    this.handleEvent = function(event) {
        target.changedFactory = false
        target.factoryLabel.className = ""
        target.rateLabel.className = "bold"
        itemUpdate()
    }
}

function BuildTarget(index) {
    this.index = index
    this.itemName = DEFAULT_ITEM
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
        if (item == this.item) {
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
            rate = this.rate.value
            var factories = item.factories(rate)[0]
            this.factories.value = factories
        }
        return rate
    }
}

var changedFactory = true

function itemChanged() {
    moduleSpec = {}
    itemUpdate()
}

function threeUpdate() {
    var checkbox = document.getElementById("use_3")
    var graph = getRecipeGraph(stuff, checkbox.checked)
    items = graph[0]
    itemUpdate()
}

function ModuleHandler(item, index) {
    this.handleEvent = function(event) {
        moduleUpdate(event, item, index)
    }
}

function moduleUpdate(event, item, x) {
    var module = event.target.value
    if (!(item in moduleSpec)) {
        moduleSpec[item] = new ModuleSet()
    }
    var moduleObj = modules[module]
    moduleSpec[item].setModule(x, moduleObj)

    itemUpdate()
}

////
// Initialization
////

// Global mapping of item name to Item, Resource, or MineableResource object.
var items

// Global mapping of module name to Module object.
var modules

// Global containing game data source.
var stuff

function loadStuff(callback) {
    var xobj = new XMLHttpRequest()
    xobj.overrideMimeType("application/json")
    xobj.open("GET", "stuff.json", true)
    xobj.onreadystatechange = function() {
        if (xobj.readyState == 4 && xobj.status == "200") {
            stuff = JSON.parse(xobj.responseText)
            callback(stuff)
        }
    }
    xobj.send(null)
}

function init() {
    loadStuff(function(data) {
        var graph = getRecipeGraph(data, false)
        loadModules(data)

        items = graph[0]
        
        addTarget()
    })
}
