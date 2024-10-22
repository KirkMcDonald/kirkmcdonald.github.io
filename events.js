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
import { Rational } from "./rational.js"
import { setTitle } from "./settings.js"
import { renderTotals } from "./visualize.js"

// build target events

export function plusHandler() {
    spec.addTarget()
    spec.updateSolution()
}

// tab events

export const DEFAULT_TAB = "totals"

export let currentTab = DEFAULT_TAB

export function clickTab(tabName) {
    currentTab = tabName
    d3.selectAll(".tab")
        .style("display", "none")
    d3.selectAll(".tab_button")
        .classed("active", false)
    d3.select("#" + tabName + "_tab")
        .style("display", "block")
    d3.select("#" + tabName + "_button")
        .classed("active", true)
    spec.setHash()
}

export function clickVisualize() {
    clickTab("graph")
    renderTotals(spec.lastTotals, spec.ignore)
}

// shared events

export function toggleIgnoreHandler(event, d) {
    spec.toggleIgnore(d.item)
    spec.updateSolution()
}

// setting events

export function changeTitle(event) {
    setTitle(event.target.value)
    spec.setHash()
}

export function changeRatePrecision(event) {
    spec.format.ratePrecision = Number(event.target.value)
    spec.display()
}

export function changeCountPrecision(event) {
    spec.format.countPrecision = Number(event.target.value)
    spec.display()
}

export function changeFormat(event) {
    spec.format.displayFormat = event.target.value
    spec.display()
}

export function changeMprod(event) {
    spec.miningProd = Rational.from_string(event.target.value).div(Rational.from_float(100))
    spec.updateSolution()
}

// visualizer events

export const DEFAULT_VISUALIZER = "sankey"

export let visualizerType = DEFAULT_VISUALIZER

export function setVisualizerType(vt) {
    visualizerType = vt
}

export function changeVisType(event) {
    visualizerType = event.target.value
    visualizerDirection = getDefaultVisDirection()
    d3.select(`#${visualizerDirection}_direction`).property("checked", true)
    spec.display()
}

export const DEFAULT_RENDER = "zoom"

export let visualizerRender = DEFAULT_RENDER

export function setVisualizerRender(vr) {
    visualizerRender = vr
}

export function changeVisRender(event) {
    visualizerRender = event.target.value
    spec.display()
}

export let visualizerDirection

export function getDefaultVisDirection() {
    if (visualizerType === "sankey") {
        return "right"
    } else {
        return "down"
    }
}

export function isDefaultVisDirection() {
    return visualizerDirection === getDefaultVisDirection()
}

export function setVisualizerDirection(vd) {
    visualizerDirection = vd
}

export function changeVisDir(event) {
    visualizerDirection = event.target.value
    spec.display()
}

// Number of SVG coordinate points per zoom level.
const ZOOM_SCALE = 100
// Number of distinct zoom "steps."
const MAX_SCALE = 10
// Aspect ratio of visualizer display.
const ASPECT_RATIO = 16/9

export function installSVGEvents(svg) {
    let node = svg.node()
    // Flash the graph to be visible, in order to measure its bounding box.
    let tab = d3.select("#graph_tab")
    let style = tab.style("display")
    tab.style("display", "block")
    // These variables will contain and control the viewport.
    svg.selectAll("image").style("display", "none")
    let {x, y, width, height} = node.getBBox()
    svg.selectAll("image").style("display", null)
    tab.style("display", style)
    // The diagram's bounding box.
    let [diagramX, diagramY, diagramWidth, diagramHeight] = [x, y, width, height]
    // Calculate initial scale.
    //let scale = Math.max(Math.ceil(width/ZOOM_SCALE), Math.ceil(height/ZOOM_SCALE))
    if (width / height < ASPECT_RATIO) {
        // Too thin. Expand width.
        let newWidth = height * ASPECT_RATIO
        x -= (newWidth - width) / 2
        width = newWidth
    } else if (width / height > ASPECT_RATIO) {
        // Too wide. Expand height.
        let newHeight = width / ASPECT_RATIO
        y -= (newHeight - height) / 2
        height = newHeight
    }
    // The size and position of the viewport with diagram centered and zoomed
    // all the way out.
    let [origX, origY, origWidth, origHeight] = [x, y, width, height]
    // Place the graph at the top of the viewport by default; this will get
    // clamped.
    y = diagramY
    let scale = MAX_SCALE

    function clamp() {
        let midX = x + width/2
        let midY = y + height/2
        // The outer edges of the diagram should not proceed past halfway
        // across the viewport.
        if (diagramX > midX) {
            x = diagramX - width/2
        } else if (diagramX + diagramWidth < midX) {
            x = diagramX + diagramWidth - width/2
        }
        if (diagramY > midY) {
            y = diagramY - height/2
        } else if (diagramY + diagramHeight < midY) {
            y = diagramY + diagramHeight - height/2
        }
    }
    function setViewBox() {
        clamp()
        svg.attr("viewBox", `${x} ${y} ${width} ${height}`)
    }
    function point(event) {
        let clientPoint = new DOMPointReadOnly(event.clientX, event.clientY)
        return clientPoint.matrixTransform(node.getScreenCTM().inverse())
    }
    function zoom(event) {
        event.preventDefault()
        let origScale = scale
        if (event.deltaY < 0) {
            // zoom in
            if (scale === 1) {
                return
            }
            scale -= 1
        } else if (event.deltaY > 0) {
            // zoom out
            if (scale === MAX_SCALE+2) {
                return
            }
            scale += 1
        }
        let pt = point(event)
        let dx = pt.x - x
        let dy = pt.y - y
        x = pt.x - (dx / origScale * scale)
        y = pt.y - (dy / origScale * scale)
        width = origWidth * (scale / MAX_SCALE)
        height = origHeight * (scale / MAX_SCALE)
        setViewBox()
    }
    let clickPt = null
    function mouseDown(event) {
        clickPt = point(event)
        event.preventDefault()
    }
    function mouseMove(event) {
        if (clickPt === null) {
            return
        }
        let pt = point(event)
        let dx = pt.x - clickPt.x
        let dy = pt.y - clickPt.y
        x -= dx
        y -= dy
        setViewBox()
        event.preventDefault()
    }
    function mouseUp(event) {
        clickPt = null
        event.preventDefault()
    }

    setViewBox()
    svg.on("wheel", zoom)
    svg.on("mousedown", mouseDown)
    svg.on("mousemove", mouseMove)
    svg.on("mouseup", mouseUp)
}

// debug events
export function toggleDebug(event) {
    spec.debug = event.target.checked
    spec.display()
}
