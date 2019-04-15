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

const colorList = [
    "#1f77b4", // blue
    "#8c564b", // brown
    "#2ca02c", // green
    "#d62728", // red
    "#9467bd", // purple
    "#e377c2", // pink
    "#17becf", // cyan
    "#7f7f7f", // gray
    "#bcbd22", // yellow
    "#ff7f0e", // orange
]

function OutputRecipe() {
    this.ingredients = []
    for (var i = 0; i < build_targets.length; i++) {
        var target = build_targets[i]
        var item = solver.items[target.itemName]
        var ing = new Ingredient(target.getRate(), item)
        this.ingredients.push(ing)
    }
    this.products = []
}

function SurplusRecipe(totals) {
    this.ingredients = []
    for (var itemName in totals.waste) {
        var rate = totals.waste[itemName]
        var item = solver.items[itemName]
        var ing = new Ingredient(rate, item)
        this.ingredients.push(ing)
    }
    this.products = []
}

var image_id = zero

function makeGraph(totals, ignore) {
    var outputRecipe = new OutputRecipe()
    var nodes = [new GraphNode(
        "output",
        outputRecipe,
        null,
        zero,
        null,
    )]
    var nodeMap = new Map()
    nodeMap.set("output", nodes[0])
    if (Object.keys(totals.waste).length > 0) {
        var surplusRecipe = new SurplusRecipe(totals)
        nodes.push(new GraphNode(
            "surplus",
            surplusRecipe,
            null,
            zero,
            null,
        ))
        nodeMap.set("surplus", nodes[1])
    }
    for (var recipeName in totals.totals) {
        var rate = totals.totals[recipeName]
        var recipe = solver.recipes[recipeName]
        var factory = spec.getFactory(recipe)
        var factoryCount = spec.getCount(recipe, rate)
        var node = new GraphNode(
            recipeName,
            recipe,
            factory,
            factoryCount,
            rate,
        )
        nodes.push(node)
        nodeMap.set(recipeName, node)
    }
    var links = []
    for (let node of nodes) {
        var recipe = node.recipe
        if (ignore[recipe.name]) {
            continue
        }
        var ingredients = []
        if (recipe.fuelIngredient) {
            ingredients = recipe.fuelIngredient(spec)
        }
        var fuelIngCount = ingredients.length
        ingredients = ingredients.concat(recipe.ingredients)
        for (let [i, ing] of ingredients.entries()) {
            var fuel = i < fuelIngCount
            var totalRate = zero
            for (let subRecipe of ing.item.recipes) {
                if (subRecipe.name in totals.totals) {
                    totalRate = totalRate.add(totals.totals[subRecipe.name].mul(subRecipe.gives(ing.item, spec)))
                }
            }
            for (let subRecipe of ing.item.recipes) {
                if (subRecipe.name in totals.totals) {
                    var rate
                    if (node.name === "output" || node.name === "surplus") {
                        rate = ing.amount
                    } else {
                        rate = totals.totals[recipe.name].mul(ing.amount)
                    }
                    var ratio = rate.div(totalRate)
                    var subRate = totals.totals[subRecipe.name].mul(subRecipe.gives(ing.item, spec)).mul(ratio)
                    let value = subRate.toFloat()
                    if (ing.item.phase === "fluid") {
                        value /= 10
                    }
                    let beltCount = null
                    if (ing.item.phase === "solid") {
                        beltCount = subRate.div(preferredBeltSpeed)
                    }
                    let extra = subRecipe.products.length > 1
                    links.push(new GraphEdge(
                        nodeMap.get(subRecipe.name),
                        node,
                        value,
                        ing.item,
                        subRate,
                        fuel,
                        beltCount,
                        extra,
                    ))
                }
            }
        }
    }
    return {nodes, links}
}

class GraphEdge {
    constructor(source, target, value, item, rate, fuel, beltCount, extra) {
        this.source = source
        this.target = target
        this.value = value
        this.item = item
        this.rate = rate
        this.fuel = fuel
        this.beltCount = beltCount
        this.extra = extra
        this.elements = []
        this.nodeHighlighters = new Set()
    }
    hasHighlighters() {
        return this.nodeHighlighters.size > 0
    }
    highlight(node) {
        if (!this.hasHighlighters()) {
            for (let element of this.elements) {
                element.classList.add("edgePathHighlight")
            }
        }
        this.nodeHighlighters.add(node)
    }
    unhighlight(node) {
        this.nodeHighlighters.delete(node)
        if (!this.hasHighlighters()) {
            for (let element of this.elements) {
                element.classList.remove("edgePathHighlight")
            }
        }
    }
}

class GraphNode {
    constructor(name, recipe, factory, count, rate) {
        this.name = name
        this.ingredients = recipe.ingredients
        this.recipe = recipe
        this.factory = factory ? factory.factory : null
        this.count = count
        this.rate = rate
        //this.edgeHighlighters = []
    }
    links() {
        return this.sourceLinks.concat(this.targetLinks)
    }
    text() {
        if (this.rate === null) {
            return this.name
        } else if (this.count.isZero()) {
            return sprintf(" \u00d7 %s/%s", displayRate(this.rate), rateName)
        } else {
            return sprintf(" \u00d7 %s", displayCount(this.count))
        }
    }
    labelWidth(text, margin) {
        text.text(this.text())
        let textWidth = text.node().getBBox().width
        let nodeWidth = textWidth + margin*2
        if (this.factory !== null) {
            nodeWidth += iconSize * 2 + colonWidth + 3
        } else if (this.rate !== null) {
            nodeWidth += iconSize + 3
        }
        return nodeWidth
    }
    highlight() {
        this.element.classList.add("nodeHighlight")
        for (let edge of this.links()) {
            edge.highlight(this)
        }
    }
    unhighlight() {
        this.element.classList.remove("nodeHighlight")
        for (let edge of this.links()) {
            edge.unhighlight(this)
        }
    }
}

function renderNode(selection, margin, justification, ignore, sheetWidth, sheetHeight, recipeColors) {
    selection.each(d => {
        if (justification === "left") {
            d.labelX = d.x0
        } else {
            d.labelX = (d.x0 + d.x1)/2 - d.width/2
        }
    })
    selection.append("rect")
        .attr("x", d => d.x0)
        .attr("y", d => d.y0)
        .attr("height", d => d.y1 - d.y0)
        .attr("width", d => d.x1 - d.x0)
        .attr("fill", d => d3.color(colorList[recipeColors.get(d.recipe) % 10]).darker())
        .attr("stroke", d => colorList[recipeColors.get(d.recipe) % 10])
        .each(function(d) { d.element = this })
    selection.filter(d => d.rate === null)
        .append("text")
            .attr("x", d => (d.x0 + d.x1) / 2)
            .attr("y", d => (d.y0 + d.y1) / 2)
            .attr("dy", "0.35em")
            .attr("text-anchor", "middle")
            .text(d => d.text())
    let labeledNode = selection.filter(d => d.rate !== null)
    labeledNode.append("svg")
        .attr("viewBox", d => imageViewBox(d.recipe))
        .attr("x", d => d.labelX + margin + 0.5)
        .attr("y", d => (d.y0 + d.y1) / 2 - iconSize/2 + 0.5)
        .attr("width", iconSize)
        .attr("height", iconSize)
        .append("image")
            .classed("ignore", d => ignore[d.recipe.name])
            .attr("xlink:href", "images/sprite-sheet-" + sheet_hash + ".png")
            .attr("width", sheetWidth)
            .attr("height", sheetHeight)
    labeledNode.append("text")
        .attr("x", d => d.labelX + iconSize + (d.factory === null ? 0 : colonWidth + iconSize) + margin + 3)
        .attr("y", d => (d.y0 + d.y1) / 2)
        .attr("dy", "0.35em")
        .text(d => d.text())
    let factoryNode = selection.filter(d => d.factory !== null)
    factoryNode.append("circle")
        .classed("colon", true)
        .attr("cx", d => d.labelX + iconSize + colonWidth/2 + margin)
        .attr("cy", d => (d.y0 + d.y1) / 2 - 4)
        .attr("r", 1)
    factoryNode.append("circle")
        .classed("colon", true)
        .attr("cx", d => d.labelX + iconSize + colonWidth/2 + margin)
        .attr("cy", d => (d.y0 + d.y1) / 2 + 4)
        .attr("r", 1)
    factoryNode.append("svg")
        .attr("viewBox", d => imageViewBox(d.factory))
        .attr("x", d => d.labelX + iconSize + colonWidth + margin + 0.5)
        .attr("y", d => (d.y0 + d.y1) / 2 - iconSize/2 + 0.5)
        .attr("width", iconSize)
        .attr("height", iconSize)
        .append("image")
            .attr("xlink:href", "images/sprite-sheet-" + sheet_hash + ".png")
            .attr("width", sheetWidth)
            .attr("height", sheetHeight)
}

const iconSize = 32
const nodePadding = 32
const colonWidth = 12

var color = d3.scaleOrdinal(colorList)

function imageViewBox(obj) {
    var x1 = obj.icon_col * PX_WIDTH + 0.5
    var y1 = obj.icon_row * PX_HEIGHT + 0.5
    return `${x1} ${y1} ${PX_WIDTH-1} ${PX_HEIGHT-1}`
}

function itemNeighbors(item, fuelLinks) {
    let touching = new Set()
    let recipes = item.recipes.concat(item.uses)
    let fuelUsers = fuelLinks.get(item)
    if (fuelUsers !== undefined) {
        recipes = recipes.concat(fuelUsers)
    }
    for (let recipe of recipes) {
        let ingredients = recipe.ingredients.concat(recipe.products)
        if (recipe.fuelIngredient) {
            ingredients = ingredients.concat(recipe.fuelIngredient(spec))
        }
        for (let ing of ingredients) {
            touching.add(ing.item)
        }
    }
    return touching
}

function itemDegree(item, fuelLinks) {
    return itemNeighbors(item, fuelLinks).size
}

function getColorMaps(nodes, links) {
    let itemColors = new Map()
    let recipeColors = new Map()
    let fuelLinks = new Map()
    let items = []
    for (let link of links) {
        items.push(link.item)
        if (link.fuel) {
            let fuelUsers = fuelLinks.get(link.item)
            if (fuelUsers === undefined) {
                fuelUsers = []
                fuelLinks.set(link.item, fuelUsers)
            }
            fuelUsers.push(link.target.recipe)
        }
    }
    items.sort(function (a, b) {
        return itemDegree(b, fuelLinks) - itemDegree(a, fuelLinks)
    })
    items = new Set(items)
    while (items.size > 0) {
        let chosenItem = null
        let usedColors = null
        let max = -1
        for (let item of items) {
            let neighbors = itemNeighbors(item, fuelLinks)
            let colors = new Set()
            for (let neighbor of neighbors) {
                if (itemColors.has(neighbor)) {
                    colors.add(itemColors.get(neighbor))
                }
            }
            if (colors.size > max) {
                max = colors.size
                usedColors = colors
                chosenItem = item
            }
        }
        items.delete(chosenItem)
        let color = 0
        while (usedColors.has(color)) {
            color++
        }
        itemColors.set(chosenItem, color)
    }
    // This is intended to be taken modulo the number of colors when it is
    // actually used.
    let recipeColor = 0
    for (let node of nodes) {
        let recipe = node.recipe
        if (recipe.products.length === 1) {
            recipeColors.set(recipe, itemColors.get(recipe.products[0].item))
        } else {
            recipeColors.set(recipe, recipeColor++)
        }
    }
    return [itemColors, recipeColors]
}

function selfPath(d) {
    let x0 = d.source.x1
    let y0 = d.y0
    let x1 = d.source.x1
    let y1 = d.source.y1 + d.width/2 + 10
    let r1 = (y1 - y0) / 2
    let x2 = d.target.x0
    let y2 = d.target.y1 + d.width/2 + 10
    let x3 = d.target.x0
    let y3 = d.y1
    let r2 = (y3 - y2) / 2
    return new CirclePath(1, 0, [
        {x: x0, y: y0},
        {x: x1, y: y1},
        {x: x2, y: y2},
        {x: x3, y: y3},
    ])
}

function backwardPath(d) {
    // start point
    let x0 = d.source.x1
    let y0 = d.y0
    // end point
    let x3 = d.target.x0
    let y3 = d.y1
    let y2a = d.source.y0 - d.width/2 - 10
    let y2b = d.source.y1 + d.width/2 + 10
    let y3a = d.target.y0 - d.width/2 - 10
    let y3b = d.target.y1 + d.width/2 + 10
    let points = [{x: x0, y: y0}]
    let starty
    let endy
    if (y2b < y3a) {
        // draw start arc down, end arc up
        starty = y2b
        endy = y3a
    } else if (y2a > y3b) {
        // draw start arc up, end arc down
        starty = y2a
        endy = y3b
    } else {
        // draw both arcs down
        starty = y2b
        endy = y3b
    }
    let curve = makeCurve(-1, 0, x0, starty, x3, endy)
    for (let {x, y} of curve.points) {
        points.push({x, y})
    }
    points.push({x: x3, y: y3})
    return new CirclePath(1, 0, points)
}

function linkPath(d) {
    if (d.direction === "self") {
        return selfPath(d)
    } else if (d.direction === "backward") {
        return backwardPath(d)
    }
    let x0 = d.source.x1
    let y0 = d.y0
    let x1 = d.target.x0
    let y1 = d.y1
    return makeCurve(1, 0, x0, y0, x1, y1, d.width)
}

function linkTitle(d) {
    let itemName = ""
    if (d.source.name !== d.item.name) {
        itemName = `${formatName(d.item.name)} \u00d7 `
    }
    let fuel = ""
    if (d.fuel) {
        fuel = " (fuel)"
    }
    return `${formatName(d.source.name)} \u2192 ${formatName(d.target.name)}${fuel}\n${itemName}${displayRate(d.rate)}/${rateName}`
}

function renderGraph(totals, ignore) {
    let direction = visDirection
    let [sheetWidth, sheetHeight] = spriteSheetSize
    let data = makeGraph(totals, ignore)
    if (visualizer === "box") {
        renderBoxGraph(data, direction, ignore, sheetWidth, sheetHeight)
        return
    }

    let maxNodeWidth = 0
    let testSVG = d3.select("body").append("svg")
        .classed("sankey", true)
    let text = testSVG.append("text")
    for (let node of data.nodes) {
        let nodeWidth = node.labelWidth(text, 2)
        if (nodeWidth > maxNodeWidth) {
            maxNodeWidth = nodeWidth
        }
        node.width = nodeWidth
    }
    text.remove()
    testSVG.remove()

    let nw, np
    if (direction === "down") {
        nw = 36
        np = maxNodeWidth
    } else if (direction === "right") {
        nw = maxNodeWidth
        np = nodePadding
    }
    let sankey = d3sankey.sankey()
        .nodeWidth(nw)
        .nodePadding(np)
        .nodeAlign(d3sankey.sankeyRight)
        .maxNodeHeight(maxNodeHeight)
        .linkLength(linkLength)
    let {nodes, links} = sankey(data)
    let [itemColors, recipeColors] = getColorMaps(nodes, links)

    for (let link of links) {
        link.curve = linkPath(link)
        if (direction === "down") {
            link.curve = link.curve.transpose()
        }
        let belts = []
        if (link.beltCount !== null) {
            let dy = link.width / link.beltCount.toFloat()
            // Only render belts if there are at least three pixels per belt.
            if (dy > 3) {
                for (let i = one; i.less(link.beltCount); i = i.add(one)) {
                    let offset = i.toFloat() * dy - link.width/2
                    let beltCurve = link.curve.offset(offset)
                    belts.push({item: link.item, curve: beltCurve})
                }
            }
        }
        link.belts = belts
    }

    let width = 0
    let height = 0
    for (let node of nodes) {
        if (direction === "down") {
            [node.x0, node.y0] = [node.y0, node.x0];
            [node.x1, node.y1] = [node.y1, node.x1];
        }
        if (node.x1 > width) {
            width = node.x1
        }
        if (node.y1 > height) {
            height = node.y1
        }
    }

    let margin = 25
    if (direction === "down") {
        margin += maxNodeWidth / 2
    }

    let svg = d3.select("svg#graph")
        .classed("sankey", true)
        .attr("viewBox", `${-margin},-25,${width+margin*2},${height+50}`)
        .style("width", width+margin*2)
        .style("height", height+50)
    svg.selectAll("g").remove()

    let rects = svg.append("g")
        .classed("nodes", true)
        .selectAll("g")
        .data(nodes)
        .join("g")
            .classed("node", true)

    let nodeJust = "left"
    if (direction === "down") {
        nodeJust = "center"
    }
    renderNode(rects, 2, nodeJust, ignore, sheetWidth, sheetHeight, recipeColors)

    let link = svg.append("g")
        .classed("links", true)
        .selectAll("g")
        .data(links)
        .join("g")
            .classed("link", true)
            .each(function(d) { d.elements.push(this) })
    link.append("path")
        .classed("highlighter", d => d.width < 3)
        .attr("fill", "none")
        .attr("stroke-opacity", 0.3)
        .attr("d", d => d.curve.path())
        .attr("stroke", d => colorList[itemColors.get(d.item) % 10])
        .attr("stroke-width", d => Math.max(1, d.width))
    link.filter(d => d.width >= 3)
        .append("g")
            .selectAll("path")
            .data(d => [
                d.curve.offset(-d.width/2),
                d.curve.offset(d.width/2),
            ])
            .join("path")
                .classed("highlighter", true)
                .attr("fill", "none")
                .attr("d", d => d.path())
                .attr("stroke", "none")
                .attr("stroke-width", 1)
    link.append("g")
        .classed("belts", true)
        .selectAll("path")
        .data(d => d.belts)
        .join("path")
            .classed("belt", true)
            .attr("fill", "none")
            .attr("stroke-opacity", 0.3)
            .attr("d", d => d.curve.path())
            .attr("stroke", d => colorList[itemColors.get(d.item) % 10])
            .attr("stroke-width", 1)
    link.append("title")
        .text(linkTitle)
    let extraLinkLabel = link.filter(d => d.extra)
    let linkIcon = extraLinkLabel.append("svg")
        .attr("viewBox", d => imageViewBox(d.item))
        .attr("x", d => d.source.x1 + 2.25)
        .attr("y", d => d.y0 - iconSize/4 + 0.25)
        .attr("width", iconSize/2)
        .attr("height", iconSize/2)
    linkIcon.append("image")
            .attr("xlink:href", "images/sprite-sheet-" + sheet_hash + ".png")
            .attr("width", sheetWidth)
            .attr("height", sheetHeight)
    if (direction === "down") {
        linkIcon
            .attr("x", d => d.y0 - iconSize/4 + 0.25)
            .attr("y", d => d.source.y1 + 2.25)
    }
    let linkLabel = link.append("text")
        .attr("x", d => d.source.x1 + 2 + (d.extra ? 16 : 0))
        .attr("y", d => d.y0)
        .attr("dy", "0.35em")
        .attr("text-anchor", "start")
        .text(d => (d.extra ? "\u00d7 " : "") + `${displayRate(d.rate)}/${rateName}`)
    if (direction === "down") {
        linkLabel
            .attr("x", null)
            .attr("y", null)
            .attr("transform", d => {
                let x = d.y0
                let y = d.source.y1 + 2 + (d.extra ? 16 : 0)
                return `translate(${x},${y}) rotate(90)`
            })
    }

    let rectElements = svg.selectAll("g.node rect").nodes()
    let overlayData = []
    let graphTab = d3.select("#graph_tab")
    let origDisplay = d3.style(graphTab.node(), "display")
    graphTab.style("display", "block")
    for (let [i, node] of nodes.entries()) {
        let rect = rectElements[i].getBBox()
        let recipe = node.recipe
        overlayData.push({rect, node, recipe})
    }
    graphTab.style("display", origDisplay)
    svg.append("g")
        .classed("overlay", true)
        .selectAll("rect")
        .data(overlayData)
        .join("rect")
            .attr("stroke", "none")
            .attr("fill", "transparent")
            .attr("x", d => Math.min(d.rect.x, d.rect.x + d.rect.width/2 - d.node.width/2))
            .attr("y", d => Math.min(d.rect.y, d.rect.y + d.rect.height/2 - 16))
            .attr("width", d => Math.max(d.rect.width, d.node.width))
            .attr("height", d => Math.max(d.rect.height, 32))
            .on("mouseover", d => GraphMouseOverHandler(d.node))
            .on("mouseout", d => GraphMouseLeaveHandler(d.node))
            .on("click", d => GraphClickHandler(d.node))
            .append("title")
                .text(d => formatName(d.node.name))
}
