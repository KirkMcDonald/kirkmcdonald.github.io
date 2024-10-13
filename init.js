/*Copyright 2019 Kirk McDonald

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.*/
import { getBelts } from "./belt.js"
import { getBuildings } from "./building.js"
import { spec } from "./factory.js"
import { loadSettings } from "./fragment.js"
import { getFuel } from "./fuel.js"
import { getItemGroups } from "./group.js"
import { getSprites } from "./icon.js"
import { getItems } from "./item.js"
import { getModules } from "./module.js"
import { getRecipes } from "./recipe.js"
import { currentMod, MODIFICATIONS, renderDataSetOptions, renderSettings } from "./settings.js"

function reset() {
    window.location.hash = ""
}

export function changeMod() {
    let modName = currentMod()
    reset()
    loadData(modName, new Map())
}

function loadData(modName, settings) {
    let mod = MODIFICATIONS.get(modName)
    let filename = "data/" + mod.filename
    d3.json(filename, {cache: "reload"}).then(function(data) {
        let items = getItems(data)
        let recipes = getRecipes(data, items)
        let modules = getModules(data)
        let buildings = getBuildings(data)
        let belts = getBelts(data)
        let fuel = getFuel(data, items)
        getSprites(data)
        let itemGroups = getItemGroups(items, data)
        spec.setData(items, recipes, modules, buildings, belts, fuel, itemGroups)

        renderSettings(settings)

        spec.updateSolution()
    })
}

export function init() {
    let settings = loadSettings(window.location.hash)
    renderDataSetOptions(settings)
    loadData(currentMod(), settings)
}
