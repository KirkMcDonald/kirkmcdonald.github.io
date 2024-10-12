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

function neighboringRecipes(recipes, recipe, invert) {
    let result = new Set()
    let itemSet
    if (invert) {
        itemSet = recipe.products
    } else {
        itemSet = recipe.ingredients
    }
    for (let ing of itemSet) {
        let recipeSet
        if (invert) {
            recipeSet = ing.item.uses
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

function visit(recipes, recipe, seen, invert) {
    if (seen.has(recipe)) {
        return []
    }
    seen.add(recipe)
    let neighbors = neighboringRecipes(recipes, recipe, invert)
    let result = []
    for (let neighbor of neighbors) {
        let x = visit(recipes, neighbor, seen, invert)
        result.push(...x)
    }
    result.push(recipe)
    return result
}

export function getCycleRecipes(recipes) {
    let seen = new Set()
    let L = []
    for (let recipe of recipes) {
        let x = visit(recipes, recipe, seen, false)
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
        let component = visit(recipes, root, seen, true)
        if (component.length > 1) {
            for (let recipe of component) {
                result.add(recipe)
            }
        }
        //components.push(component)
    }
    return result
}
