/*Copyright 2021 Kirk McDonald

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

function renderMatrix(d, A, m) {
    let table = d.append("table")
        .attr("border", 1)
    let header = table.append("tr")
    header.append("th")
    for (let item of m.items) {
        let th = header.append("th")
        th.append(() => new Text("s"))
        th.append(() => item.icon.make(32))
            .classed("item-icon", true)
    }
    for (let t of m.targets) {
        let th = header.append("th")
        th.append(() => t.item.icon.make(32))
        th.append(() => new Text("\u21d0"))
        th.append(() => t.recipe.icon.make(32))
    }
    header.append("th")
        .text("tax")
    for (let recipe of m.recipes) {
        header.append("th")
            .append(() => recipe.icon.make(32))
                .classed("item-icon", true)
    }
    header.append("th")
        .text("answer")
    header.append("th")
        .text("C")
    for (let r = 0; r < A.rows; r++) {
        let row = table.append("tr")
        let label = row.append("td")
        if (r < m.recipes.length) {
            label.append(() => m.recipes[r].icon.make(32))
                .classed("item-icon", true)
        } else if (r === A.rows - 2) {
            label.append(() => new Text("tax"))
        } else {
            label.append(() => new Text("answer"))
        }
        for (let c = 0; c < A.cols; c++) {
            let x = A.index(r, c)
            row.append("td")
                .classed("right-align", true)
                .append("tt")
                    .text(x.toString())
        }
    }
}

export function renderDebug() {
    let debugTab = d3.select("#debug_tab")

    let lastTableau = d3.select("#debug_tableau")
    lastTableau.selectChildren().remove()
    let lastSolution = d3.select("#debug_solution")
    lastSolution.selectChildren().remove()

    if (spec.lastTableau === null) {
        d3.select("#debug_message").text("No tableau required.")
    } else {
        d3.select("#debug_message").text("Displaying previous tableau.")
        renderMatrix(lastTableau, spec.lastTableau, spec.lastMetadata)
        renderMatrix(lastSolution, spec.lastSolution, spec.lastMetadata)
    }
}
