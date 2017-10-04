"use strict"

function OutputRecipe() {
    this.ingredients = []
    for (var i = 0; i < build_targets.length; i++) {
        var target = build_targets[i]
        var item = solver.items[target.itemName]
        var ing = new Ingredient(target.getRate(), item)
        this.ingredients.push(ing)
    }
}

function makeGraph(totals, ignore) {
    var g = new dagreD3.graphlib.Graph({multigraph: true})
    g.setGraph({})
    g.setDefaultEdgeLabel(function() { return  {} })
    for (var recipeName in totals.totals) {
        var rate = totals.totals[recipeName]
        var recipe = solver.recipes[recipeName]
        var factoryCount = spec.getCount(recipe, rate)
        var im = getImage(recipe)
        if (ignore[recipeName]) {
            im.classList.add("ignore")
        }
        var label = sprintf(
            "%s \u00d7 %s/%s",
            im.outerHTML,
            displayRate(rate),
            rateName
        )
        if (!factoryCount.isZero()) {
            var factory = spec.getFactory(recipe)
            var im = getImage(factory.factory)
            if (ignore[recipeName]) {
                im.classList.add("ignore")
            }
            label += sprintf(
                " (%s \u00d7 %s)",
                im.outerHTML,
                displayCount(factoryCount)
            )
        }
        g.setNode(recipeName, {"label": label, "labelType": "html"})
    }
    for (var itemName in totals.unfinished) {
        g.setNode(itemName, {"label": "unknown " + itemName + " recipe", "labelType": "html"})
    }
    g.setNode("output", {"label": "output", "labelType": "html"})
    var nodes = Object.keys(totals.totals).concat(["output"])
    for (var recipeIndex = 0; recipeIndex < nodes.length; recipeIndex++) {
        var recipeName = nodes[recipeIndex]
        if (ignore[recipeName]) {
            continue
        }
        var recipe
        if (recipeName == "output") {
            recipe = new OutputRecipe()
        } else {
            recipe = solver.recipes[recipeName]
        }
        for (var i = 0; i < recipe.ingredients.length; i++) {
            var ing = recipe.ingredients[i]
            var totalRate = zero
            for (var j = 0; j < ing.item.recipes.length; j++) {
                var subRecipe = ing.item.recipes[j]
                if (subRecipe.name in totals.totals) {
                    totalRate = totalRate.add(totals.totals[subRecipe.name].mul(subRecipe.gives(ing.item, spec)))
                }
            }
            for (var j = 0; j < ing.item.recipes.length; j++) {
                var subRecipe = ing.item.recipes[j]
                if (subRecipe.name in totals.totals) {
                    var rate
                    if (recipeName == "output") {
                        rate = ing.amount
                    } else {
                        rate = totals.totals[recipeName].mul(ing.amount)
                    }
                    var ratio = rate.div(totalRate)
                    var subRate = totals.totals[subRecipe.name].mul(subRecipe.gives(ing.item, spec)).mul(ratio)
                    var label = sprintf(
                        "%s \u00d7 %s/%s",
                        getImage(ing.item).outerHTML,
                        displayRate(subRate),
                        rateName
                    )
                    g.setEdge(subRecipe.name, recipeName, {
                        "label": label,
                        "labelType": "html",
                        "labelpos": "c"
                    }, sprintf("%s-%s-%s", subRecipe.name, recipeName, ing.item.name))
                }
            }
            if (ing.item.name in totals.unfinished) {
                var rate = totals.totals[recipeName].mul(ing.amount)
                var label = sprintf(
                    "%s \u00d7 %s/%s",
                    getImage(ing.item).outerHTML,
                    displayRate(rate),
                    rateName
                )
                g.setEdge(ing.item.name, recipeName, {
                    "label": label,
                    "labelType": "html",
                    "labelpos": "c"
                })
            }
        }
    }
    return g
}

function renderGraph(totals, ignore) {
    var g = makeGraph(totals, ignore)
    var svg = d3.select("svg")
    var inner = svg.select("g")
    inner.remove()
    inner = svg.append("g")
    var render = new dagreD3.render()
    render(inner, g)
    svg.attr("width", g.graph().width + 50)
    svg.attr("height", g.graph().height + 50)
    var xCenterOffset = (svg.attr("width") - g.graph().width) / 2
    var yCenterOffset = (svg.attr("height") - g.graph().height) / 2
    inner.attr("transform", "translate(" + xCenterOffset + ", " + yCenterOffset + ")")
}
