/*Copyright 2015-2019 Kirk McDonald

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.*/
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

function SurplusRecipe(totals) {
    this.ingredients = []
    for (var itemName in totals.waste) {
        var rate = totals.waste[itemName]
        var item = solver.items[itemName]
        var ing = new Ingredient(rate, item)
        this.ingredients.push(ing)
    }
}

var image_id = zero

function makeGraph(totals, ignore) {
    var edgeIndexMap = {}
    var edge = 0
    var nodes = []
    var minRate = null
    var maxRate = zero
    var edgeRates = []
    var edgeStyles = []
    var images = {}
    var addEdge = function(node1, node2, rate, label, style, name) {
        if (!minRate || rate.less(minRate)) {
            minRate = rate
        }
        if (maxRate.less(rate)) {
            maxRate = rate
        }
        edgeRates.push(rate)
        edgeStyles.push(style)
        g.setEdge(node1, node2, label, name)
        var a = edgeIndexMap[node1]
        if (!a) {
            a = []
            edgeIndexMap[node1] = a
        }
        a.push(edge)
        a = edgeIndexMap[node2]
        if (!a) {
            a = []
            edgeIndexMap[node2] = a
        }
        a.push(edge)
        edge++
    }
    var addNode = function(name, label) {
        g.setNode(name, label)
        nodes.push(name)
    }
    var image = function(obj) {
        var id = "im" + image_id.toDecimal()
        image_id = image_id.add(one)
        var im = getImage(obj, true)
        im.id = id
        images[id] = obj
        return im
    }
    var g = new dagreD3.graphlib.Graph({multigraph: true})
    g.setGraph({})
    g.setDefaultEdgeLabel(function() { return  {} })
    for (var recipeName in totals.totals) {
        var rate = totals.totals[recipeName]
        var recipe = solver.recipes[recipeName]
        var factoryCount = spec.getCount(recipe, rate)
        var im = image(recipe)
        if (ignore[recipeName]) {
            im.classList.add("ignore")
        }
        var label = im.outerHTML
        if (factoryCount.isZero()) {
            label += sprintf(" \u00d7 %s/%s", displayRate(rate), rateName)
        } else {
            var factory = spec.getFactory(recipe)
            var im = image(factory.factory)
            if (ignore[recipeName]) {
                im.classList.add("ignore")
            }
            label += sprintf(
                " : %s \u00d7 %s",
                im.outerHTML,
                displayCount(factoryCount)
            )
        }
        addNode(recipeName, {"label": label, "labelType": "html"})
    }
    for (var itemName in totals.unfinished) {
        addNode(itemName, {"label": "unknown " + itemName + " recipe", "labelType": "html"})
    }
    var fakeNodes = ["output"]
    if (Object.keys(totals.waste).length > 0) {
        fakeNodes.push("surplus")
    }
    for (var i = 0; i < fakeNodes.length; i++) {
        addNode(fakeNodes[i], {"label": fakeNodes[i], "labelType": "html"})
    }
    var nodes = Object.keys(totals.totals).concat(fakeNodes)
    for (var recipeIndex = 0; recipeIndex < nodes.length; recipeIndex++) {
        var recipeName = nodes[recipeIndex]
        if (ignore[recipeName]) {
            continue
        }
        var recipe
        var ingredients = []
        if (recipeName == "output") {
            recipe = new OutputRecipe()
        } else if (recipeName == "surplus") {
            recipe = new SurplusRecipe(totals)
        } else {
            recipe = solver.recipes[recipeName]
            ingredients = recipe.fuelIngredient(spec)
        }
        var fuelIngCount = ingredients.length
        ingredients = ingredients.concat(recipe.ingredients)
        for (var i = 0; i < ingredients.length; i++) {
            var ing = ingredients[i]
            var style = null
            if (i < fuelIngCount) {
                style = "edgePathFuel"
            }
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
                    if (recipeName == "output" || recipeName == "surplus") {
                        rate = ing.amount
                    } else {
                        rate = totals.totals[recipeName].mul(ing.amount)
                    }
                    var ratio = rate.div(totalRate)
                    var subRate = totals.totals[subRecipe.name].mul(subRecipe.gives(ing.item, spec)).mul(ratio)
                    var label = sprintf(
                        "%s \u00d7 %s/%s",
                        image(ing.item).outerHTML,
                        displayRate(subRate),
                        rateName
                    )
                    addEdge(
                        subRecipe.name,
                        recipeName,
                        subRate,
                        {
                            "label": label,
                            "labelType": "html",
                            "labelpos": "c"
                        },
                        style,
                        sprintf(
                            "%s-%s-%s",
                            subRecipe.name,
                            recipeName,
                            ing.item.name
                        )
                    )
                }
            }
            if (ing.item.name in totals.unfinished) {
                var rate = totals.totals[recipeName].mul(ing.amount)
                var label = sprintf(
                    "%s \u00d7 %s/%s",
                    image(ing.item).outerHTML,
                    displayRate(rate),
                    rateName
                )
                addEdge(ing.item.name, recipeName, rate, {
                    "label": label,
                    "labelType": "html",
                    "labelpos": "c"
                })
            }
        }
    }
    return {g: g, nodes: nodes, edges: edgeIndexMap, min: minRate, max: maxRate, rates: edgeRates, styles: edgeStyles, images: images}
}

function GraphEdge(edge, label) {
    this.edge = edge
    this.label = label
    this.nodes = {}
}
GraphEdge.prototype = {
    constructor: GraphEdge,
    hasNodes: function() {
        return Object.keys(this.nodes).length > 0
    },
    highlight: function(node) {
        if (!this.hasNodes()) {
            this.edge.classList.add("edgePathHighlight")
            this.label.classList.add("edgeLabelHighlight")
        }
        this.nodes[node.name] = true
    },
    unhighlight: function(node) {
        delete this.nodes[node.name]
        if (!this.hasNodes()) {
            this.edge.classList.remove("edgePathHighlight")
            this.label.classList.remove("edgeLabelHighlight")
        }
    },
}

function GraphNode(name, node, edges) {
    this.name = name
    this.node = node
    this.edges = edges
}
GraphNode.prototype = {
    constructor: GraphNode,
    highlight: function() {
        this.node.classList.add("nodeHighlight")
        for (var i = 0; i < this.edges.length; i++) {
            this.edges[i].highlight(this)
        }
    },
    unhighlight: function() {
        this.node.classList.remove("nodeHighlight")
        for (var i = 0; i < this.edges.length; i++) {
            this.edges[i].unhighlight(this)
        }
    },
}

function renderGraph(totals, ignore) {
    var graph = makeGraph(totals, ignore)
    var g = graph.g
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

    var minWidth = one
    var maxWidth = RationalFromFloat(8)
    var widthRange = maxWidth.sub(minWidth)
    var rateRange = graph.max.sub(graph.min)
    var widthFactor
    if (rateRange.isZero()) {
        widthFactor = one
    } else {
        widthFactor = widthRange.div(rateRange)
    }

    var nodes = document.querySelector("svg#graph g.nodes")
    var edgePaths = document.querySelector("svg#graph g.edgePaths")
    var labels = document.querySelector("svg#graph g.edgeLabels")

    var edges = []
    for (var i = 0; i < edgePaths.childNodes.length; i++) {
        var edge = edgePaths.childNodes[i]
        var style = graph.styles[i]
        if (style) {
            edge.classList.add(style)
        }
        var path = edge.querySelector("path")
        var width = graph.rates[i].sub(graph.min).mul(widthFactor).add(minWidth).toDecimal(1) + "px"
        path.style.setProperty("stroke-width", width)
        var marker = edge.querySelector("marker")
        marker.setAttribute("markerUnits", "userSpaceOnUse")
        marker.setAttribute("markerWidth", "16")
        marker.setAttribute("markerHeight", "12")
        var label = labels.childNodes[i]
        var edgeNode = new GraphEdge(edge, label)
        edges.push(edgeNode)
    }

    for (var i = 0; i < graph.nodes.length; i++) {
        var nodeName = graph.nodes[i]
        var node = nodes.childNodes[i]
        var edgeIndexes = graph.edges[nodeName]
        var edgeNodes = []
        for (var j = 0; j < edgeIndexes.length; j++) {
            var index = edgeIndexes[j]
            var edge = edges[index]
            edgeNodes.push(edge)
        }
        var graphNode = new GraphNode(nodeName, node, edgeNodes)
        node.addEventListener("mouseover", new GraphMouseOverHandler(graphNode))
        node.addEventListener("mouseout", new GraphMouseLeaveHandler(graphNode))
        node.addEventListener("click", new GraphClickHandler(graphNode))
    }
    if (tooltipsEnabled) {
        for (var id in graph.images) {
            var obj = graph.images[id]
            var im = document.getElementById(id)
            im.title = ""
            addTooltip(im, obj)
        }
    }
}
