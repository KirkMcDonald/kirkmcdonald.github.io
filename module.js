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
import { makeDropdown, addInputs } from "./dropdown.js"
import { Icon, sprites } from "./icon.js"
import { Rational, zero, half, one } from "./rational.js"
import { sorted } from "./sort.js"

class Module {
    constructor(key, name, col, row, category, order, productivity, speed, power, limit) {
        // Other module effects not modeled by this calculator.
        this.key = key
        this.name = name
        this.category = category
        this.order = order
        this.productivity = productivity
        this.speed = speed
        this.power = power
        this.limit = new Set(limit)

        this.icon_col = col
        this.icon_row = row
        this.icon = new Icon(this)
    }
    // This naming scheme is some older cruft, which works in the vanilla
    // dataset, but it's possible other datasets would render it unworkable.
    shortName() {
        return this.key[0] + this.key[this.key.length - 1]
    }
    canUse(recipe) {
        if (recipe.allModules()) {
            return true
        }
        //if (Object.keys(this.limit).length > 0) {
        if (this.limit.size > 0) {
            return this.limit.has(recipe.key)
        }
        return true
    }
    canBeacon() {
        return this.productivity.isZero()
    }
    hasProdEffect() {
        return !this.productivity.isZero()
    }
    /*renderTooltip() {
        var t = document.createElement("div")
        t.classList.add("frame")
        var title = document.createElement("h3")
        var im = getImage(this, true)
        title.appendChild(im)
        title.appendChild(new Text(formatName(this.name)))
        t.appendChild(title)
        var b
        var hundred = RationalFromFloat(100)
        var first = false
        if (!this.power.isZero()) {
            var power = this.power.mul(hundred)
            if (first) {
                t.appendChild(document.createElement("br"))
            } else {
                first = true
            }
            b = document.createElement("b")
            b.textContent = "Energy consumption: "
            t.appendChild(b)
            var sign = ""
            if (!this.power.less(zero)) {
                sign = "+"
            }
            t.appendChild(new Text(sign + power.toDecimal() + "%"))
        }
        if (!this.speed.isZero()) {
            var speed = this.speed.mul(hundred)
            if (first) {
                t.appendChild(document.createElement("br"))
            } else {
                first = true
            }
            b = document.createElement("b")
            b.textContent = "Speed: "
            t.appendChild(b)
            var sign = ""
            if (!this.speed.less(zero)) {
                sign = "+"
            }
            t.appendChild(new Text(sign + speed.toDecimal() + "%"))
        }
        if (!this.productivity.isZero()) {
            var productivity = this.productivity.mul(hundred)
            if (first) {
                t.appendChild(document.createElement("br"))
            } else {
                first = true
            }
            b = document.createElement("b")
            b.textContent = "Productivity: "
            t.appendChild(b)
            var sign = ""
            if (!this.productivity.less(zero)) {
                sign = "+"
            }
            t.appendChild(new Text(sign + productivity.toDecimal() + "%"))
        }
        return t
    }*/
}

export function moduleDropdown(selector, data) {
    let moduleDropdownSpan = selector.selectAll("span.module-wrapper")
        .data(data)
        .join(
            enter => {
                let s = enter.append("span")
                    .classed("module-wrapper", true)
                makeDropdown(s)
                return s
            }
        )
    let moduleDropdown = moduleDropdownSpan.selectAll("div.dropdown")
    moduleDropdown.selectAll("div.moduleRow")
        .data(d => d.inputRows)
        .join("div")
            .classed("moduleRow", true)
            .selectAll("span.input")
            .data(d => d)
            .join(
                enter => {
                    let s = enter.append("span")
                        .classed("input", true)
                    let label = addInputs(
                        s,
                        d => d.cell.name,
                        d => d.checked(),
                        d => d.choose(),
                    )
                    label.append(d => {
                        if (d.module === null) {
                            return sprites.get("slot_icon_module").icon.make(32)
                        } else {
                            return d.module.icon.make(32)
                        }
                    })
                    return s
                },
                update => {
                    update.selectAll("input").property("checked", d => d.checked())
                    return update
                },
            )
}

// ModuleSpec represents the set of modules (including beacons) configured for
// a given recipe.
export class ModuleSpec {
    constructor(recipe, spec) {
        this.recipe = recipe
        this.building = null
        this.modules = []
        this.beaconModules = [spec.defaultBeacon[0], spec.defaultBeacon[1]]
        this.beaconCount = spec.defaultBeaconCount
    }
    setBuilding(building, spec) {
        this.building = building
        if (this.modules.length > building.moduleSlots) {
            this.modules.length = building.moduleSlots
        }
        let toAdd = spec.getDefaultModule(this.recipe)
        while (this.modules.length < building.moduleSlots) {
            this.modules.push(toAdd)
        }
    }
    getModule(index) {
        return this.modules[index]
    }
    // Returns true if the module change requires a recalculation.
    setModule(index, module) {
        if (index >= this.modules.length) {
            return false
        }
        let oldModule = this.modules[index]
        let needRecalc = (oldModule && oldModule.hasProdEffect()) || (module && module.hasProdEffect())
        this.modules[index] = module
        return needRecalc
    }
    setBeaconModule(module, i) {
        this.beaconModules[i] = module
    }
    setBeaconCount(count) {
        this.beaconCount = count
    }
    speedEffect() {
        let speed = one
        for (let module of this.modules) {
            if (!module) {
                continue
            }
            speed = speed.add(module.speed)
        }
        if (this.modules.length > 0) {
            for (let module of this.beaconModules) {
                if (module === null) {
                    continue
                }
                speed = speed.add(module.speed.mul(this.beaconCount).mul(half))
            }
        }
        return speed
    }
    prodEffect(spec) {
        let prod = one
        for (let module of this.modules) {
            if (!module) {
                continue
            }
            prod = prod.add(module.productivity)
        }
        return prod
    }
    powerEffect(spec) {
        let power = one
        for (let module of this.modules) {
            if (!module) {
                continue
            }
            power = power.add(module.power)
        }
        if (this.modules.length > 0) {
            for (let module of this.beaconModules) {
                if (module === null) {
                    continue
                }
                power = power.add(module.power.mul(this.beaconCount).mul(half))
            }
        }
        let minimum = Rational.from_floats(1, 5)
        if (power.less(minimum)) {
            power = minimum
        }
        return power
    }
    /*powerUsage(spec, count) {
        let power = this.building.power
        if (this.building.fuel) {
            return {"fuel": this.building.fuel, "power": power.mul(count)}
        }
        // Default drain value.
        let drain = power.div(Rational.from_float(30))
        let divmod = count.divmod(one)
        power = power.mul(count)
        if (!divmod.remainder.isZero()) {
            let idle = one.sub(divmod.remainder)
            power = power.add(idle.mul(drain))
        }
        power = power.mul(this.powerEffect(spec))
        return {"fuel": "electric", "power": power}
    }
    recipeRate: function(spec, recipe) {
        return recipe.time.reciprocate().mul(this.factory.speed).mul(this.speedEffect(spec))
    }*/
}

export let moduleRows = null
export let shortModules = null

export function getModules(data) {
    let modules = new Map()
    for (let key of data.modules) {
        let item = data.items[key]
        let effect = item.effect
        let category = item.category
        let order = item.order
        let speed = Rational.from_float_approximate((effect.speed || {}).bonus || 0)
        let productivity = Rational.from_float_approximate((effect.productivity || {}).bonus || 0)
        let power = Rational.from_float_approximate((effect.consumption || {}).bonus || 0)
        let limit = item.limitation
        modules.set(key, new Module(
            key,
            item.localized_name.en,
            item.icon_col,
            item.icon_row,
            category,
            order,
            productivity,
            speed,
            power,
            limit
        ))
    }
    let sortedModules = sorted(modules.values(), m => m.order)
    moduleRows = [[null]]
    shortModules = new Map()
    let category = null
    for (let module of sortedModules) {
        if (module.category !== category) {
            category = module.category
            moduleRows.push([])
        }
        moduleRows[moduleRows.length - 1].push(module)
        let shortName = module.shortName()
        if (shortModules.has(shortName)) {
            // This does not occur in the vanilla data, but let's plan ahead.
            module.shortName = function() { return this.key }
            shortName = module.key
        }
        shortModules.set(shortName, module)
    }
    return modules
}
