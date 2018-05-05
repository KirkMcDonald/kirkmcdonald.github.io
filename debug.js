"use strict"

function getSolutionHeader(matrixSolver, answerHeader) {
    var row = document.createElement("tr")
    var allImages = matrixSolver.recipes
    for (var i = 0; i < allImages.length; i++) {
        var obj = allImages[i]
        var cell = document.createElement("th")
        cell.appendChild(getImage(obj))
        row.appendChild(cell)
    }
    var cell = document.createElement("th")
    cell.appendChild(new Text("tax"))
    row.appendChild(cell)
    var items = matrixSolver.items
    for (var i = 0; i < items.length; i++) {
        var item = items[i]
        var cell = document.createElement("th")
        cell.appendChild(new Text("s"))
        cell.appendChild(getImage(item))
        row.appendChild(cell)
    }
    var cell = document.createElement("th")
    cell.appendChild(new Text("C"))
    row.appendChild(cell)
    if (answerHeader) {
        var cell = document.createElement("th")
        cell.appendChild(new Text("answer"))
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
            if (j < matrixSolver.items.length) {
                var item = matrixSolver.items[j]
                td.appendChild(getImage(item))
            } else if (j == A.rows - 2) {
                td.appendChild(new Text("tax"))
            } else if (j == A.rows - 1) {
                td.appendChild(new Text("cost"))
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
        var A = matrixSolver.lastSolution
        /*if (A) {
            var table = renderMatrix(matrixSolver, A, false)
            node.appendChild(table)
        }*/
        var basis = getBasis(A)
        var table = document.createElement("table")
        table.border = "1"
        var header = getSolutionHeader(matrixSolver)
        table.appendChild(header)
        var row = document.createElement("tr")
        table.appendChild(row)
        for (var j = 0; j < basis.length; j++) {
            var cell = document.createElement("td")
            cell.classList.add("right-align")
            row.appendChild(cell)
            var x = basis[j]
            var tt = document.createElement("tt")
            tt.textContent = x.toDecimal(3)
            cell.appendChild(tt)
        }
        node.appendChild(table)
    }
}
