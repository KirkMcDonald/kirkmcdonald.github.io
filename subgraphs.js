"use strict"

function intersect(a, b) {
    for (var key in a) {
        if (key in b) {
            return true
        }
    }
    return false
}

function findGroups(items, recipes) {
    var candidates = {}
    for (var itemName in items) {
        var item = items[itemName]
        if (item.recipes.length > 1) {
            candidates[itemName] = item
        }
    }
    for (var recipeName in recipes) {
        var recipe = recipes[recipeName]
        if (recipe.products.length > 1) {
            for (var i = 0; i < recipe.ingredients.length; i++) {
                var item = recipe.products[i].item
                candidates[item.name] = item
            }
        }
    }
    var itemSets = []
    for (var itemName in candidates) {
        var item = candidates[itemName]
        var group = {}
        for (var i = 0; i < item.recipes.length; i++) {
            var recipe = item.recipes[i]
            group[recipe.name] = recipe
            for (var j = 0; j < recipe.ingredients.length; j++) {
                var ing = recipe.ingredients[j]
                if (ing.item.name in candidates) {
                    for (var k = 0; k < ing.item.recipes.length; k++) {
                        var r = ing.item.recipes[k]
                        group[r.name] = r
                    }
                }
            }
        }
        if (Object.keys(group).length > 0) {
            itemSets.push(group)
        }
    }
    for (var recipeName in recipes) {
        var recipe = recipes[recipeName]
        if (recipe.products.length > 1) {
            for (var i = 0; i < recipe.ingredients.length; i++) {
                var item = recipe.ingredients[i].item
                for (var j = 0; j < item.recipes.length; j++) {
                    var subRecipe = item.recipes[j]
                    if (subRecipe === recipe) {
                        continue
                    }
                    for (var k = 0; k < subRecipe.ingredients.length; k++) {
                        var ing = subRecipe.ingredients[k]
                        if (ing.item.name in candidates) {
                            var group = {}
                            group[recipe.name] = recipe
                            group[subRecipe.name] = subRecipe
                            itemSets.push(group)
                        }
                    }
                }
            }
        }
    }
    var groups = []
    while (itemSets.length > 0) {
        var itemSet = itemSets.pop()
        var allGroups = itemSets.concat(groups)
        var i = 0
        for (; i < allGroups.length; i++) {
            var group = allGroups[i]
            if (intersect(itemSet, group)) {
                for (var name in itemSet) {
                    group[name] = itemSet[name]
                }
                break
            }
        }
        if (i == allGroups.length) {
            groups.push(itemSet)
        }
    }
    return groups
}
