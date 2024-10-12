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

let currentTooltip = null

let tooltipRegistry = new Set()

export class Tooltip {
    constructor(reference, content, target) {
        if (!target) {
            target = reference
        }
        this.reference = reference
        this.content = content
        this.target = target
        this.isOpen = false
        this.node = null
        this.popper = null
        this.addEventListeners()
    }
    show() {
        if (this.isOpen) {
            return
        }
        if (currentTooltip) {
            currentTooltip.hide()
        }
        this.isOpen = true
        if (this.node) {
            this.node.style.display = "block"
            //this.node.setAttribute("data-show", "")
            this.popper.setOptions(options => ({
                ...options,
                modifiers: [
                    ...options.modifiers,
                    { name: "eventListeners", enabled: true },
                ],
            }))
            this.popper.update()
            return
        }
        let node = this.create()
        document.getElementById("tooltip_container").appendChild(node)
        this.popper = Popper.createPopper(
            this.target,
            node,
            {
                placement: "right",
                modifiers: [
                    {
                        name: "offset",
                        options: {
                            offset: [0, 20],
                        },
                    },
                ],
            },
        )
        this.node = node
        tooltipRegistry.add(this)
        currentTooltip = this
    }
    hide() {
        if (!this.isOpen) {
            return
        }
        this.isOpen = false
        this.node.style.display = "none"
        //this.node.removeAttribute("data-show")
        this.popper.setOptions(options => ({
            ...options,
            modifiers: [
                ...options.modifiers,
                { name: "eventListeners", enabled: false },
            ],
        }))
        currentTooltip = null
    }
    create() {
        let node = document.createElement("div")
        node.classList.add("tooltip")
        node.appendChild(this.content)
        return node
    }
    remove() {
        if (this.popper) {
            this.popper.destroy()
        }
        if (this.node) {
            d3.select(this.node).remove()
        }
    }
    addEventListeners() {
        let self = this
        this.reference.addEventListener("mouseenter", function() {
            self.show()
        })
        this.reference.addEventListener("mouseleave", function() {
            self.hide()
        })
    }
}

export function reapTooltips() {
    let toReap = []
    for (let tooltip of tooltipRegistry) {
        if (!document.body.contains(tooltip.reference)) {
            toReap.push(tooltip)
        }
    }
    for (let tooltip of toReap) {
        tooltipRegistry.delete(tooltip)
        tooltip.remove()
    }
}
