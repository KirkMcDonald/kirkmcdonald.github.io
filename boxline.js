/*Copyright 2019 Kirk McDonald

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.*/

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

function renderBoxGraph({nodes, links}, direction, ignore, sheetWidth, sheetHeight) {
    let [itemColors, recipeColors] = getColorMaps(nodes, links)
    if (direction === "down") {
        direction = "TB"
    } else {
        direction = "LR"
    }
    let g = new dagre.graphlib.Graph({multigraph: true})
    g.setGraph({rankdir: direction})
    g.setDefaultEdgeLabel(() => {})

    let testSVG = d3.select("body").append("svg")
    let text = testSVG.append("text")
    for (let node of nodes) {
        let width = node.labelWidth(text, 10)
        let height = 52
        let label = {node, width, height}
        g.setNode(node.name, label)
        node.linkObjs = []
        node.links = function() { return this.linkObjs }
    }

    for (let [i, link] of links.entries()) {
        link.index = i
        let s = ` \u00d7 ${displayRate(link.rate)}/${rateName}`
        text.text(s)
        let textWidth = text.node().getBBox().width
        let width = 32 + 10 + textWidth
        let height = 32 + 10
        let label = {
            link: link,
            labelpos: "c",
            width: width,
            height: height,
            text: s,
        }
        link.label = label
        g.setEdge(link.source.name, link.target.name, label, edgeName(link))
        link.source.linkObjs.push(link)
        link.target.linkObjs.push(link)
    }
    text.remove()
    testSVG.remove()

    dagre.layout(g)
    for (let nodeName of g.nodes()) {
        let dagreNode = g.node(nodeName)
        let node = dagreNode.node
        node.x0 = dagreNode.x - dagreNode.width/2
        node.y0 = dagreNode.y - dagreNode.height/2
        node.x1 = node.x0 + dagreNode.width
        node.y1 = node.y0 + dagreNode.height
    }
    for (let edgeName of g.edges()) {
        let dagreEdge = g.edge(edgeName)
        let link = dagreEdge.link
        link.points = dagreEdge.points
    }

    let {width, height} = g.graph()
    let svg = d3.select("svg#graph")
        .classed("sankey", false)
        .attr("viewBox", `-25,-25,${width+50},${height+50}`)
        .style("width", width+50)
        .style("height", height+50)
    svg.selectAll("g").remove()

    let edges = svg.append("g")
        .classed("edges", true)
        .selectAll("g")
        .data(links)
        .join("g")
            .classed("edge", true)
            .classed("edgePathFuel", d => d.fuel)
            .each(function(d) { d.elements.push(this) })
    edges.append("path")
        .classed("highlighter", true)
        .attr("fill", "none")
        .attr("stroke", d => colorList[itemColors.get(d.item) % 10])
        .attr("stroke-width", 3)
        .attr("d", edgePath)
        .attr("marker-end", d => `url(#arrowhead-${edgeName(d)})`)
    edges.append("defs")
        .append("marker")
            .attr("id", d => "arrowhead-" + edgeName(d))
            .attr("viewBox", "0 0 10 10")
            .attr("refX", "9")
            .attr("refY", "5")
            .attr("markerWidth", "16")
            .attr("markerHeight", "12")
            .attr("markerUnits", "userSpaceOnUse")
            .attr("orient", "auto")
        .append("path")
            .classed("highlighter", true)
            .attr("d", "M 0,0 L 10,5 L 0,10 z")
            .attr("stroke-width", 1)
            .attr("stroke", d => colorList[itemColors.get(d.item) % 10])
            .attr("fill", d => d3.color(colorList[itemColors.get(d.item) % 10]).darker())

    let edgeLabels = svg.append("g")
        .classed("edgeLabels", true)
        .selectAll("g")
        .data(links)
        .join("g")
            .classed("edgeLabel", true)
            .each(function(d) { d.elements.push(this) })
    edgeLabels.append("rect")
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
    edgeLabels.append("svg")
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
            .attr("xlink:href", "images/sprite-sheet-" + sheet_hash + ".png")
            .attr("width", sheetWidth)
            .attr("height", sheetHeight)
    edgeLabels.append("text")
        .attr("x", d => {
            let edge = d.label
            return edge.x - (edge.width/2) + 5 + iconSize
        })
        .attr("y", d => d.label.y)
        .attr("dy", "0.35em")
        .text(d => d.label.text)

    let rects = svg.append("g")
        .classed("nodes", true)
        .selectAll("g")
        .data(nodes)
        .join("g")
            .classed("node", true)
    renderNode(rects, 10, "left", ignore, sheetWidth, sheetHeight, recipeColors)

    svg.append("g")
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
            .on("mouseover", d => GraphMouseOverHandler(d))
            .on("mouseout", d => GraphMouseLeaveHandler(d))
            .on("click", d => GraphClickHandler(d))
            .append("title")
                .text(d => formatName(d.name))
}
