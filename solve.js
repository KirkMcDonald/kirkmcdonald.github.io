"use strict"

function UnknownRecipe(item) {
    this.name = item.name
    this.item = item
}

function walk(item, seen, solvers) {
    for (var i = 0; i < solvers.length; i++) {
        var m = solvers[i]
        if (item.name in m.outputs) {
            return m
        }
    }
    seen[item.name] = item
    for (var i = 0; i < item.recipes.length; i++) {
        var recipe = item.recipes[i]
        for (var j = 0; j < recipe.ingredients.length; j++) {
            var ing = recipe.ingredients[j]
            if (ing.item.name in seen) {
                continue
            }
            var m = walk(ing.item, seen, solvers)
            if (m) {
                return m
            }
        }
    }
    return null
}

function insertBefore(array, newItem, existingItem) {
    if (!existingItem) {
        array.push(newItem)
        return
    }
    for (var i = 0; i < array.length; i++) {
        if (array[i] === existingItem) {
            array.splice(i, 0, newItem)
            return
        }
    }
    array.push(newItem)
}

function topologicalOrder(matrixSolvers) {
    var result = []
    for (var i = 0; i < matrixSolvers.length; i++) {
        var m = matrixSolvers[i]
        var items = {}
        // Obtain set of items depended on by the group.
        for (var j = 0; j < m.inputRecipes.length; j++) {
            var recipe = m.inputRecipes[j]
            for (var k = 0; k < recipe.ingredients.length; k++) {
                var ing = recipe.ingredients[k]
                items[ing.item.name] = ing.item
            }
        }
        var dep = null
        for (var itemName in items) {
            var item = items[itemName]
            var m2 = walk(item, {}, matrixSolvers)
            if (m2) {
                dep = m2
                break
            }
        }
        insertBefore(result, m, dep)
    }
    return result
}

function Solver(items, recipes) {
    this.items = items
    this.recipes = recipes
    this.disabledRecipes = {}
    var groups = findGroups(items, recipes)
    this.matrixSolvers = []
    for (var i = 0; i < groups.length; i++) {
        var group = groups[i]
        this.matrixSolvers.push(new MatrixSolver(group))
        // The order in which these group IDs are assigned does not matter.
        for (var recipeName in group) {
            group[recipeName].group = i
        }
    }
    this.matrixSolvers = topologicalOrder(this.matrixSolvers)
}
Solver.prototype = {
    constructor: Solver,
    setPriority: function(priority) {
        for (var i = 0; i < this.matrixSolvers.length; i++) {
            this.matrixSolvers[i].setPriority(priority)
        }
    },
    setDisabledRecipes: function(recipes) {
        this.disabledRecipes = recipes
    },
    solve: function(rates, ignore, spec) {
        var unknowns = {}
        var totals = new Totals()
        for (var itemName in rates) {
            var item = this.items[itemName]
            var rate = rates[itemName]
            var subTotals = item.produce(rate, ignore, spec)
            totals.combine(subTotals)
        }
        if (Object.keys(totals.unfinished).length == 0) {
            return totals
        }
        for (var i = 0; i < this.matrixSolvers.length; i++) {
            var solver = this.matrixSolvers[i]
            var match = solver.match(totals.unfinished)
            if (Object.keys(match).length == 0) {
                continue
            }
            var solution = solver.solveFor(match, spec, this.disabledRecipes, false)
            if (!solution) {
                solution = solver.solveFor(match, spec, this.disabledRecipes, true)
                if (!solution) {
                    continue
                }
            }
            for (var itemName in match) {
                delete totals.unfinished[itemName]
            }
            for (var recipeName in solution.solution) {
                var rate = solution.solution[recipeName]
                var recipe = this.recipes[recipeName]
                if (solver.inputRecipes.indexOf(recipe) !== -1) {
                    var ing = recipe.products[0]
                    var subTotals = ing.item.produce(rate.mul(ing.amount), ignore, spec)
                    totals.combine(subTotals, true)
                } else {
                    totals.add(recipeName, rate)
                }
            }
            for (var itemName in solution.waste) {
                totals.addWaste(itemName, solution.waste[itemName])
            }
        }
        return totals
    }
}
