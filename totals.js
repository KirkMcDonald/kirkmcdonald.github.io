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
import { zero } from "./rational.js"

function add(map, key, rate) {
    let r = map.get(key)
    if (r === undefined) {
        r = rate
    } else {
        r = r.add(rate)
    }
    map.set(key, r)
}

function set(map, key1, key2, value) {
    let submap = map.get(key1)
    if (submap === undefined) {
        submap = new Map()
        map.set(key1, submap)
    }
    submap.set(key2, value)
}

export class Totals {
    constructor(spec, products, rates, surplus) {
        this.products = products
        this.rates = rates
        this.surplus = surplus

        // Construct the rest of the solution-graph. This graph consists of
        // recipe nodes, which point to item nodes, which in turn point to
        // recipe nodes. Each item node and edge contains an item-rate. Each
        // recipe node contains a recipe-rate.
        //
        // The graph begins with resource recipes and ignored items, and ends
        // with the "output" and (possibly) "surplus" pseudo-recipes.

        // Maps item to total item-rate present in the solution.
        this.items = new Map()
        // Maps item to map of {recipe: item-rate} of recipes which produce
        // that item.
        this.producers = new Map()
        // Maps item to map of {recipe: item-rate} of recipes which consume
        // that item.
        this.consumers = new Map()
        for (let [recipe, rate] of rates) {
            for (let ing of recipe.ingredients) {
                let itemRate = rate.mul(ing.amount)
                set(this.consumers, ing.item, recipe, itemRate)
                add(this.items, ing.item, itemRate)
            }
            for (let ing of recipe.products) {
                let itemRate = rate.mul(recipe.gives(ing.item))
                set(this.producers, ing.item, recipe, itemRate)
            }
        }
        // List of {item, from, to, rate} links, apportioned proportionately
        // between multiple consumers and producers of each item.
        this.proportionate = []
        for (let [recipe, recipeRate] of rates) {
            for (let ing of recipe.ingredients) {
                let totalRate = this.items.get(ing.item)
                let rate = recipeRate.mul(ing.amount)
                let ratio = rate.div(totalRate)
                for (let subRecipe of spec.getRecipes(ing.item)) {
                    if (!rates.has(subRecipe)) {
                        continue
                    }
                    let subRate = rates.get(subRecipe).mul(subRecipe.gives(ing.item)).mul(ratio)
                    this.proportionate.push({
                        "item": ing.item,
                        "from": subRecipe,
                        "to": recipe,
                        "rate": subRate,
                    })
                }
            }
        }
    }
}
