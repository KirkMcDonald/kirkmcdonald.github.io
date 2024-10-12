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
import { spec } from "./factory.js"
import { Rational } from "./rational.js"

class Resource {
    constructor(recipe, weight) {
        this.level = null
        this.recipe = recipe
        this.weight = weight
        let self = this
        this.div = d3.create("div")
        this.div.classed("resource", true)
            //.attr("draggable", "true")
            .on("dragstart", function(event, d) {
                self.level.list.div.classed("dragging", true)
                self.level.list.dragItem = self
            })
            .on("dragend", function(event, d) {
                self.level.list.div.classed("dragging", false)
            })
        this.div.append(() => self.recipe.icon.make(48))
        this.div.append("input")
            .attr("type", "text")
            .attr("size", 4)
            .attr("value", this.weight.toString())
            .on("change", function(event, d) {
                self.weight = Rational.from_string(this.value)
                self.level.insertSorted(self)
                spec.updateSolution()
            })
    }
    // Removes this Resource from its current PriorityLevel. If the level is
    // left empty as a rusult, it is removed. The Resource is then free to be
    // inserted into a different level.
    remove() {
        if (this.level === null) {
            return
        }
        for (let i = 0; i < this.level.resources.length; i++) {
            let r = this.level.resources[i]
            if (r === this) {
                this.level.resources.splice(i, 1)
                break
            }
        }
        this.div.remove()
        if (this.level.isEmpty()) {
            this.level.remove()
        }
        this.level = null
    }
}

class PriorityLevel {
    constructor(list) {
        this.resources = []
        this.middle = null
        this.list = list
        this.div = d3.create("div")
            .datum(this)
            .classed("resource-tier", true)
        let self = this
        list._dropTargetBoilerplate(this.div, function(event, d) {
            if (list.dragItem.level !== self) {
                self.insertSorted(list.dragItem)
            }
        })
    }
    [Symbol.iterator]() {
        return this.resources[Symbol.iterator]()
    }
    equalMap(m) {
        if (m.size !== this.resources.length) {
            return false
        }
        for (let {recipe, weight} of this) {
            if (!m.has(recipe) || !m.get(recipe).equal(weight)) {
                return false
            }
        }
        return true
    }
    has(resource) {
        return resource.level === this
    }
    // Removes this level (and its 'middle' divider) from the PriorityList.
    // It is an error to call this if the level is not empty.
    remove() {
        if (this.resources.length !== 0) {
            throw new Error("cannot remove non-empty PriorityLevel")
        }
        if (this.middle) {
            this.middle.remove()
            this.middle = null
        }
        this.div.remove()
        this.list.removeEmptyLevels()
    }
    isEmpty() {
        return this.resources.length === 0
    }
    // Moves the given resource to this level. Removes it from its old level.
    // If the old level is left empty as a result, it will be removed.
    //
    // If the resource is already in this level, it will be re-inserted in
    // sorted order.
    insertSorted(resource) {
        if (resource.level === this && this.resources.length === 1) {
            // If it's the only resource on this level, then no re-sorting is
            // required.
            return
        } else if (resource.level !== null) {
            resource.remove()
        }
        resource.level = this
        for (let i = 0; i < this.resources.length; i++) {
            let r = this.resources[i]
            if (r.weight.less(resource.weight)) {
                this.resources.splice(i, 0, resource)
                this.div.node().insertBefore(resource.div.node(), r.div.node())
                return
            }
        }
        this.resources.push(resource)
        this.div.node().appendChild(resource.div.node())
    }
}

export class PriorityList {
    constructor() {
        this.priorities = []
        this.dragItem = null
        this.div = d3.select("#resource_settings")
        this.renderEmpty()
    }
    [Symbol.iterator]() {
        return this.priorities[Symbol.iterator]()
    }
    static getDefaultArray(recipe) {
        let a = []
        for (let [recipeKey, recipe] of recipes) {
            if (recipe.isResource()) {
                let pri = recipe.defaultPriority
                while (a.length < pri + 1) {
                    a.push(new Map())
                }
                a.set(recipe, recipe.defaultWeight)
            }
        }
        return a
    }
    static fromArray(a) {
        let p = new PriorityList()
        for (let m of a) {
            let level = p.addPriorityBefore(null)
            for (let [recipe, weight] of m) {
                p.addRecipe(recipe, weight, level)
            }
        }
        return p
    }
    applyArray(a) {
        for (let i = 0; i < a.length; i++) {
            let m = a[i]
            while (this.priorities.length < i + 1) {
                this.addPriorityBefore(null)
            }
            let level = this.priorities[i]
            for (let [recipe, weight] of m) {
                let resource = this.getResource(recipe)
                if (resource === null) {
                    this.addRecipe(recipe, weight, level)
                } else {
                    level.insertSorted(resource)
                }
            }
        }
    }
    /*makeArray() {
        let result = []
        for (let level of this) {
            let levelMap = new Map()
            for (let {recipe, weight} of level) {
                levelMap.set(recipe, weight)
            }
            result.push(levelMap)
        }
        return result
    }*/
    equalArray(a) {
        if (a.length !== this.priorities.length) {
            return false
        }
        for (let i = 0; i < a.length; i++) {
            if (!this.priorities[i].equalMap(a[i])) {
                return false
            }
        }
        return true
    }
    // Creates a new priority level immediately preceding the given one.
    // If the given priority is null, adds the new priority to the end of
    // the priority list.
    //
    // Returns the new PriorityLevel.
    addPriorityBefore(level) {
        let newLevel = new PriorityLevel(this)
        let successorNode = null
        let isFirst = null
        if (level === null) {
            this.priorities.push(newLevel)
            successorNode = this.div.node().lastChild
            isFirst = this.priorities.length === 1
        } else {
            for (let i = 0; i < this.priorities.length; i++) {
                if (this.priorities[i] === level) {
                    this.priorities.splice(i, 0, newLevel)
                    isFirst = i === 0
                    if (isFirst) {
                        successorNode = level.div.node()
                    } else {
                        successorNode = level.middle.node()
                    }
                    break
                }
            }
        }
        if (!isFirst) {
            let middle = this._makeMiddle(newLevel)
            newLevel.middle = middle
            this.div.node().insertBefore(middle.node(), successorNode)
        }
        this.div.node().insertBefore(newLevel.div.node(), successorNode)
        if (isFirst && level !== null) {
            let middle = this._makeMiddle(level)
            level.middle = middle
            this.div.node().insertBefore(middle.node(), successorNode)
        }
        return newLevel
    }
    getFirstLevel() {
        if (this.priorities.length === 0) {
            return null
        }
        return this.priorities[0]
    }
    getLastLevel() {
        if (this.priorities.length === 0) {
            return null
        }
        return this.priorities[this.priorities.length - 1]
    }
    // Moves resource from its current level to the given level.
    // If the resource's previous level is left empty as a result, it will be
    // removed.
    setPriority(resource, level) {
        level.insertSorted(resource)
    }
    addRecipe(recipe, weight, level) {
        let resource = new Resource(recipe, weight)
        level.insertSorted(resource)
    }
    getResource(recipe) {
        for (let level of this.priorities) {
            for (let resource of level.resources) {
                if (resource.recipe === recipe) {
                    return resource
                }
            }
        }
        return null
    }
    getWeight(recipe) {
        return this.getResource(recipe).weight
    }
    removeRecipe(recipe) {
        let resource = this.getResource(recipe)
        resource.remove()
    }
    renderEmpty() {
        let self = this
        this.div.selectAll("*").remove()
        let less = this.div.append("div")
            .classed("resource-tier bookend", true)
        this._dropTargetBoilerplate(less, function(event, d) {
            let first = self.priorities[0]
            let p = self.addPriorityBefore(first)
            self.setPriority(self.dragItem, p)
        })
        less.append("span")
            .text("less valuable")
        let more = this.div.append("div")
            .classed("resource-tier bookend", true)
        this._dropTargetBoilerplate(more, function(event, d) {
            let p = self.addPriorityBefore(null)
            self.setPriority(self.dragItem, p)
        })
        more.append("span")
            .text("more valuable")
    }
    removeEmptyLevels() {
        let newLevels = []
        for (let level of this) {
            if (!level.isEmpty()) {
                newLevels.push(level)
            }
        }
        if (newLevels.length > 0 && newLevels[0].middle !== null) {
            newLevels[0].middle.remove()
            newLevels[0].middle = null
        }
        this.priorities = newLevels
    }
    _dropTargetBoilerplate(s, drop) {
        let self = this
        s.on("dragover", function(event, d) {
            event.preventDefault()
        })
        s.on("dragenter", function(event, d) {
            this.classList.add("highlight")
        })
        s.on("dragleave", function(event, d) {
            if (event.target === this) {
                this.classList.remove("highlight")
            }
        })
        s.on("drop", function(event, d) {
            if (self.dragItem === null) {
                return
            }
            event.preventDefault()
            this.classList.remove("highlight")
            drop.call(this, event, d)
            self.dragItem = null
            spec.updateSolution()
        })
    }
    // Creates a divider to insert before the given priority level.
    _makeMiddle(level) {
        let self = this
        let middle = d3.create("div")
            .datum(level)
            .classed("middle", true)
        this._dropTargetBoilerplate(middle, function(event, d) {
            let p = self.addPriorityBefore(d)
            self.setPriority(self.dragItem, p)
        })
        return middle
    }
}
