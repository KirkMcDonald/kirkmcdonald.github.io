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

import { spec } from "./factory.js"
import { colorList, iconSize, nodeMargin, getColorMaps, renderNode, imageViewBox } from "./graph.js"
import { sheetHash, sheetWidth, sheetHeight } from "./icon.js"

function edgePath(edge) {
    let start = edge.points[0]
    let parts = [`M ${start.x},${start.y}`]
    for (let point of edge.points.slice(1)) {
        parts.push(`L ${point.x},${point.y}`)
    }
    return parts.join(" ")
}

function edgeName(link) {
        return `link-${link.index}`
}

export function renderBoxGraph({nodes, links}, ignore, callback) {
    let [itemColors, recipeColors] = getColorMaps(nodes, links)
    let dpi = 72
    let dot = [
        "digraph {\n",
        "    bgcolor=transparent;\n",
        `    dpi=${dpi};\n`,
        "    ranksep=1;\n",
    ]
    let testSVG = d3.select("body").append("svg").classed("test", true)
    let text = testSVG.append("text")
    let nodeMap = new Map()
    for (let node of nodes) {
        nodeMap.set(node.name, node)
        let width = node.labelWidth(text)
        let height = iconSize + nodeMargin*2
        let fill = d3.color(colorList[recipeColors.get(node.recipe) % colorList.length]).darker().hex()
        let stroke = colorList[recipeColors.get(node.recipe) % colorList.length]
        dot.push(`    "${node.name}" [label="" shape=rect fixedsize=true width="${width/dpi}" height="${height/dpi}"];\n`)
    }

    let linkMap = new Map()
    for (let [i, link] of links.entries()) {
        let key = `${link.source.name}->${link.target.name}`
        linkMap.set(key, link)
        link.index = i
        let s = ` \u00d7 ${spec.format.rate(link.rate)}/${spec.format.rateName}`
        text.text(s)
        let textWidth = text.node().getBBox().width
        let width = iconSize + 10 + textWidth
        let height = iconSize + 10
        let fill = d3.color(colorList[itemColors.get(link.item) % colorList.length]).darker().hex()
        let stroke = colorList[itemColors.get(link.item) % colorList.length]
        let label = {
            width: width,
            height: height,
            text: s,
        }
        link.label = label
        dot.push(`    "${link.source.name}" -> "${link.target.name}" [label="MNII${s}" color="${stroke}" fillcolor="${fill}" penwidth=3];\n`)
    }
    dot.push("};\n")
    text.remove()
    testSVG.remove()
    let dotText = dot.join("")
    let div = d3.select("#graph_container")
    div.selectAll("*").remove()
    div.graphviz(/*{useWorker: false}*/)
        // Disable default zoom stuff; we have our own.
        .zoom(false)
        .renderDot(dotText, () => {
            let svg = div.select("svg")
                .attr("id", "graph")
                .classed("sankey", false)
            let tab = d3.select("#graph_tab")
            let style = tab.style("display")
            tab.style("display", "block")
            let rects = svg.selectAll(".node")
                .each(function() {
                    let selector = d3.select(this)
                    let d = nodeMap.get(selector.select("title").text())
                    selector.datum(d)
                    let box = this.getBBox()
                    d.x0 = box.x
                    d.y0 = box.y
                    d.x1 = box.x + box.width
                    d.y1 = box.y + box.height
                })
            rects.selectAll("polygon").remove()
            renderNode(rects, recipeColors, ignore)

            let edges = svg.selectAll(".edge")
                .each(function() {
                    let selector = d3.select(this)
                    let d = linkMap.get(selector.select("title").text())
                    d.elements.push(this)
                    selector.datum(d)
                    let text = selector.select("text")
                    let box = text.node().getBBox()
                    d.label.x = box.x + box.width/2
                    d.label.y = box.y + box.height/2
                    text.remove()
                })
            tab.style("display", style)
            edges.selectAll("path, polygon")
                .classed("highlighter", true)
            let edgeLabel = svg.select("g").append("g")
                .selectAll("g")
                .data(links)
                .join("g")
                    .classed("edge-label", true)
                    .each(function(d) {
                        d.elements.push(this)
                    })
            edgeLabel.append("rect")
                .classed("highlighter", true)
                .attr("x", d => {
                    let edge = d.label
                    return edge.x - edge.width/2
                })
                .attr("y", d => {
                    let edge = d.label
                    return edge.y - edge.height/2
                })
                .attr("width", d => d.label.width)
                .attr("height", d => d.label.height)
                .attr("rx", 6)
                .attr("ry", 6)
                .attr("fill", d => d3.color(colorList[itemColors.get(d.item) % 10]).darker())
                .attr("fill-opacity", 0)
                .attr("stroke", "none")
            edgeLabel.append("svg")
                .attr("viewBox", d => imageViewBox(d.item))
                .attr("x", d => {
                    let edge = d.label
                    return edge.x - (edge.width/2) + 5 + 0.5
                })
                .attr("y", d => {
                    let edge = d.label
                    return edge.y - iconSize/2 + 0.5
                })
                .attr("width", iconSize)
                .attr("height", iconSize)
                .append("image")
                    .attr("xlink:href", "images/sprite-sheet-" + sheetHash + ".png")
                    .attr("width", sheetWidth)
                    .attr("height", sheetHeight)
            edgeLabel.append("text")
                .attr("x", d => {
                    let edge = d.label
                    return edge.x - (edge.width/2) + 5 + iconSize
                })
                .attr("y", d => d.label.y)
                .attr("dy", "0.35em")
                .text(d => d.label.text)

            svg.select("g").append("g")
                .classed("overlay", true)
                .selectAll("rect")
                .data(nodes)
                .join("rect")
                    .attr("stroke", "none")
                    .attr("fill", "transparent")
                    .attr("x", d => d.x0)
                    .attr("y", d => d.y0)
                    .attr("width", d => d.x1 - d.x0)
                    .attr("height", d => d.y1 - d.y0)
                    .on("mouseover", (event, d) => {
                        d.highlight()
                    })
                    .on("mouseout", (event, d) => {
                        d.unhighlight()
                    })
                    .append("title")
                        .text(d => d.name)

            callback()
        })
}
