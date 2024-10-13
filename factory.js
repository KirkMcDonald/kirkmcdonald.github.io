/*Copyright 2019-2021 Kirk McDonald

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.*/
import { Formatter } from "./align.js"
import { renderDebug } from "./debug.js"
import { displayItems } from "./display.js"
import { formatSettings } from "./fragment.js"
import { ModuleSpec } from "./module.js"
import { PriorityList } from "./priority.js"
import { Rational, zero, half, one } from "./rational.js"
import { DISABLED_RECIPE_PREFIX } from "./recipe.js"
import { solve } from "./solve.js"
import { BuildTarget } from "./target.js"
import { reapTooltips } from "./tooltip.js"
import { renderTotals } from "./visualize.js"

const DEFAULT_ITEM_KEY = "advanced-circuit"

let minerCategories = new Set(["mining-basic-solid"])

export let resourcePurities = [
    {key: "0", name: "Impure", factor: half},
    {key: "1", name: "Normal", factor: one},
    {key: "2", name: "Pure", factor: Rational.from_float(2)},
]

export let DEFAULT_PURITY = resourcePurities[1]

export let DEFAULT_BELT = "transport-belt"

class FactorySpecification {
    constructor() {
        // Game data definitions
        this.items = null
        this.recipes = null
        this.modules = null
        this.buildings = null
        this.belts = null
        this.fuel = null

        this.itemTiers = []

        this.buildTargets = []

        // Maps recipe to ModuleSpec
        this.spec = new Map()
        this.defaultModule = null
        this.defaultBeacon = [null, null]
        this.defaultBeaconCount = zero

        this.belt = null

        this.ignore = new Set()
        this.disable = new Set()

        this.priority = null
        this.defaultPriority = null

        this.format = new Formatter()

        this.lastTotals = null

        this.lastPartial = null
        this.lastTableau = null
        this.lastMetadata = null
        this.lastSolution = null

        this.debug = false
    }
    setData(items, recipes, modules, buildings, belts, fuel) {
        this.items = items
        let tierMap = new Map()
        for (let [itemKey, item] of items) {
            let tier = tierMap.get(item.tier)
            if (tier === undefined) {
                tier = []
                tierMap.set(item.tier, tier)
            }
            tier.push(item)
        }
        this.itemTiers = []
        for (let [tier, tierItems] of tierMap) {
            this.itemTiers.push(tierItems)
        }
        this.itemTiers.sort((a, b) => a[0].tier - b[0].tier)
        this.recipes = recipes
        this.modules = modules
        this.buildings = new Map()
        for (let building of buildings) {
            for (let category of building.categories) {
                let categoryList = this.buildings.get(category)
                if (categoryList === undefined) {
                    categoryList = []
                    this.buildings.set(category, categoryList)
                }
                categoryList.push(building)
            }
        }
        for (let [category, buildings] of this.buildings) {
            buildings.sort(function(a, b) {
                if (a.less(b)) {
                    return -1
                } else if (b.less(a)) {
                    return 1
                }
                return 0
            })
        }
        this.belts = belts
        this.belt = belts.get(DEFAULT_BELT)
        this.fuel = fuel
        this.defaultPriority = this.getDefaultPriorityArray()
        this.priority = null
    }
    setDefaultDisable() {
        this.disable.clear()
    }
    isDefaultDisable() {
        return this.disable.size === 0
    }
    setDisable(recipe) {
        let candidates = new Set()
        let items = new Set()
        for (let ing of recipe.products) {
            let item = ing.item
            items.add(item)
            if (!this.isItemDisabled(item) && !this.ignore.has(item)) {
                candidates.add(item)
            }
        }
        this.disable.add(recipe)
        for (let item of candidates) {
            if (this.isItemDisabled(item)) {
                let resource = this.priority.getResource(item.disableRecipe)
                // The item might already be in the priority list due to being
                // ignored. In this case, do nothing.
                if (resource === null) {
                    let level = this.priority.getLastLevel()
                    let makeNew = true
                    for (let r of level) {
                        if (r.recipe.isDisable()) {
                            makeNew = false
                            break
                        }
                    }
                    if (makeNew) {
                        level = this.priority.addPriorityBefore(null)
                    }
                    let hundred = Rational.from_float(100)
                    this.priority.addRecipe(item.disableRecipe, hundred, level)
                }
            }
        }
        // Update build targets.
        for (let target of this.buildTargets) {
            if (items.has(target.item)) {
                target.displayRecipes()
            }
        }
    }
    setEnable(recipe) {
        // Enabling this recipe could potentially remove these items'
        // disableRecipe from the priority list. The item is only removed if it
        // goes from being disabled to not disabled, and is not ignored.
        //
        // Note that enabling a recipe for an item does not inherently mean the
        // item is not considered "disabled" in this sense. For example, if the
        // enabled recipe is net-negative in its use of the item.
        let candidates = new Set()
        let items = new Set()
        for (let ing of recipe.products) {
            let item = ing.item
            items.add(item)
            if (this.isItemDisabled(item) && !this.ignore.has(item)) {
                candidates.add(item)
            }
        }
        this.disable.delete(recipe)
        for (let item of candidates) {
            if (!this.isItemDisabled(item)) {
                this.priority.removeRecipe(item.disableRecipe)
            }
        }
        // Update build targets.
        for (let target of this.buildTargets) {
            if (items.has(target.item)) {
                target.displayRecipes()
            }
        }
    }
    getDefaultPriorityArray() {
        let a = []
        for (let [recipeKey, recipe] of this.recipes) {
            if (recipe.isResource()) {
                let pri = recipe.defaultPriority
                while (a.length < pri + 1) {
                    a.push(new Map())
                }
                a[pri].set(recipe, recipe.defaultWeight)
            }
        }
        return a
    }
    setDefaultPriority() {
        this.priority = PriorityList.fromArray(this.defaultPriority)
    }
    setPriorities(tiers) {
        let a = []
        for (let tier of tiers) {
            let m = new Map()
            for (let [recipeKey, weight] of tier) {
                let recipe = this.recipes.get(recipeKey)
                if (recipe === undefined && recipeKey.startsWith(DISABLED_RECIPE_PREFIX)) {
                    let itemKey = recipeKey.slice(DISABLED_RECIPE_PREFIX.length)
                    recipe = this.items.get(itemKey).disableRecipe
                }
                m.set(recipe, weight)
            }
            a.push(m)
        }
        this.priority.applyArray(a)
    }
    isDefaultPriority() {
        return this.priority.equalArray(this.defaultPriority)
    }
    getUses(item) {
        let recipes = []
        for (let recipe of item.uses) {
            if (!this.disable.has(recipe)) {
                recipes.push(recipe)
            }
        }
        return recipes
    }
    // Returns whether the current item requires the use of its DisabledRecipe
    // as a consequence of its recipes being disabled. (It may still require it
    // as a consequence of the item being ignored, independent of this.)
    //
    // It's worth mentioning that this is insufficent to guarantee that no
    // infeasible solutions exist. Catching net-negative single recipes ought
    // to account for the most common cases, but net-negative recipe loops are
    // still possible.
    isItemDisabled(item) {
        for (let recipe of item.recipes) {
            if (!this.disable.has(recipe)) {
                if (recipe.isNetProducer(item)) {
                    return false
                }
            }
        }
        return true
    }
    getRecipes(item) {
        let recipes = []
        for (let recipe of item.recipes) {
            if (!this.disable.has(recipe)) {
                recipes.push(recipe)
            }
        }
        // The disableRecipe's purpose is to provide an item ex nihilo, in
        // cases where solutions are infeasible otherwise. This happens in two
        // cases: When enough recipes have been disabled to prevent its
        // production in any other way, and when the item is being ignored.
        if (this.isItemDisabled(item) || this.ignore.has(item)) {
            let result = [item.disableRecipe]
            // Still consider any recipes which produce both this item and any
            // other un-ignored items.
            for (let r of recipes) {
                for (let ing of r.products) {
                    if (!this.ignore.has(ing.item)) {
                        result.push(r)
                        break
                    }
                }
            }
            return result
        }
        return recipes
    }
    _getItemGraph(item, recipes) {
        for (let recipe of this.getRecipes(item)) {
            if (recipes.has(recipe)) {
                continue
            }
            recipes.add(recipe)
            for (let ing of recipe.ingredients) {
                this._getItemGraph(ing.item, recipes)
            }
        }
    }
    // Returns the set of recipes which may contribute to the production of
    // the given collection of items.
    getRecipeGraph(items) {
        let graph = new Set()
        for (let [item, rate] of items) {
            this._getItemGraph(item, graph)
        }
        return graph
    }
    isFactoryTarget(recipe) {
        for (let target of this.buildTargets) {
            if (target.recipe === recipe && target.changedBuilding) {
                return true
            }
        }
        return false
    }
    getBuilding(recipe) {
        if (recipe.category === null || recipe.category === undefined) {
            return null
        } else {
            // XXX: Need to implement minimum assembler level
            let buildings = this.buildings.get(recipe.category)
            return buildings[buildings.length - 1]
        }
    }
    initModuleSpec(recipe, building) {
        if (!this.spec.has(recipe) && building !== null && building.canBeacon()) {
            let m = new ModuleSpec(recipe)
            m.setBuilding(building, this)
            this.spec.set(recipe, m)
            return m
        }
    }
    populateModuleSpec(totals) {
        for (let [recipe, rate] of totals.rates) {
            let building = this.getBuilding(recipe)
            this.initModuleSpec(recipe, building)
        }
    }
    getModuleSpec(recipe) {
        let m = this.spec.get(recipe)
        if (m === undefined) {
            let building = this.getBuilding(recipe)
            return this.initModuleSpec(recipe, building)
        }
        return m
    }
    getProdEffect(recipe) {
        let m = this.getModuleSpec(recipe)
        if (m === undefined) {
            return one
        }
        return this.getModuleSpec(recipe).prodEffect(this)
    }
    setDefaultModule(module) {
        for (let [recipe, moduleSpec] of this.spec) {
            for (let i = 0; i < moduleSpec.modules.length; i++) {
                let m = moduleSpec.modules[i]
                if (m === this.defaultModule && (!module || module.canUse(recipe))) {
                    moduleSpec.modules[i] = module
                }
            }
        }
        this.defaultModule = module
    }
    isDefaultDefaultBeacon() {
        return this.defaultBeacon[0] === null && this.defaultBeacon[1] === null
    }
    setDefaultBeacon(module, i) {
        for (let [recipe, moduleSpec] of this.spec) {
            let m = moduleSpec.beaconModules[i]
            if (m === this.defaultBeacon[i] && (!module || module.canUse(recipe))) {
                moduleSpec.beaconModules[i] = module
            }
        }
        this.defaultBeacon[i] = module
    }
    setDefaultBeaconCount(count) {
        for (let [recipe, moduleSpec] of this.spec) {
            if (moduleSpec.beaconCount.equal(this.defaultBeaconCount)) {
                moduleSpec.beaconCount = count
            }
        }
        this.defaultBeaconCount = count
    }
    // Returns the recipe-rate at which a single building can produce a recipe.
    // Returns null for recipes that do not have a building.
    getRecipeRate(recipe) {
        let building = this.getBuilding(recipe)
        if (building === null) {
            return null
        }
        return building.getRecipeRate(this, recipe)
    }
    setMiner(recipe, miner, purity) {
        this.minerSettings.set(recipe, {miner, purity})
    }
    getCount(recipe, rate) {
        let building = this.getBuilding(recipe)
        if (building === null) {
            return zero
        }
        return building.getCount(this, recipe, rate)
    }
    getBeltCount(rate) {
        return rate.div(this.belt.rate)
    }
    getPowerUsage(recipe, rate) {
        let building = this.getBuilding(recipe)
        if (building === null) {
            return zero
        }
        let modules = this.getModuleSpec(recipe)
        let powerEffect
        if (modules) {
            powerEffect = modules.powerEffect(this)
        } else {
            powerEffect = one
        }
        let count = this.getCount(recipe, rate)
        return building.power.mul(count).mul(powerEffect)
    }
    addTarget(itemKey) {
        if (itemKey === undefined) {
            itemKey = DEFAULT_ITEM_KEY
        }
        let item = this.items.get(itemKey)
        let target = new BuildTarget(this.buildTargets.length, itemKey, item, this.itemTiers)
        this.buildTargets.push(target)
        d3.select("#targets").insert(() => target.element, "#plusButton")
        return target
    }
    removeTarget(target) {
        this.buildTargets.splice(target.index, 1)
        for (let i=target.index; i < this.buildTargets.length; i++) {
            this.buildTargets[i].index--
        }
        d3.select(target.element).remove()
    }
    toggleIgnore(item) {
        if (this.ignore.has(item)) {
            this.ignore.delete(item)
            if (!this.isItemDisabled(item)) {
                this.priority.removeRecipe(item.disableRecipe)
            }
        } else {
            this.ignore.add(item)
            if (!this.isItemDisabled(item)) {
                let level = this.priority.getFirstLevel()
                let makeNew = true
                for (let r of level) {
                    if (r.recipe.isDisable()) {
                        makeNew = false
                        break
                    }
                }
                if (makeNew) {
                    level = this.priority.addPriorityBefore(level)
                }
                let hundred = Rational.from_float(100)
                this.priority.addRecipe(item.disableRecipe, hundred, level)
            }
        }
    }
    solve() {
        let outputs = []
        for (let target of this.buildTargets) {
            let item = target.item
            let rate = target.getRate()
            let recipe
            if (target.changedBuilding) {
                recipe = target.recipe
            } else {
                recipe = null
            }
            outputs.push([item, rate, recipe])
        }
        // JS isn't good at using tuples as Map keys/Set items, so just do this
        // quadratically. It's fine.
        let dedupedOutputs = []
        outer: for (let [origItem, origRate, origRecipe] of outputs) {
            for (let i = 0; i < dedupedOutputs.length; i++) {
                let {item, rate, recipe} = dedupedOutputs[i]
                if (recipe === origRecipe && item === origItem) {
                    rate = rate.add(origRate)
                    dedupedOutputs[i] = {item, rate, recipe}
                    continue outer
                }
            }
            dedupedOutputs.push({
                item: origItem,
                rate: origRate,
                recipe: origRecipe,
            })
        }
        let totals = solve(this, dedupedOutputs)
        return totals
    }
    setHash() {
        window.location.hash = "#" + formatSettings()
    }
    // The top-level calculation function. Called whenever the solution
    // requires recalculation.
    updateSolution() {
        this.lastTotals = this.solve()
        this.populateModuleSpec(this.lastTotals)
        this.display()
    }
    // Re-renders the current solution, without re-computing it.
    //
    // This is useful for when settings can be applied without altering the
    // solution. In general, if something would alter recipe-rate ratios, then
    // it requires a new solution. If it only alters building counts (e.g.
    // from changing the speed of a building), then we need merely re-display
    // the existing solution.
    display() {
        // Update build target text boxes, if needed.
        for (let target of this.buildTargets) {
            target.getRate()
        }
        displayItems(this, this.lastTotals)
        renderTotals(this.lastTotals, this.ignore)
        reapTooltips()
        this.setHash()

        if (this.debug) {
            renderDebug()
        }
    }
}

export let spec = new FactorySpecification()
window.spec = spec
