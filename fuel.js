/*Copyright 2015-2024 Kirk McDonald

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
import { Rational } from "./rational.js"

let energySuffixes = ["J", "kJ", "MJ", "GJ", "TJ", "PJ"]

class Fuel {
    constructor(key, name, col, row, item, category, value) {
        this.key = key
        this.name = name
        this.item = item
        this.category = category
        this.value = value

        this.icon_col = col
        this.icon_row = row
        this.icon = new Icon(this)
    }
    valueString() {
        let x = this.value
        let thousand = Rational.from_float(1000)
        let i = 0
        while (thousand.less(x) && i < energySuffixes.length - 1) {
            x = x.div(thousand)
            i++
        }
        return x.toUpDecimal(0) + " " + energySuffixes[i]
    }
    renderTooltip() {
        let self = this
        let t = d3.create("div")
            .classed("frame", true)
        let header = t.append("h3")
        header.append(() => self.icon.make(32, true))
        header.append(() => new Text(self.name))
        t.append("b")
            .text("Energy: ")
        t.append(() => new Text(self.valueString()))
        return t.node()
    }
}

export function getFuel(data, items) {
    let fuelCategories = new Map()
    for (let d of data.fuel) {
        let item = items.get(d.item_key)
        let fuel = new Fuel(
            d.item_key,
            item.name,
            item.icon_col,
            item.icon_row,
            item,
            d.category,
            Rational.from_float_approximate(d.value)
        )
        let f = fuelCategories.get(fuel.category)
        if (f === undefined) {
            f = []
            fuelCategories.set(fuel.category, f)
        }
        f.push(fuel)
    }
    for (let [categoryKey, category] of fuelCategories) {
        category.sort(function(a, b) {
            if (a.value.less(b.value)) {
                return -1
            } else if (b.value.less(a.value)) {
                return 1
            }
            return 0
        })
    }
    let fuels = new Map()
    for (let fuel of fuelCategories.get("chemical")) {
        fuels.set(fuel.key, fuel)
    }
    return fuels
}
