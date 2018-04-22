"use strict"

function getSolutionHeader(matrixSolver) {
    var row = document.createElement("tr")
    var allImages = matrixSolver.recipes
    for (var i = 0; i < allImages.length; i++) {
        var obj = allImages[i]
        var cell = document.createElement("th")
        cell.appendChild(getImage(obj))
        row.appendChild(cell)
    }
    return row
}

function renderDebug() {
    var debugTab = document.getElementById("debug_tab")

    var oldMatrixes = document.getElementById("matrixes")
    var node = document.createElement("div")
    node.id = "matrixes"
    debugTab.replaceChild(node, oldMatrixes)

    for (var i = 0; i < solver.matrixSolvers.length; i++) {
        var table = document.createElement("table")
        table.border = "1"
        node.appendChild(table)
        var matrixSolver = solver.matrixSolvers[i]
        var header = getSolutionHeader(matrixSolver)
        header.insertBefore(document.createElement("th"), header.firstChild)
        table.appendChild(header)
        for (var j = 0; j < matrixSolver.items.length; j++) {
            var item = matrixSolver.items[j]
            var row = document.createElement("tr")
            table.appendChild(row)
            var td = document.createElement("td")
            td.appendChild(getImage(item))
            row.appendChild(td)
            for (var k = 0; k < matrixSolver.recipes.length; k++) {
                var cell = document.createElement("td")
                cell.classList.add("right-align")
                row.appendChild(cell)
                var x = matrixSolver.matrix.index(j, k)
                var tt = document.createElement("tt")
                tt.textContent = x.toMixed()
                cell.appendChild(tt)
            }
        }
    }

    var oldSolutions = document.getElementById("solutions")
    node = document.createElement("div")
    node.id = "solutions"
    debugTab.replaceChild(node, oldSolutions)

    for (var i = 0; i < solver.matrixSolvers.length; i++) {
        var table = document.createElement("table")
        table.border = "1"
        node.appendChild(table)
        var matrixSolver = solver.matrixSolvers[i]
        var header = getSolutionHeader(matrixSolver)
        var reasonHeader = document.createElement("th")
        reasonHeader.textContent = "reason"
        header.insertBefore(reasonHeader, header.firstChild)
        for (var j = 0; j < matrixSolver.outputItems.length; j++) {
            var item = matrixSolver.outputItems[j]
            var cell = document.createElement("th")
            cell.appendChild(new Text("-"))
            cell.appendChild(getImage(item))
            header.appendChild(cell)
        }
        table.appendChild(header)
        for (var j = 0; j < matrixSolver.lastSolutions.length; j++) {
            var solution = matrixSolver.lastSolutions[j]
            var row = document.createElement("tr")
            table.appendChild(row)
            var reason = ""
            if (solution.reason) {
                reason = solution.reason
            }
            var reasonCell = document.createElement("td")
            reasonCell.textContent = reason
            row.appendChild(reasonCell)
            var zeroOut = 0
            var ignore = 0
            var cols
            if (solution.rates) {
                cols = solution.rates.length
            } else {
                cols = solution.cols - 1
            }
            for (var k = 0; k < cols; k++) {
                var cell = document.createElement("td")
                var tt = document.createElement("tt")
                cell.appendChild(tt)
                if (solution.rates) {
                    var rate = solution.rates[k]
                    tt.textContent = alignRate(rate)
                } else {
                    tt.textContent = "\u2014"
                }
                cell.classList.add("right-align")
                if (k == solution.zero[zeroOut]) {
                    zeroOut++
                    cell.classList.add("zero-out")
                }
                if (k == solution.ignore[ignore]) {
                    ignore++
                    cell.classList.add("ignore")
                }
                row.appendChild(cell)
            }
        }
    }
}
