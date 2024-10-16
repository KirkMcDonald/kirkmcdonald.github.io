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

function getFuelConsumers(spec, recipes) {
    let consumers = []
    for (let recipe of recipes) {
        let building = spec.getBuilding(recipe)
        if (building !== null && building.fuel === "chemical") {
            consumers.push(recipe)
        }
    }
    return consumers
}

function neighboringRecipes(spec, recipes, recipe, invert) {
    let result = new Set()
    let itemSet
    if (invert) {
        itemSet = recipe.products
    } else {
        itemSet = recipe.getIngredients()
    }
    for (let ing of itemSet) {
        let recipeSet
        if (invert) {
            recipeSet = ing.item.uses
            if (ing.item === spec.fuel.item) {
                recipeSet = recipeSet.concat(getFuelConsumers(spec, recipes))
            }
        } else {
            recipeSet = ing.item.recipes
        }
        for (let recipe of recipeSet) {
            if (!recipes.has(recipe)) {
                continue
            }
            result.add(recipe)
        }
    }
    return result
}

function visit(spec, recipes, recipe, seen, invert) {
    if (seen.has(recipe)) {
        return []
    }
    seen.add(recipe)
    let neighbors = neighboringRecipes(spec, recipes, recipe, invert)
    let result = []
    for (let neighbor of neighbors) {
        let x = visit(spec, recipes, neighbor, seen, invert)
        result.push(...x)
    }
    result.push(recipe)
    return result
}

function isSelfCycle(component) {
    let recipe = Array.from(component)[0]
    let products = new Set()
    for (let {item} of recipe.products) {
        products.add(item)
    }
    for (let {item} of recipe.getIngredients()) {
        if (products.has(item)) {
            return true
        }
    }
    return false
}

export function getCycleRecipes(spec, recipes) {
    let seen = new Set()
    let L = []
    for (let recipe of recipes) {
        let x = visit(spec, recipes, recipe, seen, false)
        L.push(...x)
    }
    //let components = []
    let result = new Set()
    seen = new Set()
    for (let i = L.length - 1; i >= 0; i--) {
        let root = L[i]
        if (seen.has(root)) {
            continue
        }
        let component = visit(spec, recipes, root, seen, true)
        if (component.length > 1 || isSelfCycle(component)) {
            for (let recipe of component) {
                result.add(recipe)
            }
        }
        //components.push(component)
    }
    return result
}
