"use strict"

function makeGraph(totals) {
    var g = new dagreD3.graphlib.Graph()
    g.setGraph({})
    g.setDefaultEdgeLabel(function() { return  {} })
    for (var recipeName in totals.totals) {
        var rate = totals.totals[recipeName].mul(displayRate)
        var label = sprintf("%.3f %s/%s", rate.toFloat(), recipeName, rateName)
        g.setNode(recipeName, {"label": label})
    }
    for (var recipeName in totals.totals) {
        var recipe = solver.recipes[recipeName]
        for (var i = 0; i < recipe.ingredients.length; i++) {
            var ing = recipe.ingredients[i]
            for (var j = 0; j < ing.item.recipes.length; j++) {
                var subRecipe = ing.item.recipes[j]
                if (subRecipe.name in totals.totals) {
                    var rate = totals.totals[recipeName].mul(ing.amount).mul(displayRate)
                    var label = sprintf("%.3f %s/%s", rate.toFloat(), ing.item.name, rateName)
                    g.setEdge(subRecipe.name, recipeName, {"label": label})
                }
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
