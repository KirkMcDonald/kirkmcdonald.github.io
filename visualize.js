"use strict"

function makeGraph(totals) {
    var g = new dagreD3.graphlib.Graph()
    g.setGraph({})
    g.setDefaultEdgeLabel(function() { return  {} })
    for (var recipeName in totals.totals) {
        var rate = totals.totals[recipeName]
        var recipe = solver.recipes[recipeName]
        var factoryCount = spec.getCount(recipe, rate)
        var label = sprintf(
            "%s \u00d7 %.3f/%s",
            getImage(recipeName).outerHTML,
            rate.mul(displayRate).toFloat(),
            rateName
        )
        if (!factoryCount.isZero()) {
            var factory = spec.getFactory(recipe)
            label += sprintf(
                " (%s \u00d7 %.3f)",
                getImage(factory.name).outerHTML,
                factoryCount.toFloat()
            )
        }
        g.setNode(recipeName, {"label": label, "labelType": "html"})
    }
    for (var itemName in totals.unfinished) {
        g.setNode(itemName, {"label": "unknown " + itemName + " recipe"})
    }
    for (var recipeName in totals.totals) {
        var recipe = solver.recipes[recipeName]
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
                    var rate = totals.totals[recipeName].mul(ing.amount)
                    var ratio = rate.div(totalRate)
                    var subRate = totals.totals[subRecipe.name].mul(subRecipe.gives(ing.item, spec)).mul(ratio).mul(displayRate)
                    var label = sprintf(
                        "%s \u00d7 %.3f/%s",
                        getImage(ing.item.name).outerHTML,
                        subRate.toFloat(),
                        rateName
                    )
                    g.setEdge(subRecipe.name, recipeName, {
                        "label": label,
                        "labelType": "html",
                        "labelpos": "c"
                    })
                }
            }
            if (ing.item.name in totals.unfinished) {
                var rate = totals.totals[recipeName].mul(ing.amount).mul(displayRate)
                var label = sprintf(
                    "%s \u00d7 %.3f/%s",
                    getImage(ing.item.name).outerHTML,
                    rate.toFloat(),
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

function renderGraph(totals) {
    var g = makeGraph(totals)
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
