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
import { Icon, sprites } from "./icon.js"
import { Rational, zero, one } from "./rational.js"

export class Ingredient {
    constructor(item, amount) {
        this.item = item
        this.amount = amount
    }
}

class SurfaceCondition {
    constructor(property, min, max) {
        this.property = property
        this.min = min
        this.max = max
    }
}

class Recipe {
    constructor(key, name, order, col, row, allow_prod, category, time, ingredients, products, conditions) {
        this.key = key
        this.name = name
        this.order = order
        this.allow_productivity = allow_prod
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

        if (conditions === undefined || conditions === null) {
            conditions = []
        }
        this.conditions = conditions

        this.icon_col = col
        this.icon_row = row
        this.icon = new Icon(this, products[0].item.name)
    }
    fuelIngredient() {
        let building = spec.getBuilding(this)
        if (building === null || building.fuel === null || building.fuel !== "chemical") {
            return []
        }
        // baseRate = craft/s
        // basePower = J/s
        // perCraftEnergy = J/s / craft/s = J/craft
        // fuel.value = J/i
        // fuelAmount = J/craft / J/i = i/craft
        let baseRate = spec.getRecipeRate(this)
        let basePower = spec.getPowerUsage(this, baseRate).power
        let perCraftEnergy = basePower.div(baseRate)
        let fuelAmount = perCraftEnergy.div(spec.fuel.value)
        return [new Ingredient(spec.fuel.item, fuelAmount)]
    }
    getIngredients() {
        return this.ingredients.concat(this.fuelIngredient())
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
        for (let ing of this.getIngredients()) {
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
    isResource() {
        return false
    }
    isReal() {
        return true
    }
    isDisable() {
        return false
    }
    renderTooltip(extra) {
        let self = this
        let t = d3.create("div")
            .classed("frame recipe", true)
            .datum(this)
        let header = t.append("h3")
        header.append(() => self.icon.make(32, true))
        let name = this.name
        if (this.products.length === 1 && this.products[0].item.name === this.name && one.less(this.products[0].amount)) {
            name = this.products[0].amount.toDecimal() + " \u00d7 " + name
        }
        header.append(() => new Text("\u00A0" + name))
        if (extra) {
            t.append(() => extra)
        }
        if (this.ingredients.length === 0) {
            return t.node()
        }
        if (this.products.length > 1 || this.products[0].item.name !== this.name) {
            let productLine = t.append("div")
            productLine.append("span")
                .text("Products:")
            let product = productLine.append("span").selectAll("span")
                .data(this.products)
                .join("span")
            product.append("span")
                .text("\u00A0")
            let prodIcon = product.append("div")
                .classed("product", true)
            prodIcon.append(d => d.item.icon.make(32, true))
            prodIcon.append("span")
                .classed("count", true)
                .text(d => d.amount.toDecimal())
        }
        let time = t.append("div")
        time.append("div")
            .classed("product", true)
            .append(() => sprites.get("clock").icon.make(32, true))
        time.append("span")
            .text("\u00A0" + this.time.toDecimal())
        let ingredient = t.append("div").selectAll("div")
            .data(this.ingredients)
            .join("div")
        ingredient.append("div")
            .classed("product", true)
            .append(d => d.item.icon.make(32, true))
        ingredient.append("span")
            .text(d => `\u00A0${d.amount.toDecimal()} \u00d7 ${d.item.name}`)
        return t.node()
    }
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
    getIngredients() {
        return this.ingredients
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
    for (let {name, amount, probability} of d.results) {
        let item = items.get(name)
        let ratAmount = Rational.from_float_approximate(amount)
        if (probability !== undefined) {
            ratAmount = ratAmount.mul(Rational.from_float_approximate(probability))
        }
        products.push(new Ingredient(item, ratAmount))
    }
    let ingredients = []
    for (let {name, amount} of d.ingredients) {
        let item = items.get(name)
        if (!item) {
            return null
        }
        ingredients.push(new Ingredient(item, Rational.from_float_approximate(amount)))
    }
    let conditions = []
    if (d.surface_conditions) {
        for (let {property, min, max} of d.surface_conditions) {
            conditions.push(new SurfaceCondition(property, min, max))
        }
    }
    return new Recipe(
        d.key,
        d.localized_name.en,
        d.order,
        d.icon_col,
        d.icon_row,
        d.allow_productivity,
        d.category,
        time,
        ingredients,
        products,
        conditions,
    )
}

class ResourceRecipe extends Recipe {
    constructor(item, category, priority, weight) {
        super(
            item.key,
            item.name,
            item.order,
            item.icon_col,
            item.icon_row,
            false,
            category,
            zero,
            [],
            [new Ingredient(item, one)],
            [],
        )
        this.defaultPriority = priority
        this.defaultWeight = weight
    }
    isResource() {
        return true
    }
}

class SpoilageRecipe extends Recipe {
    constructor(from_item, to_item) {
        let key = `${from_item.key}-spoilage`
        let name = `${from_item.name} to ${to_item.name} (Spoilage)`
        super(
            key,
            name,
            null,
            to_item.icon_col,
            to_item.icon_row,
            false,
            "spoilage",
            zero,
            [new Ingredient(from_item, one)],
            [new Ingredient(to_item, one)],
            [],
        )
    }
}

class PlantRecipe extends Recipe {
    constructor(key, name, order, col, row, seed, results, conditions) {
        super(
            key,
            name,
            order,
            col,
            row,
            false,
            null,
            zero,
            [new Ingredient(seed, one)],
            //[new Ingredient(item, quantity)],
            results,
            conditions,
        )
        if (this.isResource()) {
            this.defaultPriority = 1
            this.defaultWeight = Rational.from_float(100)
        }
    }
    isResource() {
        return this.conditions.length === 0
    }
}

class MiningRecipe extends Recipe {
    constructor(key, name, order, col, row, category, miningTime, ingredients, products) {
        if (!ingredients) {
            ingredients = []
        }
        super(key, name, order, col, row, true, category, zero, ingredients, products, [])
        this.miningTime = miningTime

        this.defaultPriority = 1
        this.defaultWeight = Rational.from_float(100)
    }
    isResource() {
        return true
    }
}

// XXX: Still a hack.
class PumpjackRecipe extends Recipe {
    constructor(key, name, col, row, category, product) {
        super(
            key,
            name,
            undefined,
            col,
            row,
            false,
            category,
            zero,
            [],
            [new Ingredient(product, one)],
            [],
        )
        this.defaultPriority = 1
        this.defaultWeight = Rational.from_float(100)
    }
    isResource() {
        return true
    }
}

class OffshorePumpRecipe extends Recipe {
    //constructor(key, name, order, col, row, allow_prod, category, time, ingredients, products) {
    constructor(key, name, order, col, row, product) {
        super(key, name, order, col, row, false, "offshore-pumping", zero, [], [new Ingredient(product, one)], [])

        this.defaultPriority = 0
        this.defaultWeight = Rational.from_float(100)
    }
    isResource() {
        return true
    }
}

function getSteam(data) {
    let R = Rational.from_float
    let boilerDef
    for (let d of data.boilers) {
        if (d.key === "boiler") {
            boilerDef = d
            break
        }
    }
    let water
    let steam
    for (let fluid of data.fluids) {
        if (fluid.item_key === "water") {
            water = fluid
        } else if (fluid.item_key === "steam") {
            steam = fluid
        }
        if (water !== undefined && steam !== undefined) {
            break
        }
    }
    let power = R(boilerDef.energy_consumption)
    let tempDelta = R(boilerDef.target_temperature).sub(R(water.default_temperature))
    // heat_capacity is denominated in J/degrees C/unit.
    let waterCap = R(water.heat_capacity)
    let steamCap = R(steam.heat_capacity)
    // water/second
    let waterRate = power.div(tempDelta.mul(waterCap))
    // steam/second
    let steamRate = power.div(tempDelta.mul(steamCap))
    return [waterRate, steamRate]
}

export function getRecipes(data, items) {
    let hundred = Rational.from_float(100)
    let recipes = new Map()
    let reactor = items.get("nuclear-reactor")
    let used_cell_name = "used-up-uranium-fuel-cell"
    if (!items.has(used_cell_name)) {
        used_cell_name = "depleted-uranium-fuel-cell"
    }
    recipes.set("nuclear-reactor-cycle", new Recipe(
        "nuclear-reactor-cycle",
        "Nuclear reactor cycle",
        reactor.order,
        reactor.icon_col,
        reactor.icon_row,
        false,
        "nuclear",
        Rational.from_float(200),
        [new Ingredient(items.get("uranium-fuel-cell"), one)],
        [
            new Ingredient(items.get(used_cell_name), one),
            new Ingredient(items.get("nuclear-reactor-cycle"), one),
        ]
    ))
    if (items.has("satellite")) {
        let rocket = items.get("rocket-silo")
        recipes.set("rocket-launch", new Recipe(
            "rocket-launch",
            "Rocket launch",
            rocket.order,
            rocket.icon_col,
            rocket.icon_row,
            false,
            "rocket-launch",
            one,
            [
                new Ingredient(items.get("rocket-part"), Rational.from_float(100)),
                new Ingredient(items.get("satellite"), one),
            ], [new Ingredient(items.get("space-science-pack"), Rational.from_float(1000))]
        ))
    }
    let steam = items.get("steam")
    let [waterRate, steamRate] = getSteam(data)
    recipes.set("steam", new Recipe(
        "steam",
        "Steam",
        steam.order,
        steam.icon_col,
        steam.icon_row,
        false,
        "boiler",
        one,
        [new Ingredient(items.get("water"), waterRate)],
        [new Ingredient(items.get("steam"), steamRate)],
    ))
    for (let d of data.recipes) {
        /*if (d.key.endsWith("-recycling")) {
            continue
        }*/
        let r = makeRecipe(data, items, d)
        if (r) {
            recipes.set(d.key, r)
        }
    }
    for (let d of data.resources) {
        let category = d.category
        if (!category) {
            category = "basic-solid"
        }
        if (category === "basic-fluid") {
            // XXX: Do something about pumpjacks.
            let item = items.get(d.results[0].name)
            recipes.set(d.key, new PumpjackRecipe(
                d.key,
                d.localized_name.en,
                d.icon_col,
                d.icon_row,
                null,
                item,
            ))
            continue
        }
        let ingredients = null
        if ("required_fluid" in d) {
            ingredients = [new Ingredient(
                items.get(d.required_fluid),
                Rational.from_float_approximate(d.fluid_amount / 10),
            )]
        }
        let products = []
        for (let {name, amount, probability} of d.results) {
            let item = items.get(name)
            let ratAmount = Rational.from_float_approximate(amount)
            if (probability !== undefined) {
                ratAmount = ratAmount.mul(Rational.from_float_approximate(probability))
            }
            products.push(new Ingredient(item, ratAmount))
        }
        recipes.set(d.key, new MiningRecipe(
            d.key,
            d.localized_name.en,
            d.order,  // this may be undefined
            d.icon_col,
            d.icon_row,
            category,
            Rational.from_float_approximate(d.mining_time),
            ingredients,
            products,
        ))
    }
    let offshoreItems = new Set()
    if (data.planets) {
        for (let planet of data.planets) {
            for (let key of planet.resources.offshore) {
                offshoreItems.add(key)
            }
        }
    } else {
        offshoreItems.add("water")
    }
    for (let key of offshoreItems) {
        let item = items.get(key)
        let r = new OffshorePumpRecipe(
            key,
            item.name,
            item.order,
            item.icon_col,
            item.icon_row,
            item
        )
        if (recipes.has(key)) {
            console.log("duplicate key:", key)
        }
        recipes.set(key, r)
    }
    if (data.plants) {
        for (let plant of data.plants) {
            let results = []
            for (let {amount, name} of plant.results) {
                results.push(new Ingredient(
                    items.get(name),
                    Rational.from_float_approximate(amount),
                ))
            }
            let conditions = []
            if (plant.surface_conditions) {
                for (let {property, min, max} of plant.surface_conditions) {
                    conditions.push(new SurfaceCondition(property, min, max))
                }
            }
            let r = new PlantRecipe(
                plant.key,
                plant.localized_name.en,
                plant.order,
                plant.icon_col,
                plant.icon_row,
                items.get(plant.seed),
                results,
                conditions,
            )
            recipes.set(plant.key, r)
        }
    }
    if (data.spoilage) {
        for (let spoil of data.spoilage) {
            let from_item = items.get(spoil.from_item)
            let to_item = items.get(spoil.to_item)
            let r = new SpoilageRecipe(from_item, to_item)
            recipes.set(r.key, r)
        }
    }
    // Reap items both produced by no recipes and consumed by no recipes.
    let reapItems = []
    for (let [itemKey, item] of items) {
        if (item.recipes.length === 0 && item.uses.length === 0) {
            //console.log("item with no recipes or uses:", item)
            reapItems.push(itemKey)
        } else if (item.recipes.length === 0) {
            if (!item.key.endsWith("-barrel")) {
                console.log("item with no recipes:", item)
            }
            recipes.set(itemKey, new ResourceRecipe(item, null, 2, hundred))
        }
    }
    for (let key of reapItems) {
        items.delete(key)
    }
    return recipes
}
