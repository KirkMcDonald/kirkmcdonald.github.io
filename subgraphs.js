/*Copyright 2015-2019 Kirk McDonald

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.*/
"use strict"

var subgraphID = 0

function Subgraph(recipes) {
    this.id = subgraphID
    subgraphID++
    this.recipes = recipes
    this.products = {}
    for (var recipeName in recipes) {
        var recipe = recipes[recipeName]
        for (var i = 0; i < recipe.products.length; i++) {
            var ing = recipe.products[i]
            this.products[ing.item.name] = ing.item
        }
    }
    this.ingredients = {}
    for (var recipeName in recipes) {
        var recipe = recipes[recipeName]
        for (var i = 0; i < recipe.ingredients.length; i++) {
            var ing = recipe.ingredients[i]
            if (ing.item.name in this.products) {
                continue
            }
            this.ingredients[ing.item.name] = ing.item
        }
    }
}
Subgraph.prototype = {
    constructor: Subgraph,
    isInteresting: function() {
        return Object.keys(this.recipes).length > 1 || Object.keys(this.products).length > 1
    }
}

function SubgraphMap(spec, recipes) {
    this.groups = {}
    this.extraUses = {}
    for (var recipeName in recipes) {
        var recipe = recipes[recipeName]
        var g = {}
        g[recipeName] = recipe
        var s = new Subgraph(g)
        this.groups[recipeName] = s
        var fuelIngredient = recipe.fuelIngredient(spec)
        for (var i = 0; i < fuelIngredient.length; i++) {
            var ing = fuelIngredient[i]
            if (ing.item.name in this.extraUses) {
                this.extraUses[ing.item.name].push(recipe)
            } else {
                this.extraUses[ing.item.name] = [recipe]
            }
            if (ing.item.name in s.products) {
                continue
            }
            s.ingredients[ing.item.name] = ing.item
        }
    }
}
SubgraphMap.prototype = {
    constructor: SubgraphMap,
    merge: function(recipes) {
        var combinedRecipes = {}
        for (var i = 0; i < recipes.length; i++) {
            var recipe = recipes[i]
            var group = this.groups[recipe.name]
            Object.assign(combinedRecipes, group.recipes)
        }
        var newGroup = new Subgraph(combinedRecipes)
        for (var recipeName in combinedRecipes) {
            this.groups[recipeName] = newGroup
        }
    },
    mergeGroups: function(groups) {
        var allRecipes = {}
        for (var i = 0; i < groups.length; i++) {
            var group = groups[i]
            for (var recipeName in group.recipes) {
                var recipe = group.recipes[recipeName]
                allRecipes[recipeName] = recipe
            }
        }
        this.merge(Object.values(allRecipes))
    },
    get: function(recipe) {
        return this.groups[recipe.name]
    },
    groupObjects: function() {
        var groups = {}
        for (var recipeName in this.groups) {
            var group = this.groups[recipeName]
            groups[group.id] = group
        }
        return groups
    },
    getInterestingGroups: function() {
        var result = []
        var groups = this.groupObjects()
        for (var id in groups) {
            var g = groups[id]
            if (g.isInteresting()) {
                result.push(g.recipes)
            }
        }
        return result
    },
    neighbors: function(group, invert) {
        var itemSet
        if (invert) {
            itemSet = group.products
        } else {
            itemSet = group.ingredients
        }
        var seen = {}
        var result = []
        for (var itemName in itemSet) {
            var item = itemSet[itemName]
            var recipeSet
            if (invert) {
                recipeSet = item.uses
                if (itemName in this.extraUses) {
                    recipeSet = recipeSet.concat(this.extraUses[itemName])
                }
            } else {
                recipeSet = item.recipes
            }
            var subgroups = {}
            for (var i = 0; i < recipeSet.length; i++) {
                var recipe = recipeSet[i]
                var group = this.get(recipe)
                subgroups[group.id] = group
            }
            for (var id in subgroups) {
                var g = subgroups[id]
                if (!(id in seen)) {
                    seen[id] = g
                    result.push(g)
                }
            }
        }
        return result
    }
}

function visit(groupmap, group, seen, invert) {
    if (group.id in seen) {
        return []
    }
    seen[group.id] = group
    var neighbors = groupmap.neighbors(group, invert)
    var result = []
    for (var i = 0; i < neighbors.length; i++) {
        var neighbor = neighbors[i]
        var x = visit(groupmap, neighbor, seen, invert)
        Array.prototype.push.apply(result, x)
    }
    result.push(group)
    return result
}

function findCycles(groupmap) {
    var seen = {}
    var L = []
    var groups = groupmap.groupObjects()
    for (var id in groups) {
        var group = groups[id]
        var x = visit(groupmap, group, seen, false)
        Array.prototype.push.apply(L, x)
    }
    var components = []
    seen = {}
    for (var i = L.length - 1; i >= 0; i--) {
        var root = L[i]
        if (root.id in seen) {
            continue
        }
        var component = visit(groupmap, root, seen, true)
        components.push(component)
    }
    return components
}

// Map an item to the items that it depends on.
function getItemDeps(item, groupmap, depmap) {
    if (item.name in depmap) {
        return depmap[item.name]
    }
    var groups = {}
    for (var i = 0; i < item.recipes.length; i++) {
        var recipe = item.recipes[i]
        var group = groupmap.get(recipe)
        groups[group.id] = group
    }
    var deps = {}
    deps[item.name] = item
    for (var id in groups) {
        var group = groups[id]
        for (var itemName in group.ingredients) {
            var subitem = group.ingredients[itemName]
            var subdeps = getItemDeps(subitem, groupmap, depmap)
            Object.assign(deps, subdeps)
        }
    }
    depmap[item.name] = deps
    return deps
}

var PENDING = {}

// Map an item to the items that depend on it.
function getItemProducts(item, groupmap, prodmap) {
    if (item.name in prodmap) {
        return prodmap[item.name]
    }
    var groups = {}
    var uses = item.uses
    if (item.name in groupmap.extraUses) {
        uses = uses.concat(groupmap.extraUses[item.name])
    }
    for (var i = 0; i < uses.length; i++) {
        var recipe = uses[i]
        var group = groupmap.get(recipe)
        groups[group.id] = group
    }
    var prods = {}
    prods[item.name] = item
    prodmap[item.name] = PENDING
    for (var id in groups) {
        var group = groups[id]
        for (var itemName in group.products) {
            var subitem = group.products[itemName]
            var subprods = getItemProducts(subitem, groupmap, prodmap)
            if (subprods !== PENDING) {
                Object.assign(prods, subprods)
            }
        }
    }
    prodmap[item.name] = prods
    return prods
}

function findGroups(spec, items, recipes) {
    var groups = new SubgraphMap(spec, recipes)
    // 1) Condense all recipes that produce a given item.
    for (var itemName in items) {
        var item = items[itemName]
        if (item.recipes.length > 1) {
            groups.merge(item.recipes)
        }
    }

    // Get the "simple" groups, which are used for display purposes.
    var simpleGroups = groups.getInterestingGroups()

    // 2) Condense all recipe cycles.
    var groupCycles = findCycles(groups)
    for (var i = 0; i < groupCycles.length; i++) {
        var cycle = groupCycles[i]
        groups.mergeGroups(cycle)
    }

    // 3) Condense any groups which have a multivariate relationship, including
    //    recipes which are between the two.
    var itemDeps = {}
    var itemProds = {}
    for (var itemName in items) {
        var item = items[itemName]
        if (!(itemName in itemDeps)) {
            getItemDeps(item, groups, itemDeps)
        }
        if (!(itemName in itemProds)) {
            getItemProducts(item, groups, itemProds)
        }
    }

    var groupObjs = groups.groupObjects()
    var itemGroups = {}
    for (var id in groupObjs) {
        var group = groupObjs[id]
        for (var prodID in group.products) {
            var item = group.products[prodID]
            itemGroups[item.name] = group
        }
    }
    var mergings = []
    for (var id in groupObjs) {
        var group = groupObjs[id]
        if (!group.isInteresting()) {
            continue
        }
        var matches = {}
        for (var itemName in group.ingredients) {
            var item = group.ingredients[itemName]
            var deps = itemDeps[item.name]
            for (var depName in deps) {
                var dep = deps[depName]
                var g = itemGroups[depName]
                if (!g.isInteresting()) {
                    continue
                }
                var pair = {"a": item, "b": dep}
                if (g.id in matches) {
                    matches[g.id].push(pair)
                } else {
                    matches[g.id] = [pair]
                }
            }
        }
        var toMerge = {}
        var performMerge = false
        for (var matchID in matches) {
            var g = groupObjs[matchID]
            var links = matches[matchID]
            outer: for (var i = 0; i < links.length - 1; i++) {
                var x = links[i]
                for (var j = i + 1; j < links.length; j++) {
                    var y = links[j]
                    if (x.a !== y.a && x.b !== y.b) {
                        toMerge[g.id] = g
                        performMerge = true
                        break outer
                    }
                }
            }
        }
        if (performMerge) {
            var groupsToMerge = {}
            groupsToMerge[group.id] = group
            var allDeps = {}
            for (var itemName in group.ingredients) {
                for (var depName in itemDeps[itemName]) {
                    var dep = itemDeps[itemName][depName]
                    allDeps[depName] = dep
                }
            }
            for (var id in toMerge) {
                var g = toMerge[id]
                groupsToMerge[g.id] = g
                for (var itemName in g.products) {
                    for (var prodName in itemProds[itemName]) {
                        if (prodName in g.products) {
                            continue
                        }
                        if (!(prodName in allDeps)) {
                            continue
                        }
                        var prodGroup = itemGroups[prodName]
                        groupsToMerge[prodGroup.id] = prodGroup
                    }
                }
            }
            mergings.push(groupsToMerge)
        }
    }
    var merge = true
    while (merge) {
        merge = false
        var result = []
        while (mergings.length > 0) {
            var current = mergings.pop()
            var newMergings = []
            for (var i = 0; i < mergings.length; i++) {
                var x = mergings[i]
                var disjoint = true
                for (var id in current) {
                    if (id in x) {
                        disjoint = false
                        break
                    }
                }
                if (disjoint) {
                    newMergings.push(x)
                } else {
                    merge = true
                    for (var id in x) {
                        var g = x[id]
                        current[id] = g
                    }
                }
            }
            result.push(current)
            mergings = newMergings
        }
        mergings = result
    }
    for (var i = 0; i < mergings.length; i++) {
        var s = Object.values(mergings[i])
        groups.mergeGroups(s)
    }

    return {"groups": groups.getInterestingGroups(), "simple": simpleGroups}
}
