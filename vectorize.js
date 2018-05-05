"use strict"

var PRIORITY = ["uranium-ore", "steam", "crude-oil", "coal", "water"]

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
    var rows = items.length + 2
    var cols = allRecipes.length + items.length + 3
    var recipeMatrix = new Matrix(rows, cols)
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
        // Recipe tax.
        recipeMatrix.setIndex(items.length, i, minusOne)
    }
    for (var i = 0; i < this.inputRecipes.length; i++) {
        var recipe = this.inputRecipes[i]
        for (var j = 0; j < recipe.products.length; j++) {
            var ing = recipe.products[j]
            var k = itemIndexes[ing.item.name]
            recipeMatrix.addIndex(k, i + recipeArray.length, ing.amount)
        }
    }
    // Add "recipe tax," so that wasted items will be wasted directly.
    // There is no surplus variable for this value.
    recipeMatrix.setIndex(items.length, allRecipes.length, one)
    recipeMatrix.setIndex(items.length + 1, allRecipes.length, one)
    // Add surplus variables.
    for (var i = 0; i < items.length; i++) {
        var col = allRecipes.length + i + 1
        recipeMatrix.setIndex(i, col, minusOne)
    }
    // The matrix. (matrix.js)
    this.matrix = recipeMatrix
    // Map from item name to row number.
    this.itemIndexes = itemIndexes
    // List of all recipes in matrix, in matrix column order.
    this.recipes = allRecipes
    this.lastProblem = null
    this.lastSolution = null
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
    getPriorityRatio: function(A) {
        var min = null
        var max = null
        for (var i = 0; i < A.mat.length; i++) {
            var x = A.mat[i].abs()
            if (x.isZero()) {
                continue
            }
            if (min === null || x.less(min)) {
                min = x
            }
            if (max === null || max.less(x)) {
                max = x
            }
        }
        return max.div(min)
    },
    setCost: function(A) {
        var ratio = this.getPriorityRatio(A)
        // Cost == 1 already "spent" on recipe tax.
        var cost = ratio
        // Maps priority number to column number.
        for (var i = PRIORITY.length - 1; i >= 0; i--) {
            var name = PRIORITY[i]
            var col = this.recipeIndexes[name]
            if (!col) {
                continue
            }
            A.setIndex(A.rows - 1, col, cost)
            cost = cost.mul(ratio)
        }
        // Coefficient for cost value itself.
        A.setIndex(A.rows - 1, A.cols - 2, one)
    },
    solveFor: function(products, spec, disabled) {
        var A = this.matrix.copy()
        for (var itemName in products) {
            if (itemName in this.itemIndexes) {
                var row = this.itemIndexes[itemName]
                var rate = products[itemName]
                A.setIndex(row, A.cols - 1, rate)
            }
        }
        // Zero out disabled recipes
        for (var recipeName in disabled) {
            if (recipeName in this.recipeIndexes) {
                var i = this.recipeIndexes[recipeName]
                A.zeroColumn(i)
            }
        }
        // Apply productivity effects.
        for (var i = 0; i < this.recipes.length; i++) {
            var recipe = this.recipes[i]
            var factory = spec.getFactory(recipe)
            if (factory) {
                var prod = factory.prodEffect(spec)
                A.mulPosColumn(i, prod)
            }
        }
        this.setCost(A)
        this.lastProblem = A.copy()
        // Solve.
        eliminateNegativeBases(A)
        simplex(A)
        var x = getBasis(A)
        // Convert array of rates into map from recipe name to rate.
        var solution = {}
        for (var i = 0; i < this.recipes.length; i++) {
            var rate = x[i]
            if (zero.less(rate)) {
                solution[this.recipes[i].name] = rate
            }
        }
        var waste = {}
        for (var i = 0; i < this.outputItems.length; i++) {
            var rate = x[this.recipes.length + i + 1]
            if (zero.less(rate)) {
                waste[this.outputItems[i].name] = rate
            }
        }
        this.lastSolution = A
        return {solution: solution, waste: waste}
    }
}
