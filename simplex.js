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

function pivot(A, row, col) {
    var x = A.index(row, col)
    A.mulRow(row, x.reciprocate())
    for (var r = 0; r < A.rows; r++) {
        if (r === row) {
            continue
        }
        var ratio = A.index(r, col)
        if (ratio.isZero()) {
            continue
        }

        for (var c = 0; c < A.cols; c++) {
            x = A.index(r, c).sub(A.index(row, c).mul(ratio))
            A.setIndex(r, c, x)
        }
    }
}

function getTestRatios(A, col) {
    var ratios = []
    for (var i = 0; i < A.rows - 1; i++) {
        var x = A.index(i, col)
        if (!zero.less(x)) {
            ratios.push(null)
        } else {
            ratios.push(A.index(i, A.cols - 1).div(x))
        }
    }
    return ratios
}

function pivotCol(A, col) {
    var best_ratio = null
    var best_row = null
    for (var row = 0; row < A.rows - 1; row++) {
        var x = A.index(row, col)
        if (!zero.less(x)) {
            continue
        }
        var ratio = A.index(row, A.cols - 1).div(x)
        if (best_ratio === null || ratio.less(best_ratio)) {
            best_ratio = ratio
            best_row = row
        }
    }
    if (best_ratio !== null) {
        pivot(A, best_row, col)
    }
    return best_row
}

// Every basic variable in our initial tableau is negative. This procedure will
// invert these bases, placing the tableau into the standard form, ready for
// application of the simplex method.
function eliminateNegativeBases(A) {
    var negativeBases = []
    for (var i = 0; i < A.rows - 1; i++) {
        // If the RHS is zero, just multiply the whole row by -1.
        if (A.index(i, A.cols - 1).equal(zero)) {
            A.mulRow(i, minusOne)
            negativeBases.push(false)
        } else {
            negativeBases.push(true)
        }
    }
    var done = false
    findNext: while (!done) {
        for (var i = 0; i < negativeBases.length; i++) {
            if (!negativeBases[i]) {
                continue
            }
            // Find largest positive coefficient in the row.
            var max = zero
            var maxCol = null
            for (var j = 0; j < A.cols - 1; j++) {
                var x = A.index(i, j)
                if (max.less(x)) {
                    max = x
                    maxCol = j
                }
            }
            // Something is wrong; we can't solve this.
            if (maxCol === null) {
                throw new Error("Cannot eliminate negative basic variable.")
            }
            // Pivot on that column. If two rows have an equal test ratio,
            // and one has a negative basic variable, prefer the row whose
            // value is negative.
            var ratios = getTestRatios(A, maxCol)
            var matches = []
            var minRatio = null
            for (var j = 0; j < ratios.length; j++) {
                var ratio = ratios[j]
                if (ratio === null || ratio.less(zero)) {
                    continue
                }
                if (minRatio === null || ratio.less(minRatio)) {
                    minRatio = ratio
                    matches = [j]
                } else if (ratio.equal(minRatio)) {
                    matches.push(j)
                }
            }
            var pivotIdx = 0
            for (; pivotIdx < matches.length; pivotIdx++) {
                if (negativeBases[matches[pivotIdx]]) {
                    break
                }
            }
            if (pivotIdx === matches.length) {
                pivotIdx = 0
            }
            var pivotRow = matches[pivotIdx]
            negativeBases[pivotRow] = false
            pivot(A, pivotRow, maxCol)
            continue findNext
        }
        done = true
    }
}

function simplex(A) {
    while (true) {
        var min = null
        var minCol = null
        for (var col = 0; col < A.cols - 1; col++) {
            var x = A.index(A.rows - 1, col)
            if (min === null || x.less(min)) {
                min = x
                minCol = col
            }
        }
        if (!min.less(zero)) {
            return
        }
        pivotCol(A, minCol)
    }
}

function getBasis(A) {
    var basis = []
    for (var i = 0; i < A.cols - 1; i++) {
        var found = null
        for (var j = 0; j < A.rows; j++) {
            var x = A.index(j, i)
            if (x.isZero()) {
                continue
            } else if (x.equal(one)) {
                if (found) {
                    found = zero
                    break
                }
                found = A.index(j, A.cols - 1)
                continue
            } else {
                found = zero
                break
            }
        }
        if (!found) {
            found = zero
        }
        basis.push(found)
    }
    return basis
}
