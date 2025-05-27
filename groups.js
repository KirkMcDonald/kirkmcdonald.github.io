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
import { sorted } from "./sort.js"

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
    let items = new Set()
    for (let recipe of recipes) {
        if (recipe.products.length > 0) {
            groups.set(recipe, new Set([recipe]))
            for (let ing of recipe.products) {
                items.add(ing.item)
            }
        }
    }
    for (let item of items) {
        let itemRecipes = []
        for (let recipe of item.allRecipes()) {
            if (recipes.has(recipe)) {
                itemRecipes.push(recipe)
            }
        }
        if (itemRecipes.length > 1) {
            let combined = new Set()
            for (let recipe of itemRecipes) {
                for (let r of groups.get(recipe)) {
                    combined.add(r)
                }
            }
            for (let recipe of combined) {
                groups.set(recipe, combined)
            }
        }
    }
    let groupObjects = new Set()
    for (let [r, group] of groups) {
        groupObjects.add(group)
    }
    return groupObjects
}


const WITH_FLUID = "-with-fluid"
const OR_HAND = "-or-hand-crafting"
const OR_ASSEMBLING = "-or-assembling"
const OR_CHEMISTRY = "-or-chemistry"
const CHEMISTRY = "chemistry"
const PRESSING = "pressing"
const CRAFTING = "crafting"

export function getRecipeCategories(recipes) {
    let groups = new Map()
    for (let recipe of recipes) {
        let category = recipe.category;
        if (category === null) {
            category = "other"
        }
        if (category.endsWith(WITH_FLUID)) {
            // For settings, it makes more sense to group these with the non-fluid category
            category = category.replace(WITH_FLUID, "")
        }
        if (category.endsWith(OR_HAND)) {
            // For settings, it makes sense to group this with the non-hand category
            category = category.replace(OR_HAND, "")
        }
        if (category.endsWith(OR_ASSEMBLING) || category.startsWith(CRAFTING) || category.startsWith(PRESSING)) {
            // The OR_ASSEMBLING ones otherwise end up alone in their categories, so lump them in with Crafting
            // Others that start with CRAFTING are generally first encountered in regular crafting, so don't split them out
            // PRESSING are just regular crafting as well
            category = CRAFTING
        }
        if (category.endsWith(OR_CHEMISTRY) || category.startsWith(CHEMISTRY)) {
            // These recipes are first encountered as chemistry, makes sense to group them with it
            category = CHEMISTRY
        }
        if (category.endsWith("-solid")) {
            // Separating out hard-solid doesn't make much sense
            category = "solids"
        }

        if (!groups.has(category)) {
            groups.set(category, new Set())
        }
        groups.get(category).add(recipe)
    }

    // Move "recycling" and "other" to the end
    let endCategories = ["recycling", "spoilage", "other"]
    let sortedGroups = new Map();
    Array.from(groups.entries()).sort((a, b) => {
        let endA = endCategories.includes(a[0])
        let endB = endCategories.includes(b[0])
        if (endA && !endB) {
            return 1
        }

        if (!endA && endB) {
            return -1
        }

        if (endA && endB) {
            return endCategories.indexOf(a[0]) - endCategories.indexOf(b[0])
        }

        return 0;
    }).forEach(([category, recipes]) => {
        sortedGroups.set(category, new Set(recipes))
    })

    return Array.from(sortedGroups.entries());
}
