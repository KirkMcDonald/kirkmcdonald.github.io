"use strict"

var PRIORITY = ["steam", "crude-oil", "coal", "water"]

function combinations(n, r) {
    if (r > n) {
        return []
    }
    var result = []
    var indices = []
    for (var i = 0; i < r; i++) {
        indices.push(i)
    }
    result.push(indices.slice())
    while (true) {
        var i = r - 1
        for (; i >= 0; i--) {
            if (indices[i] != i + n - r) {
                break
            }
        }
        if (i < 0) {
            return result
        }
        indices[i] += 1
        for (var j = i + 1; j < r; j++) {
            indices[j] = indices[j - 1] + 1
        }
        result.push(indices.slice())
    }
}

// Combine list of indexes (output from combinations) with indexes being
// ignored.
function applyIgnore(indexes, ignore, n) {
    var result = []
    var lookup = []
    var j = 0
    for (var i = 0; i < n; i++) {
        if (i == ignore[j]) {
            j++
            continue
        }
        lookup.push(i)
    }
    j = 0
    for (var i = 0; i < indexes.length; i++) {
        var val = lookup[indexes[i]]
        while (j < ignore.length && ignore[j] < val) {
            result.push(ignore[j])
            j++
        }
        result.push(val)
    }
    for (; j < ignore.length; j++) {
        result.push(ignore[j])
    }
    return result
}

// Assumes same length.
function lexicographicOrder(a, b) {
    for (var i = 0; i < a.length; i++) {
        if (a[i].equal(b[i])) {
            continue
        }
        if (a[i].less(b[i])) {
            return -1
        } else {
            return 1
        }
    }
    return 0
}

// Given two sorted arrays of integers, return whether a is a subset of b.
function subset(a, b) {
    var j = 0
    for (var i = 0; i < a.length; i++) {
        while (j < b.length && b[j] < a[i]) {
            j++
        }
        if (j == b.length || b[j] != a[i]) {
            return false
        }
    }
    return true
}

function MatrixSolver(recipes) {
    var products = {}
    var ingredients = {}
    var recipeArray = []
    for (var recipeName in recipes) {
        var recipe = recipes[recipeName]
        recipeArray.push(recipe)
        for (var i = 0; i < recipe.products.length; i++) {
            var ing = recipe.products[i]
            products[ing.item.name] = ing.item
        }
        for (var i = 0; i < recipe.ingredients.length; i++) {
            var ing = recipe.ingredients[i]
            ingredients[ing.item.name] = ing.item
        }
    }
    var items = []
    // Map of items produced by this matrix, all of which have multiple recipes.
    this.outputs = {}
    for (var itemName in products) {
        var item = products[itemName]
        if (item.recipes.length > 1) {
            this.outputs[item.name] = item
        }
        items.push(item)
    }
    // Array of the recipes that produce the "inputs" to this matrix.
    this.inputRecipes = []
    for (var itemName in ingredients) {
        if (itemName in products) {
            continue
        }
        var item = ingredients[itemName]
        items.push(item)
        var recipe = item.recipes[0]
        this.inputRecipes.push(recipe)
    }
    var allRecipes = recipeArray.concat(this.inputRecipes)
    var itemIndexes = {}
    for (var i = 0; i < items.length; i++) {
        itemIndexes[items[i].name] = i
    }
    var recipeIndexes = {}
    for (var i = 0; i < allRecipes.length; i++) {
        recipeIndexes[allRecipes[i].name] = i
    }
    var recipeMatrix = new Matrix(items.length, allRecipes.length)
    for (var i = 0; i < recipeArray.length; i++) {
        var recipe = recipeArray[i]
        for (var j = 0; j < recipe.ingredients.length; j++) {
            var ing = recipe.ingredients[j]
            var k = itemIndexes[ing.item.name]
            recipeMatrix.addIndex(k, i, zero.sub(ing.amount))
        }
        for (var j = 0; j < recipe.products.length; j++) {
            var ing = recipe.products[j]
            var k = itemIndexes[ing.item.name]
            recipeMatrix.addIndex(k, i, ing.amount)
        }
    }
    for (var i = 0; i < this.inputRecipes.length; i++) {
        var recipe = this.inputRecipes[i]
        for (var j = 0; j < recipe.products.length; j++) {
            var ing = recipe.products[j]
            var k = itemIndexes[ing.item.name]
            recipeMatrix.addIndex(k, i + recipeArray.length, ing.amount)
        }
    }
    // The matrix. (matrix.js)
    this.matrix = recipeMatrix
    // Map from item name to row number.
    this.itemIndexes = itemIndexes
    // List of all recipes in matrix, in matrix column order.
    this.recipes = allRecipes
    // Maps priority number to column number.
    this.priority = []
    for (var i = 0; i < PRIORITY.length; i++) {
        var name = PRIORITY[i]
        if (name in recipeIndexes) {
            this.priority.push(recipeIndexes[name])
        }
    }
}
MatrixSolver.prototype = {
    constructor: MatrixSolver,
    match: function(products) {
        var result = {}
        for (var itemName in products) {
            if (itemName in this.outputs) {
                result[itemName] = products[itemName]
            }
        }
        return result
    },
    // Get the input/output column indexes for each item.
    itemCols: function(row) {
        var prodCols = []
        var useCols = []
        var productRecipes = this.matrix.cols - this.inputRecipes.length
        for (var col = 0; col < productRecipes; col++) {
            var x = this.matrix.index(row, col)
            if (zero.less(x)) {
                prodCols.push(col)
            } else if (x.less(zero)) {
                useCols.push(col)
            }
        }
        return {prod: prodCols, use: useCols}
    },
    // Get the columns for recipes that produce an item that nothing needs.
    ignoreCols: function(itemCols, want) {
        var ignore = []
        for (var row = 0; row < this.matrix.rows; row++) {
            var providers = itemCols[row].prod
            var users = itemCols[row].use
            if (want[row].isZero() && users.length == 0) {
                for (var i = 0; i < providers.length; i++) {
                    ignore.push(providers[i])
                }
            }
        }
        return ignore
    },
    // Return whether the given set of indexes will exclude all possible
    // producers of an item.
    exclude: function(indexes, itemCols, ignore) {
        var strippedIndexes = []
        var j = 0
        for (var i = 0; i < indexes.length; i++) {
            while (j < ignore.length && ignore[j] < indexes[i]) {
                j++
            }
            if (j < ignore.length && ignore[j] == indexes[i]) {
                continue
            }
            strippedIndexes.push(indexes[i])
        }
        for (var row = 0; row < this.matrix.rows; row++) {
            var cols = itemCols[row]
            var providers = cols.prod
            var users = cols.use
            // Is an input item/recipe, already excluded.
            if (providers.length == 0) {
                continue
            }
            if (subset(providers, strippedIndexes)) {
                return true
            }
        }
        return false
    },
    solveFor: function(products, spec) {
        var want = []
        for (var i = 0; i < this.matrix.rows; i++) {
            want.push(zero)
        }
        for (var itemName in products) {
            if (itemName in this.itemIndexes) {
                want[this.itemIndexes[itemName]] = products[itemName]
            }
        }
        var A = this.matrix.appendColumn(want)
        var itemCols = []
        for (var i = 0; i < this.matrix.rows; i++) {
            itemCols.push(this.itemCols(i))
        }
        var productRecipes = this.matrix.cols - this.inputRecipes.length
        var ignore = this.ignoreCols(itemCols, want)
        var zeroCount = this.matrix.cols - this.matrix.rows - ignore.length
        var solutions = []
        var c = combinations(productRecipes - ignore.length, zeroCount)
        possible: for (var i = 0; i < c.length; i++) {
            var indexes = applyIgnore(c[i], ignore, productRecipes)
            if (this.exclude(indexes, itemCols, ignore)) {
                continue
            }
            var A_prime = A.copy()
            for (var j = 0; j < indexes.length; j++) {
                A_prime.zeroColumn(indexes[j])
            }
            for (var j = 0; j < this.recipes.length; j++) {
                var recipe = this.recipes[j]
                var factory = spec.getFactory(recipe)
                if (factory) {
                    var prod = factory.prodEffect(spec)
                    A_prime.mulPosColumn(j, prod)
                }
            }
            var pivots = A_prime.rref()
            var rates = []
            for (var j = 0; j < this.matrix.cols; j++) {
                rates.push(zero)
            }
            for (var j = 0; j < pivots.length; j++) {
                var pivot = pivots[j]
                if (pivot == rates.length) {
                    continue
                }
                rates[pivot] = A_prime.index(j, A_prime.cols - 1)
            }
            var any = false
            for (var j = 0; j < rates.length; j++) {
                var x = rates[j]
                if (x.less(zero)) {
                    continue possible
                }
                if (!x.equal(zero)) {
                    any = true
                }
            }
            if (any) {
                solutions.push(rates)
            }
        }
        if (solutions.length == 0) {
            return null
        }
        var indexes = []
        var priorities = []
        for (var i = 0; i < solutions.length; i++) {
            var solution = solutions[i]
            indexes.push(i)
            var pri = []
            for (var p = 0; p < this.priority.length; p++) {
                pri.push(solution[this.priority[p]])
            }
            priorities.push(pri)
        }
        indexes.sort(function(a, b) {
            return lexicographicOrder(priorities[a], priorities[b])
        })
        var rates = solutions[indexes[0]]
        solution = {}
        for (var i = 0; i < rates.length; i++) {
            var rate = rates[i]
            if (zero.less(rate)) {
                solution[this.recipes[i].name] = rate
            }
        }
        return solution
    }
}
