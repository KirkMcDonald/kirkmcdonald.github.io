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

import { getCycleRecipes } from "./cycle.js"
import { Matrix } from "./matrix.js"
import { Rational, minusOne, zero, one } from "./rational.js"
import { Ingredient } from "./recipe.js"
import { simplex } from "./simplex.js"
import { Totals } from "./totals.js"

// Terminating nodes of a solution-graph.
class OutputRecipe {
    constructor(outputs) {
        this.name = "output"
        this.ingredients =  []
        for (let [item, rate] of outputs) {
            this.ingredients.push(new Ingredient(item, rate))
        }
        this.products = []
    }
    getIngredients() {
        return this.ingredients
    }
    isReal() {
        return false
    }
}

class SurplusRecipe extends OutputRecipe {
    constructor(output) {
        super(output)
        this.name = "surplus"
    }
}

class Result {
    constructor() {
        this.recipeRates = new Map()
        this.remaining = new Map()
        this.targets = []
    }
    add(recipe, rate) {
        let x = this.recipeRates.get(recipe) || zero
        this.recipeRates.set(recipe, x.add(rate))
    }
    remainder(item, rate) {
        let x = this.remaining.get(item) || zero
        this.remaining.set(item, x.add(rate))
    }
    unfinishedTarget(item, rate, recipe) {
        this.targets.push({item, rate, recipe})
    }
    combine(other) {
        for (let [recipe, rate] of other.recipeRates) {
            this.add(recipe, rate)
        }
        for (let [item, rate] of other.remaining) {
            this.remainder(item, rate)
        }
        this.targets = this.targets.concat(other.targets)
    }
}

function traverse(spec, cyclic, item, rate, forceRecipe) {
    let result = new Result()
    let recipe = forceRecipe
    if (recipe === undefined || recipe === null) {
        let itemRecipes = spec.getRecipes(item)
        if (itemRecipes.length > 1 || itemRecipes[0].products.length > 1 || cyclic.has(itemRecipes[0])) {
            result.remainder(item, rate)
            return result
        }
        recipe = itemRecipes[0]
    } else {
        if (recipe.products.length > 1 || cyclic.has(recipe)) {
            result.remainder(item, rate)
            result.unfinishedTarget(item, rate, recipe)
            return result
        }
    }
    let gives = recipe.gives(item)
    let recipeRate = rate.div(gives)
    result.add(recipe, recipeRate)
    if (spec.ignore.has(item)) {
        console.log("ignored:", item)
        return result
    }
    for (let ing of recipe.getIngredients()) {
        let sub = traverse(spec, cyclic, ing.item, recipeRate.mul(ing.amount))
        result.combine(sub)
    }
    return result
}

function recursiveSolve(spec, cyclic, outputs) {
    let result = new Result()
    for (let {item, rate, recipe} of outputs) {
        let sub = traverse(spec, cyclic, item, rate, recipe)
        result.combine(sub)
    }
    return result
}

/* Tableau layout:

Columns:
[surplus items] [pseudo] [tax] [recipes] [result] [cost]

Rows:
[recipes]
[tax]
[result]
*/

export function solve(spec, fullOutputs) {
    let outputs = new Map()
    for (let {item, rate, recipe} of fullOutputs) {
        rate = rate.add(outputs.get(item) || zero)
        outputs.set(item, rate)
    }
    let recipes = spec.getRecipeGraph(outputs)
    let cyclic = getCycleRecipes(spec, recipes)
    let partialSolution = recursiveSolve(spec, cyclic, fullOutputs)
    let solution = partialSolution.recipeRates
    spec.lastPartial = partialSolution

    if (partialSolution.remaining.size === 0) {
        spec.lastTableau = null
        spec.lastMetadata = null
        spec.lastSolution = null
        solution.set(new OutputRecipe(outputs), one)
        return new Totals(spec, outputs, solution, new Map(), new Map())
    }

    recipes = spec.getRecipeGraph(partialSolution.remaining)

    // If an item
    // 1) Is used as a link internal to a recipe cycle.
    //     and
    // 2) Is not produced by a recipe outside of the cycle.
    //     unless
    //   2a) It is a product of a factory target.
    // then include that item's disableRecipe in the tableau, at the maximum
    // possible priority level, as a producer of last resort. It is possible
    // for such items to be involved in a net-negative production loop, and
    // doing so will avoid infeasible solutions.

    // Map of build target items to recipes, if they are recipe-targets.
    let targetItemMap = new Map()
    for (let target of spec.buildTargets) {
        if (target.changedBuilding && target.recipe) {
            targetItemMap.set(target.item, target.recipe)
        }
    }

    let products = new Set()
    //let ingredients = new Set()

    let items = []
    let itemColumns = new Map()
    let recipeArray = []
    let recipeRows = new Map()

    let maxPriorityRecipes = new Map()

    for (let recipe of recipes) {
        if (cyclic.has(recipe)) {
            for (let {item} of recipe.getIngredients()) {
                if (recipes.has(item.disableRecipe)) {
                    continue
                }
                let candidate = false
                let outside = false
                for (let subrecipe of item.recipes) {
                    if (cyclic.has(subrecipe)) {
                        candidate = true
                    } else {
                        if (recipes.has(subrecipe)) {
                            outside = true
                        }
                    }
                }
                if (candidate && (targetItemMap.has(item) || !outside)) {
                    maxPriorityRecipes.set(item, item.disableRecipe)
                }
            }
        }
    }
    for (let [item, recipe] of maxPriorityRecipes) {
        recipes.add(recipe)
    }
    for (let recipe of recipes) {
        recipeRows.set(recipe, recipeArray.length)
        recipeArray.push(recipe)
        for (let ing of recipe.products) {
            if (!products.has(ing.item)) {
                itemColumns.set(ing.item, items.length)
                items.push(ing.item)
            }
            products.add(ing.item)
        }
    }

    // If a build target requests a number of buildings for a recipe that is
    // involved in a cycle, or which has multiple products, then we need to
    // include that target in the tableau, with pseudo-items that stand in for
    // the requested building count. We don't need any fancy math: The
    // production amount for the corresponding real item can simply be copied.
    /*for (let i = 0; i < partialSolution.targets.length; i++) {
        let t = partialSolution.targets[i]
        t.column = items.length + i
    }*/

    let columns = items.length + partialSolution.targets.length + recipeArray.length + /*disabledItems.length +*/ 3
    let rows = recipeArray.length + /*disabledItems.length +*/ 2
    let A = new Matrix(rows, columns)

    let tax = items.length + partialSolution.targets.length

    // Set recipe inputs/outputs
    for (let i = 0; i < recipeArray.length; i++) {
        let recipe = recipeArray[i]
        for (let ing of recipe.products) {
            let j = itemColumns.get(ing.item)
            A.setIndex(i, j, ing.amount)
        }
        for (let ing of recipe.getIngredients()) {
            let j = itemColumns.get(ing.item)
            A.addIndex(i, j, zero.sub(ing.amount))
        }
        // Apply prod bonus
        let prodEffect = spec.getProdEffect(recipe)
        if (one.less(prodEffect)) {
            for (let ing of recipe.products) {
                let j = itemColumns.get(ing.item)
                let n = A.index(i, j)
                if (zero.less(n)) {
                    A.setIndex(i, j, n.mul(prodEffect))
                }
            }
        }
        A.setIndex(i, tax, minusOne)
        A.setIndex(i, tax + i + 1, one)
    }
    // Set psuedo-items corresponding to remaining building-count targets.
    for (let i = 0; i < partialSolution.targets.length; i++) {
        let {recipe, item, rate} = partialSolution.targets[i]
        let row = recipeRows.get(recipe)
        let col = items.length + i
        let itemCol = itemColumns.get(item)
        let product = A.index(row, itemCol)
        A.setIndex(row, col, product)
        A.setIndex(rows - 1, col, zero.sub(rate))
    }
    /*for (let i = 0; i < disabledItems.length; i++) {
        let row = recipeArray.length + i
        A.setIndex(row, itemColumns.get(item), one)
        A.setIndex(row, tax, minusOne)
        A.setIndex(row, products.size + row, one)
    }*/
    A.setIndex(rows - 2, tax, one)
    A.setIndex(rows - 1, columns - 2, one)

    // Set target rates
    for (let [item, rate] of partialSolution.remaining) {
        let col = itemColumns.get(item)
        A.setIndex(rows - 1, col, zero.sub(rate))
    }

    // Set cost function
    let min = null
    let max = zero
    for (let x of A.mat) {
        if (x.isZero()) {
            continue
        }
        x = x.abs()
        if (min === null || x.less(min)) {
            min = x
        }
        if (max.less(x)) {
            max = x
        }
    }
    let two = Rational.from_float(2)
    let cost_ratio = max.div(min).mul(two)
    // The cost ratio must be greater than 1.
    if (cost_ratio.less(two)) {
        cost_ratio = two
    }
    A.setIndex(rows - 2, columns - 1, one)
    let P = cost_ratio
    for (let p of spec.priority) {
        let N = zero
        let minWeight = null
        for (let {recipe, weight} of p) {
            if (minWeight === null || weight.less(minWeight)) {
                minWeight = weight
            }
        }
        for (let {recipe, weight} of p) {
            if (recipeRows.has(recipe)) {
                let normalizedWeight = weight.div(minWeight)
                N = N.add(normalizedWeight)
                A.setIndex(recipeRows.get(recipe), columns - 1, P.mul(normalizedWeight))
            }
        }
        if (!N.isZero()) {
            P = P.mul(cost_ratio).mul(N)
        }
    }
    for (let [item, recipe] of maxPriorityRecipes) {
        A.setIndex(recipeRows.get(recipe), columns - 1, P)
    }

    spec.lastTableau = A.copy()
    spec.lastMetadata = {
        "items": items,
        "recipes": recipeArray,
        "targets": partialSolution.targets,
        //"disabledItems": disabledItems,
    }

    // Solve.
    simplex(A)

    spec.lastSolution = A

    // Convert result to map of recipe to recipe-rate.
    //let solution = new Map()
    for (let i = 0; i < recipeArray.length; i++) {
        let col = tax + i + 1
        let rate = A.index(A.rows - 1, col)
        if (zero.less(rate)) {
            let recipe = recipeArray[i]
            solution.set(recipe, (solution.get(recipe) || zero).add(rate))
        }
    }
    solution.set(new OutputRecipe(outputs), one)
    // And to map of surplus item to rate.
    let surplus = new Map()
    for (let i = 0; i < items.length /*- disabledItems.length*/; i++) {
        let rate = A.index(A.rows - 1, i)
        if (zero.less(rate)) {
            surplus.set(items[i], rate)
        }
    }
    if (surplus.size > 0) {
        solution.set(new SurplusRecipe(surplus), one)
    }
    return new Totals(spec, outputs, solution, surplus, maxPriorityRecipes)
    //return {"solution": solution, "surplus": surplus}
}
