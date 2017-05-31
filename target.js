"use strict"

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

function BuildTarget(index, itemName) {
    if (!itemName) {
        itemName = DEFAULT_ITEM
    }
    this.index = index
    this.itemName = itemName
    this.changedFactory = true
    this.factoriesValue = one
    this.rateValue = zero
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
    for (var i = 0; i < itemGroups.length; i++) {
        var group = itemGroups[i]
        for (var j = 0; j < group.length; j++) {
            var subgroup = group[j]
            var any = false
            for (var k = 0; k < subgroup.length; k++) {
                var currentItem = subgroup[k]
                var currentItemName = currentItem.name
                var image = getImage(currentItemName)
                if (!image) {
                    continue
                }
                any = true
                var id = sprintf("target-%d-%d-%d-%d", this.index, i, j, k)
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
            if (any) {
                form.appendChild(document.createElement("br"))
            }
        }
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
            rate = baseRate.mul(this.factoriesValue)
            this.rate.value = rate.mul(displayRate).toFloat()
        } else {
            rate = this.rateValue
            var factories = rate.div(baseRate)
            this.factories.value = factories.toFloat()
            this.rate.value = rate.mul(displayRate).toFloat()
        }
        return rate
    },
    factoriesChanged: function() {
        this.changedFactory = true
        this.factoryLabel.className = "bold"
        this.rateLabel.className = ""
        this.factoriesValue = RationalFromString(this.factories.value)
        this.rateValue = zero
        this.rate.value = ""
    },
    setFactories: function(factories) {
        this.factories.value = factories
        this.factoriesChanged()
    },
    rateChanged: function() {
        this.changedFactory = false
        this.factoryLabel.className = ""
        this.rateLabel.className = "bold"
        this.factoriesValue = zero
        this.rateValue = RationalFromString(this.rate.value).div(displayRate)
        this.factories.value = ""
    },
    setRate: function(rate) {
        this.rate.value = rate
        this.rateChanged()
    }
}
