/*Copyright 2015-2020 Kirk McDonald

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.*/
"use strict"

var currentTooltip = null

function Tooltip(reference, content, target) {
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
Tooltip.prototype = {
    constructor: Tooltip,
    show: function() {
        if (this.isOpen) {
            return
        }
        if (currentTooltip) {
            currentTooltip.hide()
        }
        this.isOpen = true
        if (this.node) {
            this.node.style.display = ""
            this.popper.update()
            return
        }
        var node = this.create()
        document.body.appendChild(node)
        this.popper = new Popper(
            this.target,
            node,
            {
                placement: "right",
                modifiers: {
                    offset: {
                        offset: "0, 20"
                    },
                    preventOverflow: {
                        boundariesElement: "window"
                    }
                }
            }
        )
        this.node = node
        currentTooltip = this
    },
    hide: function() {
        if (!this.isOpen) {
            return
        }
        this.isOpen = false
        this.node.style.display = "none"
        currentTooltip = null
    },
    create: function() {
        var node = document.createElement("div")
        node.classList.add("tooltip")
        node.appendChild(this.content)
        return node
    },
    addEventListeners: function() {
        var self = this
        this.reference.addEventListener("mouseenter", function() {
            self.show()
        })
        this.reference.addEventListener("mouseleave", function() {
            self.hide()
        })
    }
}
