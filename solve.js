"use strict"

function UnknownRecipe(item) {
    this.name = item.name
    this.item = item
}

function Solver(items, recipes) {
    this.items = items
    this.recipes = recipes
    var groups = findGroups(items, recipes)
    // XXX: This is a hack. It assumes that there are exactly two groups, and
    // manually resolves the dependency between them instead of determining the
    // dependency algorithmically.
    if ("uranium-processing" in groups[1]) {
        groups = [groups[1], groups[0]]
    }
    this.matrixSolvers = []
    for (var i = 0; i < groups.length; i++) {
        this.matrixSolvers.push(new MatrixSolver(groups[i]))
    }
}
Solver.prototype = {
    constructor: Solver,
    solve: function(rates, spec) {
        var unknowns = {}
        var totals = new Totals()
        for (var itemName in rates) {
            var item = this.items[itemName]
            var rate = rates[itemName]
            var subTotals = item.produce(rate, spec)
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
            var solution = solver.solveFor(match, spec)
            if (!solution) {
                continue
            }
            for (var itemName in match) {
                delete totals.unfinished[itemName]
            }
            for (var recipeName in solution) {
                var rate = solution[recipeName]
                var recipe = this.recipes[recipeName]
                if (solver.inputRecipes.indexOf(recipe) !== -1) {
                    var ing = recipe.products[0]
                    var subTotals = ing.item.produce(rate.mul(ing.amount), spec)
                    totals.combine(subTotals, true)
                } else {
                    totals.add(recipeName, rate)
                }
            }
        }
        return totals
    }
}
