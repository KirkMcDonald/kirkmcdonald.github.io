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

function getSolutionHeader(matrixSolver, costHeader) {
    var row = document.createElement("tr")
    var items = matrixSolver.items
    for (var i = 0; i < items.length; i++) {
        var item = items[i]
        var cell = document.createElement("th")
        cell.appendChild(new Text("s"))
        cell.appendChild(getImage(item))
        row.appendChild(cell)
    }
    var cell = document.createElement("th")
    cell.appendChild(new Text("tax"))
    row.appendChild(cell)
    var recipes = matrixSolver.recipes
    for (var i = 0; i < recipes.length; i++) {
        var obj = recipes[i]
        var cell = document.createElement("th")
        cell.appendChild(getImage(obj))
        row.appendChild(cell)
    }
    cell = document.createElement("th")
    cell.appendChild(new Text("answer"))
    row.appendChild(cell)
    if (costHeader) {
        var cell = document.createElement("th")
        cell.appendChild(new Text("C"))
        row.appendChild(cell)
    }
    return row
}

function renderMatrix(matrixSolver, A, rowIcons) {
    var table = document.createElement("table")
    table.border = "1"
    var header = getSolutionHeader(matrixSolver, true)
    if (rowIcons) {
        header.insertBefore(document.createElement("th"), header.firstChild)
    }
    table.appendChild(header)
    for (var j = 0; j < A.rows; j++) {
        var row = document.createElement("tr")
        table.appendChild(row)
        if (rowIcons) {
            var td = document.createElement("td")
            if (j < matrixSolver.recipes.length) {
                var recipes = matrixSolver.recipes[j]
                td.appendChild(getImage(recipes))
            } else if (j == A.rows - 2) {
                td.appendChild(new Text("tax"))
            } else if (j == A.rows - 1) {
                td.appendChild(new Text("answer"))
            }
            row.appendChild(td)
        }
        for (var k = 0; k < A.cols; k++) {
            var cell = document.createElement("td")
            cell.classList.add("right-align")
            row.appendChild(cell)
            var x = A.index(j, k)
            var tt = document.createElement("tt")
            tt.textContent = x.toMixed()
            cell.appendChild(tt)
        }
    }
    return table
}

function renderDebug() {
    var debugTab = document.getElementById("debug_tab")

    var oldMatrixes = document.getElementById("matrixes")
    var node = document.createElement("div")
    node.id = "matrixes"
    debugTab.replaceChild(node, oldMatrixes)

    for (var i = 0; i < solver.matrixSolvers.length; i++) {
        var matrixSolver = solver.matrixSolvers[i]
        var A = matrixSolver.matrix
        var table = renderMatrix(matrixSolver, A, true)
        node.appendChild(table)
    }

    var oldSolutions = document.getElementById("solution")
    node = document.createElement("div")
    node.id = "solution"
    debugTab.replaceChild(node, oldSolutions)

    for (var i = 0; i < solver.matrixSolvers.length; i++) {
        var matrixSolver = solver.matrixSolvers[i]
        var A = matrixSolver.lastProblem
        if (A) {
            var table = renderMatrix(matrixSolver, A, false)
            node.appendChild(table)
        }
        A = matrixSolver.lastSolution
        if (A) {
            //var basis = getBasis(A)
            var table = document.createElement("table")
            table.border = "1"
            var header = getSolutionHeader(matrixSolver, true)
            table.appendChild(header)
            var row = document.createElement("tr")
            table.appendChild(row)
            for (var j = 0; j < A.cols; j++) {
                var cell = document.createElement("td")
                cell.classList.add("right-align")
                row.appendChild(cell)
                //var x = basis[j]
                var x = A.index(A.rows - 1, j)
                var tt = document.createElement("tt")
                tt.textContent = x.toDecimal(3)
                cell.appendChild(tt)
            }
            node.appendChild(table)
        }
    }
}
