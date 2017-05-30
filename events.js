"use strict"

var DEFAULT_ITEM = "advanced-circuit"

var build_targets = []

function displayRateHandler(event) {
    var value = event.target.value
    displayRate = displayRates[value]
    rateName = value
    itemUpdate()
}

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
    this.element.style.setProperty("vertical-align", "middle")

    var table = document.createElement("table")
    this.element.appendChild(table)
    var row = document.createElement("tr")
    table.appendChild(row)
    var cell = document.createElement("td")
    row.appendChild(cell)
    var dropdown = document.createElement("div")
    dropdown.classList.add("dropdown")
    dropdown.classList.add("itemDropdown")
    cell.appendChild(dropdown)
    var form = document.createElement("form")
    dropdown.appendChild(form)

    var handler = new ItemHandler(this)
    var sortedItems = sorted(solver.items)
    for (var i = 0; i < sortedItems.length; i++) {
        var currentItemName = sortedItems[i]
        var currentItem = solver.items[currentItemName]
        var image = getImage(currentItemName)
        if (!image) {
            continue
        }
        var id = "target-" + this.index + "-" + i
        var input = document.createElement("input")
        input.id = id
        input.name = "target"
        input.type = "radio"
        input.value = currentItemName
        if (currentItemName == this.itemName) {
            input.checked = true
        }
        input.addEventListener("change", handler)
        form.appendChild(input)
        var label = document.createElement("label")
        label.htmlFor = id
        label.appendChild(image)
        label.title = currentItemName
        form.appendChild(label)
    }

    var cell2 = document.createElement("td")
    // This prevents the dropdown from breaking the flow of the page while it
    // is deployed.
    var spacer = blankImage()
    spacer.classList.add("spacer")
    cell2.appendChild(spacer)

    this.factoryLabel = document.createElement("label")
    this.factoryLabel.className = "bold"
    // TODO: htmlFor
    this.factoryLabel.textContent = "Factories:"
    cell2.appendChild(this.factoryLabel)

    this.factories = document.createElement("input")
    this.factories.addEventListener("change", new FactoryHandler(this))
    this.factories.type = "text"
    this.factories.value = 1
    this.factories.size = 3
    this.factories.title = "Enter a value to specify number of factories. The rate will be determined based on the number of items a factory can make."
    cell2.appendChild(this.factories)

    this.rateLabel = document.createElement("label")
    this.rateLabel.textContent = "Rate:"
    cell2.appendChild(this.rateLabel)

    this.rate = document.createElement("input")
    this.rate.addEventListener("change", new RateHandler(this))
    this.rate.type = "text"
    this.rate.value = ""
    this.rate.size = 5
    this.rate.title = "Enter a value to specify the rate. The number of factories will be determined based on the rate."
    cell2.appendChild(this.rate)

    row.appendChild(cell2)
    var remover = document.createElement("a")
    remover.addEventListener("click", new RemoveHandler(this))
    remover.textContent = " x"
    remover.title = "Remove this item."
    cell2.appendChild(remover)
}
BuildTarget.prototype = {
    constructor: BuildTarget,
    // Returns the rate at which this item is being requested. Also updates
    // the text boxes in response to changes in options.
    getRate: function() {
        var item = solver.items[this.itemName]
        var rate = zero
        var recipe = item.recipes[0]
        var factory = spec.getFactory(recipe)
        var baseRate = factory.recipeRate(recipe).mul(recipe.gives(item, spec))
        if (this.changedFactory) {
            var factoryCount = RationalFromString(this.factories.value)
            rate = baseRate.mul(factoryCount)
            this.rate.value = rate.mul(displayRate).toFloat()
        } else {
            rate = RationalFromString(this.rate.value).div(displayRate)
            var factories = rate.div(baseRate)
            this.factories.value = factories.toFloat()
        }
        return rate
    },
    factoriesChanged: function() {
        this.changedFactory = true
        this.factoryLabel.className = "bold"
        this.rateLabel.className = ""
        this.rate.value = ""
    },
    setFactories: function(factories) {
        this.factories.value = factories
        this.factoriesChanged()
    },
    rateChanged: function() {
        this.changedFactory = false
        this.factoryLabel.className = ""
        this.factories.value = ""
        this.rateLabel.className = "bold"
    },
    setRate: function(rate) {
        this.rate.value = rate
        this.rateChanged()
    }
}

function getMinimumValue() {
    var min = document.getElementById("minimum_assembler")
    return min.value
}

function changeMin() {
    spec.setMinimum(getMinimumValue())
    itemUpdate()
}

function changeMprod(event) {
    var bonus = event.target.value
    setMprod(bonus)
    itemUpdate()
}

function setMprod(bonus) {
    var mprod = RationalFromFloats(Number(bonus), 100)
    spec.miningProd = mprod
}

function changeSortOrder(event) {
    sortOrder = event.target.value
    itemUpdate()
}

function getFactory(recipeName) {
    var recipe = solver.recipes[recipeName]
    return spec.getFactory(recipe)
}

function ModuleHandler(factory, index) {
    this.handleEvent = function(event) {
        var moduleName = event.target.value
        var module = modules[moduleName]
        factory.setModule(index, module)
        itemUpdate()
    }
}

function ModuleCopyHandler(factory) {
    this.handleEvent = function(event) {
        var module = factory.getModule(0)
        for (var i = 0; i < factory.modules.length; i++) {
            factory.setModule(i, module)
        }
        itemUpdate()
    }
}

function BeaconHandler(recipeName) {
    this.handleEvent = function(event) {
        var moduleName = event.target.value
        var module = modules[moduleName]
        var factory = getFactory(recipeName)
        factory.beaconModule = module
        itemUpdate()
    }
}

function BeaconCountHandler(recipeName) {
    this.handleEvent = function(event) {
        var moduleCount = RationalFromFloats(event.target.value, 1)
        var factory = getFactory(recipeName)
        factory.beaconCount = moduleCount
        itemUpdate()
    }
}

function CopyAllHandler(name) {
    this.handleEvent = function(event) {
        var factory = spec.spec[name]
        for (var recipeName in spec.spec) {
            if (recipeName == name) {
                continue
            }
            var f = spec.spec[recipeName]
            if (!f) {
                continue
            }
            var recipe = solver.recipes[recipeName]
            factory.copyModules(f, recipe)
        }
        itemUpdate()
    }
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

var currentTab = "totals_tab"

function clickTab(event, tabName) {
    currentTab = tabName
    var tabs = document.getElementsByClassName("tab")
    for (var i=0; i < tabs.length; i++) {
        tabs[i].style.display = "none"
    }

    var buttons = document.getElementsByClassName("tab_button")
    for (var i=0; i < buttons.length; i++) {
        buttons[i].classList.remove("active")
    }

    document.getElementById(tabName).style.display = "block"
    event.currentTarget.classList.add("active")
}

function clickVisualize(event, tabName) {
    clickTab(event, tabName)
    renderGraph(globalTotals)
}

