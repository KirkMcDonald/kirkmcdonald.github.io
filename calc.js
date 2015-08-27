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

function ModuleHandler(item, index) {
    this.handleEvent = function(event) {
        moduleUpdate(event, item, index)
    }
}

function displayReqs(item_name, rate, factories) {
    var item = items[item_name]
    if (factories) {
        rate = item.rate(factories)
        var rateBox = document.getElementById("rate")
        rateBox.value = rate
    } else {
        factories = item.factories(rate)[0]
        var factoryBox = document.getElementById("factories")
        factoryBox.value = factories
    }

    var reqs = item.requirements(rate)
    var innerRequirements = reqs[0]
    var requirements = [Requirement(rate, item, innerRequirements)]
    var totals = reqs[1]
    totals[item_name] = rate

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
        nameCell.innerHTML = item
        row.appendChild(nameCell)

        factoryInfo = items[item].factories(rate)
        var factoryCount = factoryInfo[0]
        if (factoryCount) {
            var factory = factoryInfo[2]

            var factoryCell = document.createElement("td")
            factoryCell.className = "right-align"
            factoryCell.innerHTML = sprintf("%s x%d", factory.name, factoryCount)
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
                noMod.innerHTML = "no module"
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
                    option.innerHTML = name
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

var changedFactory = true

function itemUpdate() {
    var itemSelector = document.getElementById("item")
    var item = itemSelector.value
    if (changedFactory) {
        var factories = document.getElementById("factories")
        displayReqs(item, null, factories.value)
    } else {
        var rate = document.getElementById("rate")
        displayReqs(item, rate.value, null)
    }
}

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

function factoryUpdate() {
    changedFactory = true
    var factories = document.getElementById("factory_label")
    factories.className = "bold"
    var rate = document.getElementById("rate_label")
    rate.className = ""
    itemUpdate()
}

function rateUpdate() {
    changedFactory = false
    var factories = document.getElementById("factory_label")
    factories.className = ""
    var rate = document.getElementById("rate_label")
    rate.className = "bold"
    itemUpdate()
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

var items
var modules

function init() {
    loadStuff(function(data) {
        var graph = getRecipeGraph(data, false)
        loadModules(data)

        items = graph[0]
        
        var defaultItem = "advanced-circuit"
        
        var itemSelector = document.getElementById("item")
        var sortedItems = sorted(items)
        for (var i=0; i<sortedItems.length; i++) {
            var item = sortedItems[i]
            var option = document.createElement("option")
            option.innerHTML = item
            option.value = item
            if (item == defaultItem) {
                option.selected = true
            }
            itemSelector.appendChild(option)
        }

        itemUpdate()
    })
}
