"use strict"

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
    },
    hide: function() {
        if (!this.isOpen) {
            return
        }
        this.isOpen = false
        this.node.style.display = "none"
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
