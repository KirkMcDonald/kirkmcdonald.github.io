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
import { spec } from "./factory.js"
import { Icon } from "./icon.js"
import { Rational, zero, one } from "./rational.js"

export class Ingredient {
    constructor(item, amount) {
        this.item = item
        this.amount = amount
    }
}

class Recipe {
    constructor(key, name, col, row, category, time, ingredients, products) {
        this.key = key
        this.name = name
        this.category = category
        this.time = time
        this.ingredients = ingredients
        for (let ing of ingredients) {
            ing.item.addUse(this)
        }
        this.products = products
        for (let ing of products) {
            ing.item.addRecipe(this)
        }

        this.icon_col = col
        this.icon_row = row
        this.icon = new Icon(this, products[0].item.name)
    }
    gives(item) {
        let prodEffect = spec.getProdEffect(this).sub(one)
        for (let ing of this.products) {
            if (ing.item === item) {
                if (!prodEffect.isZero()) {
                    // The prod bonus is based on the *net* output from the
                    // recipe, not the bare yield.
                    let net = ing.amount.sub(this.uses(item))
                    if (net.less(zero)) {
                        return ing.amount
                    }
                    return ing.amount.add(net.mul(prodEffect))
                }
                return ing.amount
            }
        }
        throw new Error("recipe does not give item")
    }
    // There's an asymmetry with gives() here: It returns zero if the recipe
    // does not have this item as an ingredient.
    uses(item) {
        for (let ing of this.ingredients) {
            if (ing.item === item) {
                return ing.amount
            }
        }
        return zero
    }
    isNetProducer(item) {
        let amount = this.gives(item)
        return zero.less(amount.sub(this.uses(item)))
    }
    allModules() {
        return false
    }
    isResource() {
        return false
    }
    isReal() {
        return true
    }
    isDisable() {
        return false
    }
    renderTooltip() {
        let t = d3.create("div")
            .classed("frame recipe", true)
            .datum(this)
        renderRecipe(t)
        return t.node()
    }
}

function renderIngredient(ingSpan) {
    ingSpan.classed("ingredient", true)
        .attr("title", d => d.item.name)
        .append(d => d.item.icon.make(32))
    ingSpan.append("span")
        .classed("count", true)
        .text(d => spec.format.count(d.amount))
}

export function renderRecipe(div) {
    div.classed("recipe", true)
    div.append("span")
        .classed("title", true)
        .text(d => d.name)
    div.append("br")
    let productSpan = div.append("span")
        .selectAll("span")
        .data(d => d.products)
        .join("span")
    renderIngredient(productSpan)
    div.append("span")
        .classed("arrow", true)
        .text("\u21d0")
    let ingredientSpan = div.append("span")
        .selectAll("span")
        .data(d => d.ingredients)
        .join("span")
    renderIngredient(ingredientSpan)
}

export const DISABLED_RECIPE_PREFIX = "D-"

// Pseudo-recipe representing the ex nihilo production of items with all
// recipes disabled.
export class DisabledRecipe {
    constructor(item) {
        this.key = DISABLED_RECIPE_PREFIX + item.key
        this.name = item.name
        this.category = null
        this.ingredients = []
        this.products = [new Ingredient(item, one)]

        this.icon_col = item.icon_col
        this.icon_row = item.icon_row
        this.icon = new Icon(this)
    }
    gives(item) {
        for (let ing of this.products) {
            if (ing.item === item) {
                return ing.amount
            }
        }
        return null
    }
    isResource() {
        return false
    }
    isReal() {
        return true
    }
    isDisable() {
        return true
    }
}

function makeRecipe(data, items, d) {
    let time = Rational.from_float_approximate(d.energy_required)
    let products = []
    for (let {name, amount} of d.results) {
        let item = items.get(name)
        products.push(new Ingredient(item, Rational.from_float_approximate(amount)))
    }
    let ingredients = []
    for (let {name, amount} of d.ingredients) {
        let item = items.get(name)
        ingredients.push(new Ingredient(item, Rational.from_float_approximate(amount)))
    }
    return new Recipe(
        d.name,
        d.localized_name.en,
        d.icon_col,
        d.icon_row,
        d.category,
        time,
        ingredients,
        products
    )
}

class ResourceRecipe extends Recipe {
    constructor(item, category, priority, weight) {
        super(
            item.key,
            item.name,
            item.icon_col,
            item.icon_row,
            category,
            zero,
            [],
            [new Ingredient(item, one)]
        )
        this.defaultPriority = priority
        this.defaultWeight = weight
    }
    isResource() {
        return true
    }
}

class MiningRecipe extends Recipe {
    constructor(key, name, col, row, category, miningTime, ingredients, products) {
        if (!ingredients) {
            ingredients = []
        }
        super(key, name, col, row, category, zero, ingredients, products)
        this.miningTime = miningTime

        this.defaultPriority = 0
        this.defaultWeight = Rational.from_float(100)
    }
    isResource() {
        return true
    }
}

export function getRecipes(data, items) {
    let recipes = new Map()
    let water = items.get("water")
    recipes.set("water", new Recipe(
        "water",
        "Water",
        water.icon_col,
        water.icon_row,
        "water",
        Rational.from_floats(1, 1200),
        [],
        [new Ingredient(water, one)]
    ))
    let reactor = data.items["nuclear-reactor"]
    recipes.set("nuclear-reactor-cycle", new Recipe(
        "nuclear-reactor-cycle",
        "Nuclear reactor cycle",
        reactor.icon_col,
        reactor.icon_row,
        "nuclear",
        Rational.from_float(200),
        [new Ingredient(items.get("uranium-fuel-cell"), one)],
        [
            new Ingredient(items.get("used-up-uranium-fuel-cell"), one),
            new Ingredient(items.get("nuclear-reactor-cycle"), one),
        ]
    ))
    let rocket = data.items["rocket-silo"]
    recipes.set("rocket-launch", new Recipe(
        "rocket-launch",
        "Rocket launch",
        rocket.icon_col,
        rocket.icon_row,
        "rocket-launch",
        one,
        [
            new Ingredient(items.get("rocket-part"), Rational.from_float(100)),
            new Ingredient(items.get("satellite"), one),
        ], [new Ingredient(items.get("space-science-pack"), Rational.from_float(1000))]
    ))
    let steam = data.items["steam"]
    recipes.set("steam", new Recipe(
        "steam",
        "Steam",
        steam.icon_col,
        steam.icon_row,
        "boiler",
        Rational.from_floats(1, 60),
        [new Ingredient(items.get("water"), one)],
        [new Ingredient(items.get("steam"), one)],
    ))
    //for (let d of data.recipes) {
    for (let key in data.recipes) {
        let d = data.recipes[key]
        recipes.set(d.name, makeRecipe(data, items, d))
    }
    let hundred = Rational.from_float(100)
    //for (let d of data.resource) {
    for (let key in data.resource) {
        let d = data.resource[key]
        let category = d.category
        if (!category) {
            category = "basic-solid"
        }
        if (category !== "basic-solid") {
            continue
        }
        let props = d.minable
        let ingredients = null
        if ("required_fluid" in props) {
            ingredients = [new Ingredient(
                items.get(props.required_fluid),
                Rational.from_float_approximate(props.fluid_amount / 10),
            )]
        }
        let products = []
        for (let {name, amount} of props.results) {
            let item = items.get(name)
            products.push(new Ingredient(item, Rational.from_float_approximate(amount)))
        }
        recipes.set(d.name, new MiningRecipe(
            d.name,
            d.localized_name.en,
            d.icon_col,
            d.icon_row,
            "mining-" + category,
            Rational.from_float_approximate(props.mining_time),
            ingredients,
            products,
        ))
    }
    // Reap items both produced by no recipes and consumed by no recipes.
    let reapItems = []
    for (let [itemKey, item] of items) {
        if (item.recipes.length === 0 && item.uses.length === 0) {
            //console.log("item with no recipes or uses:", item)
            reapItems.push(itemKey)
        } else if (item.recipes.length === 0) {
            console.log("item with no recipes:", item)
            recipes.set(itemKey, new ResourceRecipe(item, null, 1, hundred))
        }
    }
    for (let key of reapItems) {
        items.delete(key)
    }
    return recipes
}
