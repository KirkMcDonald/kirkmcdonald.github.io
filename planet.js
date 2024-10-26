/*Copyright 2024 Kirk McDonald

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.*/
import { Icon } from "./icon.js"

class SurfaceProperty {
}

class Planet {
    constructor(key, name, order, col, row, resources, properties) {
        this.key = key
        this.name = name
        this.order = order
        this.resources = resources
        this.properties = properties
        this.disable = new Set()

        this.icon_col = col
        this.icon_row = row
        this.icon = new Icon(this)
    }
    allows(recipe) {
        if (recipe.isResource()) {
            return this.resources.has(recipe)
        }
        for (let condition of recipe.conditions) {
            let value = this.properties.get(condition.property)
            if (value === undefined) {
                value = defaultProperties.get(condition.property)
            }
            if (!(condition.min <= value && value <= condition.max)) {
                return false
            }
        }
        return true
    }
}

let defaultProperties

export function getPlanets(data, recipes) {
    if (!data.planets) {
        // For legacy 1.1 datasets.
        return null
    }
    defaultProperties = new Map()
    for (let {name, default_value} of data.surface_properties) {
        defaultProperties.set(name, default_value)
    }

    let planets = new Map()
    for (let d of data.planets) {
        let resources = new Set()
        for (let key of d.resources.resource.concat(d.resources.offshore)) {
            resources.add(recipes.get(key))
        }
        let properties = new Map()
        for (let key in d.surface_properties) {
            let value = d.surface_properties[key]
            properties.set(key, value)
        }
        let planet = new Planet(
            d.key,
            d.localized_name.en,
            d.order,
            d.icon_col,
            d.icon_row,
            resources,
            properties,
        )
        for (let recipe of recipes.values()) {
            if (!planet.allows(recipe)) {
                planet.disable.add(recipe)
            }
        }
        planets.set(planet.key, planet)
    }
    return planets
}
