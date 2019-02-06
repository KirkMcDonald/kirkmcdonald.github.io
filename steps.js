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

// The name "steps" dates back to the earliest versions of this calculator and
// is now probably a misnomer. It originally referred to the "steps" you had
// to take to construct any given item. This purpose has been replaced with the
// visualization, leaving only the list of total item-rates, which has since
// been expanded to include the infrastructure needed to transport those
// item-rates.

// For pipe segment of the given length, returns maximum throughput as fluid/s.
function pipeThroughput(length) {
    if (length.equal(zero)) {
        // A length of zero represents a solid line of pumps.
        return RationalFromFloat(12000)
    } else if (length.less(RationalFromFloat(198))) {
        var numerator = RationalFromFloat(50).mul(length).add(RationalFromFloat(150))
        var denominator = RationalFromFloat(3).mul(length).sub(one)
        return numerator.div(denominator).mul(RationalFromFloat(60))
    } else {
        return RationalFromFloat(60*4000).div(RationalFromFloat(39).add(length))
    }
}

// Throughput at which pipe length equation changes.
var pipeThreshold = RationalFromFloats(4000, 236)

// For fluid throughput in fluid/s, returns maximum length of pipe that can
// support it.
function pipeLength(throughput) {
    throughput = throughput.div(RationalFromFloat(60))
    if (RationalFromFloat(200).less(throughput)) {
        return null
    } else if (RationalFromFloat(100).less(throughput)) {
        return zero
    } else if (pipeThreshold.less(throughput)) {
        var numerator = throughput.add(RationalFromFloat(150))
        var denominator = RationalFromFloat(3).mul(throughput).sub(RationalFromFloat(50))
        return numerator.div(denominator)
    } else {
        return RationalFromFloat(4000).div(throughput).sub(RationalFromFloat(39))
    }
}

// Arbitrarily use a default with a minimum length of 17.
function defaultPipe(rate) {
    var pipes = rate.div(RationalFromFloat(1200)).ceil()
    var perPipeRate = rate.div(pipes)
    var length = pipeLength(perPipeRate).ceil()
    return {pipes: pipes, length: length}
}

function PipeConfig(rate) {
    this.rate = rate
    var def = defaultPipe(rate)
    this.minLanes = rate.div(RationalFromFloat(12000)).ceil()
    this.element = document.createElement("td")
    var pipeItem = solver.items["pipe"]
    this.element.appendChild(getImage(pipeItem))
    this.element.appendChild(new Text(" \u00d7 "))
    this.laneInput = document.createElement("input")
    this.laneInput.addEventListener("change", new PipeCountHandler(this))
    this.laneInput.classList.add("pipe")
    this.laneInput.type = "number"
    this.laneInput.value = def.pipes.toDecimal(0)
    //this.laneInput.size = 4
    this.laneInput.min = this.minLanes.toDecimal(0)
    this.laneInput.title = ""
    this.element.appendChild(this.laneInput)
    this.element.appendChild(new Text(" @ "))
    this.lengthInput = document.createElement("input")
    this.lengthInput.addEventListener("change", new PipeLengthHandler(this))
    this.lengthInput.classList.add("pipeLength")
    this.lengthInput.type = "number"
    this.lengthInput.value = def.length.toDecimal(0)
    //this.lengthInput.size = 5
    this.lengthInput.title = ""
    this.element.appendChild(this.lengthInput)
    this.element.appendChild(new Text(" max"))
}
PipeConfig.prototype = {
    constructor: PipeConfig,
    setPipes: function(pipeString) {
        var pipes = RationalFromString(pipeString)
        if (pipes.less(this.minLanes)) {
            pipes = this.minLanes
            this.laneInput.value = pipes.toDecimal(0)
        }
        var perPipeRate = this.rate.div(pipes)
        var length = pipeLength(perPipeRate)
        this.lengthInput.value = length.toDecimal(0)
    },
    setLength: function(lengthString) {
        var length = RationalFromString(lengthString)
        var perPipeRate = pipeThroughput(length)
        var pipes = this.rate.div(perPipeRate).ceil()
        this.laneInput.value = pipes.toDecimal(0)
    }
}

function displaySteps(items, order, totals) {
    var stepTab = document.getElementById("steps_tab")

    var oldSteps = document.getElementById("steps")
    var node = document.createElement("table")
    node.id = "steps"
    stepTab.replaceChild(node, oldSteps)

    var headers = [
        new Header("items/" + rateName, 2),
        new Header("belts and pipes", BELTS.length * 2)
    ]
    var header = document.createElement("tr")
    for (var i = 0; i < headers.length; i++) {
        var th = document.createElement("th")
        th.textContent = headers[i].name
        th.colSpan = headers[i].colSpan
        if (i > 0) {
            th.classList.add("pad")
        }
        header.appendChild(th)
    }
    node.appendChild(header)
    for (var i = 0; i < order.length; i++) {
        var itemName = order[i]
        var item = solver.items[itemName]
        var rate = items[itemName]
        if (itemName in totals.waste) {
            rate = rate.sub(totals.waste[itemName])
            if (rate.equal(zero)) {
                continue
            }
        }
        var row = document.createElement("tr")
        node.appendChild(row)
        var iconCell = document.createElement("td")
        iconCell.appendChild(getImage(item))
        row.appendChild(iconCell)
        var rateCell = document.createElement("td")
        rateCell.classList.add("right-align")
        var tt = document.createElement("tt")
        tt.textContent = alignRate(rate)
        rateCell.append(tt)
        row.appendChild(rateCell)

        if (item.phase == "solid") {
            for (var j = 0; j < BELTS.length; j++) {
                var belt = BELTS[j]
                var beltItem = solver.items[belt.name]
                var belts = rate.div(belt.speed)
                var beltCell = document.createElement("td")
                beltCell.classList.add("pad")
                beltCell.appendChild(getImage(beltItem))
                beltCell.appendChild(new Text(" \u00d7"))
                row.appendChild(beltCell)
                var beltRateCell = document.createElement("td")
                beltRateCell.classList.add("right-align")
                tt = document.createElement("tt")
                tt.textContent = alignCount(belts)
                beltRateCell.append(tt)
                row.appendChild(beltRateCell)
            }
        } else if (item.phase == "fluid") {
            var pipe = new PipeConfig(rate)
            var pipeCell = pipe.element
            pipeCell.colSpan = BELTS.length * 2
            row.appendChild(pipeCell)
        }
    }

    var oldWaste = document.getElementById("waste")
    var waste = document.createElement("div")
    waste.id = "waste"
    stepTab.replaceChild(waste, oldWaste)
    var wasteNames = Object.keys(totals.waste)
    if (wasteNames.length == 0) {
        return
    }
    var wasteTable = document.createElement("table")
    waste.appendChild(wasteTable)
    header = document.createElement("tr")
    wasteTable.appendChild(header)
    th = document.createElement("th")
    th.textContent = "wasted items/" + rateName
    th.colSpan = 2
    header.appendChild(th)
    wasteNames.sort()
    for (var i = 0; i < wasteNames.length; i++) {
        var itemName = wasteNames[i]
        var item = solver.items[itemName]
        var rate = totals.waste[itemName]
        var row = document.createElement("tr")
        wasteTable.appendChild(row)
        var iconCell = document.createElement("td")
        iconCell.appendChild(getImage(item))
        row.appendChild(iconCell)
        var rateCell = document.createElement("td")
        rateCell.classList.add("right-align")
        var tt = document.createElement("tt")
        tt.textContent = alignRate(rate)
        rateCell.append(tt)
        row.appendChild(rateCell)
    }
}

