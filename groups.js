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

function neighbors(groupMap, group) {
    let result = new Set()
    for (let recipe of group) {
        let ingredients = Array.from(recipe.getIngredients())
        // Reverse the list of ingredients here, so that it appears in the
        // "correct" order when the overall topoSort is reversed.
        ingredients.reverse()
        for (let ing of ingredients) {
            for (let subRecipe of ing.item.allRecipes()) {
                if (groupMap.has(subRecipe)) {
                    result.add(groupMap.get(subRecipe))
                }
            }
        }
    }
    result.delete(group)
    return result
}

function visit(groupMap, group, result, seen) {
    if (result.has(group) || seen.has(group)) {
        return
    }
    seen.add(group)
    for (let g of neighbors(groupMap, group)) {
        visit(groupMap, g, result, seen)
    }
    seen.delete(group)
    result.add(group)
}

export function topoSort(groups) {
    let groupMap = new Map()
    for (let group of groups) {
        for (let recipe of group) {
            groupMap.set(recipe, group)
        }
    }
    let result = new Set()
    let seen = new Set()
    for (let group of groups) {
        if (!result.has(group) && !seen.has(group)) {
            visit(groupMap, group, result, seen)
        }
    }
    result = Array.from(result)
    result.reverse()
    return result
}

export function titleCase(str) {
    if (str === null || str == undefined) {
        return "Other"
    }

    let words = capitalizeFirstLetter(str).split('-')
    return words.join(' ')
}

function capitalizeFirstLetter(str) {
    return str.charAt(0).toUpperCase() + str.slice(1)
}

export function getRecipeGroups(recipes) {
    let groups = new Map()
    for (let recipe of recipes) {
        let category = recipe.category;
        if (category === null) {
            category = "other"
        }

        if (!groups.has(category)) {
            groups.set(category, new Set())
        }
        groups.get(category).add(recipe)
    }

    // Move "recycling" and "other" to the end
    let sortedGroups = new Map();
    Array.from(groups.entries()).sort((a, b) => {
        if (['recycling', "other"].includes(a[0]) && !['recycling', "other"].includes(b[0])) {
            return 1
        }

        if (!['recycling', "other"].includes(a[0]) && ['recycling', "other"].includes(b[0])) {
            return -1
        }

        return 0;
    }).forEach(([category, recipes]) => {
        sortedGroups.set(category, new Set(recipes))
    })

    return Array.from(sortedGroups.values());
}
