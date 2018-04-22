"use strict"

var DEFAULT_PRIORITY = "default"

var PRIORITY = {
    "default": ["uranium-ore", "steam", "crude-oil", "coal", "water"],
    "basic": ["uranium-ore", "steam", "water", "crude-oil", "coal"],
    "coal": ["uranium-ore", "crude-oil", "water", "coal", "steam"]
}
var WASTE_ITEM_PRIORITY = ["solid-fuel", "petroleum-gas", "light-oil", "heavy-oil"]

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
// ignored. Also don't zero out guaranteed columns (input recipes).
function applyIgnore(indexes, ignore, guarantee, n) {
    var result = []
    var lookup = []
    var j = 0
    var g = 0
    for (var i = 0; i < n; i++) {
        if (i == ignore[j]) {
            j++
            continue
        }
        while ((i + g) == guarantee[g]) {
            g++
        }
        lookup.push(i + g)
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

// Given two sorted arrays of integers, return whether there are any elements
// in common.
function intersectArrays(a, b) {
    var j = 0;
    for (var i = 0; i < a.length; i++) {
        while (j < b.length && b[j] < a[i]) {
            j++
        }
        if (j == b.length) {
            return false
        }
        if (a[i] == b[j]) {
            return true
        }
    }
    return false
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
    this.items = items
    // Map of items produced by this matrix.
    this.outputs = {}
    // Array of items produced by this matrix.
    this.outputItems = []
    // Map from item name to waste-item column (minus offset).
    var wasteItems = {}
    for (var itemName in products) {
        var item = products[itemName]
        this.outputs[item.name] = item
        items.push(item)
        wasteItems[item.name] = this.outputItems.length
        this.outputItems.push(item)
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
    this.recipeIndexes = {}
    this.inputColumns = []
    for (var i = 0; i < allRecipes.length; i++) {
        this.recipeIndexes[allRecipes[i].name] = i
        if (i >= recipeArray.length) {
            this.inputColumns.push(i)
        }
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
    this.setPriority(DEFAULT_PRIORITY)
    this.wastePriorities = this.priority.length
    for (var i = 0; i < WASTE_ITEM_PRIORITY.length; i++) {
        var name = WASTE_ITEM_PRIORITY[i]
        if (name in wasteItems) {
            this.priority.push(this.recipes.length + wasteItems[name])
        }
    }
    this.lastSolutions = []
}
MatrixSolver.prototype = {
    constructor: MatrixSolver,
    setPriority: function(priorityName) {
        // Maps priority number to column number.
        var priority = PRIORITY[priorityName]
        this.priority = []
        for (var i = 0; i < priority.length; i++) {
            var name = priority[i]
            if (name in this.recipeIndexes) {
                this.priority.push(this.recipeIndexes[name])
            }
        }
    },
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
        // XXX: Do we need to de-dup this?
        var ignore = []
        var ignoredItems = 0
        for (var row = 0; row < this.matrix.rows; row++) {
            var providers = itemCols[row].prod
            var users = itemCols[row].use
            if (want[row].isZero() && users.length == 0) {
                for (var i = 0; i < providers.length; i++) {
                    ignore.push(providers[i])
                }
                ignoredItems++
            }
        }
        return {columns: ignore, count: ignoredItems}
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
    // Return whether the given set of indexes will permit wasting all of our
    // desired outputs.
    excludeWaste: function(indexes, wantIndexes) {
        return !intersectArrays(indexes, wantIndexes)
    },
    solveFor: function(products, spec, extra) {
        // Array of desired item-rates.
        var want = []
        for (var i = 0; i < this.matrix.rows; i++) {
            want.push(zero)
        }
        for (var itemName in products) {
            if (itemName in this.itemIndexes) {
                want[this.itemIndexes[itemName]] = products[itemName]
            }
        }
        var wantIndexes = []
        for (var i = 0; i < want.length; i++) {
            if (!want[i].equal(zero)) {
                wantIndexes.push(i + this.recipes.length)
            }
        }
        var A
        if (extra) {
            var toAdd = this.outputItems.length + 1
            A = this.matrix.appendColumns(toAdd)
            for (var i = 0; i < this.outputItems.length; i++) {
                var row = this.itemIndexes[this.outputItems[i].name]
                A.setIndex(row, this.recipes.length + i, minusOne)
            }
            A.setColumn(A.cols - 1, want)
        } else {
            A = this.matrix.appendColumn(want)
        }
        // Information about which recipes are relevant to each item.
        var itemCols = []
        for (var i = 0; i < this.matrix.rows; i++) {
            itemCols.push(this.itemCols(i))
        }
        // Number of recipes which are the outputs/targets of this matrix.
        var productRecipes = A.cols - this.inputRecipes.length - 1
        // Columns we know we don't need.
        var ignoreParts = this.ignoreCols(itemCols, want)
        var ignore = ignoreParts.columns
        var ignoredItemCount = ignoreParts.count
        // Number of unknowns in the solution.
        var zeroCount = A.cols - A.rows - ignore.length + ignoredItemCount - 1
        var solutions = []
        this.lastSolutions = []
        // Array of arrays, containing different combinations of columns to
        // zero out.
        var c = combinations(productRecipes - ignore.length, zeroCount)
        possible: for (var i = 0; i < c.length; i++) {
            // Adjust array of columns we will zero out to account for columns
            // we are ignoring.
            var indexes = applyIgnore(c[i], ignore, this.inputColumns, productRecipes)
            // Ignore any combination which completely excludes all producers
            // of any item.
            if (this.exclude(indexes, itemCols, ignore)) {
                this.lastSolutions.push({cols: A.cols, zero: indexes, ignore: ignore, reason: "exclude"})
                continue
            }
            if (extra && this.excludeWaste(indexes, wantIndexes)) {
                this.lastSolutions.push({cols: A.cols, zero: indexes, ignore: ignore, reason: "waste"})
                continue
            }
            // Make copy of matrix and zero out selected columns.
            var A_prime = A.copy()
            for (var j = 0; j < indexes.length; j++) {
                A_prime.zeroColumn(indexes[j])
            }
            // Apply productivity effects.
            for (var j = 0; j < this.recipes.length; j++) {
                var recipe = this.recipes[j]
                var factory = spec.getFactory(recipe)
                if (factory) {
                    var prod = factory.prodEffect(spec)
                    A_prime.mulPosColumn(j, prod)
                }
            }
            // Solve.
            var pivots = A_prime.rref()
            var rates = []
            for (var j = 0; j < A_prime.cols - 1; j++) {
                rates.push(zero)
            }
            for (var j = 0; j < pivots.length; j++) {
                var pivot = pivots[j]
                if (pivot == rates.length) {
                    continue
                }
                rates[pivot] = A_prime.index(j, A_prime.cols - 1)
            }
            // Verify that all values in the solution are positive. Skip this
            // solution if any are negative or all are zero.
            var any = false
            for (var j = 0; j < rates.length; j++) {
                var x = rates[j]
                if (x.less(zero)) {
                    this.lastSolutions.push({rates: rates, zero: indexes, ignore: ignore, reason: "negative"})
                    continue possible
                }
                if (!x.equal(zero)) {
                    any = true
                }
            }
            if (any) {
                solutions.push({rates: rates, zero: indexes, ignore: ignore})
            }
        }
        if (solutions.length == 0) {
            return null
        }
        // Sort all found solutions in resource-priority order.
        // XXX: A full sort isn't necessary. Simply finding the minimum will do.
        var indexes = []
        var priorities = []
        for (var i = 0; i < solutions.length; i++) {
            var solution = solutions[i]
            indexes.push(i)
            var pri = []
            var end = this.priority.length
            if (!extra) {
                end = this.wastePriorities
            }
            for (var p = 0; p < end; p++) {
                pri.push(solution.rates[this.priority[p]])
            }
            priorities.push(pri)
        }
        indexes.sort(function(a, b) {
            return lexicographicOrder(priorities[a], priorities[b])
        })
        for (var i = 0; i < indexes.length; i++) {
            this.lastSolutions.push(solutions[indexes[i]])
        }
        // Convert array of rates into map from recipe name to rate.
        var rates = solutions[indexes[0]].rates
        solution = {}
        for (var i = 0; i < this.recipes.length; i++) {
            var rate = rates[i]
            if (zero.less(rate)) {
                solution[this.recipes[i].name] = rate
            }
        }
        var waste = {}
        if (extra) {
            for (var i = 0; i < this.outputItems.length; i++) {
                var rate = rates[this.recipes.length + i]
                if (zero.less(rate)) {
                    waste[this.outputItems[i].name] = rate
                }
            }
        }
        return {solution: solution, waste: waste}
    }
}
