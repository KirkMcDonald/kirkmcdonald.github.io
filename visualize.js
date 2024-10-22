/*Copyright 2019-2021 Kirk McDonald

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.*/
import { renderBoxGraph } from "./boxline2.js"
import { visualizerType, visualizerRender, visualizerDirection, installSVGEvents } from "./events.js"
import { spec } from "./factory.js"
import { iconSize, colonWidth } from "./graph.js"
import { zero, one } from "./rational.js"
import { renderSankey } from "./sankey.js"

let clickedNode = null

export function graphClickHandler(event, node) {
    if (node === clickedNode) {
        node.unhighlight()
        clickedNode = null
    } else if (clickedNode) {
        clickedNode.unhighlight()
        clickedNode = node
    } else {
        clickedNode = node
    }
}

export function graphMouseOverHandler(event, node) {
    node.highlight()
}

export function graphMouseLeaveHandler(event, node) {
    if (node !== clickedNode) {
        node.unhighlight()
    }
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

        source.linkObjects.push(this)
        target.linkObjects.push(this)
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
    constructor(name, recipe, building, count, rate) {
        this.name = name
        this.ingredients = recipe.getIngredients()
        this.recipe = recipe
        this.building = building || null
        this.count = count
        this.rate = rate
        this.linkObjects = []
    }
    links() {
        return this.linkObjects
    }
    text() {
        if (this.rate === null) {
            return this.name
        } else if (this.count.isZero()) {
            return `\u00a0\u00d7 ${spec.format.rate(this.rate)}/${spec.format.rateName}`
        } else {
            return `\u00a0\u00d7 ${spec.format.count(this.count)}`
        }
    }
    // There are three types of nodes, each of which calculate their width
    // differently:
    //
    // 1) Plain text nodes, used for the "output" and "surplus" nodes. These
    //    are simply the width of the rendered text string, plus a margin on
    //    either side.
    //      [margin] [text] [margin]
    // 2) Rate nodes, which represent the production of an item in lieu of a
    //    building. These consist of:
    //      [margin] [item icon] [text label] [margin]
    // 3) Recipe nodes, which contain a recipe icon, a representation of a
    //    colon (as two circles), a building icon, and a text label:
    //      [margin] [recipe icon] [colon] [building icon] [text] [margin]
    //
    // The constant `iconSize` is the width and height, in SVG coordinate
    // units, of all icons.
    //
    // The constant `colonWidth` is the distance, in SVG coordinate units,
    // between the recipe and building icons; the colon symbol is then centered
    // in this gap.
    //
    // `nodeMargin` is 2 for the Sankey visualization: 1 pixel for the rect
    // border, and one pixel for separation from the border. It is 10 for the
    // boxline visualziation, which looks nicer.
    //
    // These calculations hold for both the Sankey and boxline visualizations,
    // with the slight caveat that this is the exact width of each node in the
    // boxline mode, while nodes are of a uniform width in the Sankey diagram,
    // chosen from the maximum node width calculated here.
    labelWidth(text, nodeMargin) {
        text.text(this.text())
        let textWidth = text.node().getBBox().width
        let nodeWidth = textWidth + nodeMargin*2
        if (this.building !== null) {
            nodeWidth += iconSize * 2 + colonWidth// + 3
        } else if (this.rate !== null) {
            nodeWidth += iconSize// + 3
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

function makeGraph(totals, ignore) {
    let outputs = []
    let rates = new Map()

    let nodes = []
    let nodeMap = new Map()

    for (let [recipe, rate] of totals.rates) {
        let node = null
        if (recipe.isReal()) {
            let building = spec.getBuilding(recipe)
            let count = spec.getCount(recipe, rate)
            node = new GraphNode(
                recipe.name,
                recipe,
                building,
                count,
                rate,
            )
        } else {
            node = new GraphNode(
                recipe.name,
                recipe,
                null,
                zero,
                null,
            )
        }
        nodes.push(node)
        nodeMap.set(recipe, node)
    }

    let links = []
    for (let {item, from, to, rate, fuel} of totals.proportionate) {
        let value = rate.toFloat()
        if (item.phase === "fluid") {
            // Fluids operate on a different scale.
            value /= 10
        }
        let beltCount = null
        if (item.phase === "solid") {
            beltCount = rate.div(spec.belt.rate)
        }
        let extra = from.products.length > 1
        links.push(new GraphEdge(
            nodeMap.get(from),
            nodeMap.get(to),
            value,
            item,
            rate,
            fuel,
            beltCount,
            extra,
        ))
    }
    return {"nodes": nodes, "links": links}
}

export function renderTotals(totals, ignore) {
    let data = makeGraph(totals, ignore)

    let callback = function() {
        let svg = d3.select("svg#graph")
        let tab = d3.select("#graph_tab")
        if (visualizerRender === "zoom") {
            tab.style("min-width", 0)
            svg.attr("width", null)
            svg.attr("height", null)
            svg.style("border", "1px var(--foreground) solid")
            installSVGEvents(svg)
        } else {
            tab.style("min-width", "max-content")
            let style = tab.style("display")
            tab.style("display", "block")
            // Hide images so the sprite sheet doesn't throw off the bounding
            // box.
            svg.selectAll("image").style("display", "none")
            let {x, y, width, height} = svg.node().getBBox()
            svg.selectAll("image").style("display", null)
            tab.style("display", style)
            svg.attr("viewBox", `${x} ${y} ${width} ${height}`)
                .attr("width", width)
                .attr("height", height)
                .style("border", null)
            svg.on("wheel", null)
            svg.on("mousedown", null)
            svg.on("mousemove", null)
            svg.on("mouseup", null)
        }
    }

    if (visualizerType === "sankey") {
        renderSankey(data, visualizerDirection, ignore)
        callback()
    } else {
        renderBoxGraph(data, visualizerDirection, ignore, callback)
    }
}
