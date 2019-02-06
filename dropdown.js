/*Copyright 2015-2019 Kirk McDonald

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

/* Creates a new dropdown widget.

Args:
    node: The parent node of the dropdown.
    name: A unique ID for this dropdown.
    handler: An event handler to invoke when the dropdown value is changed.
    style (optional): CSS class to apply to the dropdown window, in lieu of
                      the built-in automatic length style.
*/
function Dropdown(node, name, handler, style) {
    this.name = name
    this.length = 0
    this.handler = handler
    this.dropdown = document.createElement("div")
    this.dropdown.classList.add("dropdown")
    this.style = style
    if (style) {
        this.dropdown.classList.add(style)
    }
    node.appendChild(this.dropdown)
    this.spacer = blankImage()
    this.spacer.classList.add("spacer")
    node.appendChild(this.spacer)
    this.parentNode = node
}
Dropdown.prototype = {
    constructor: Dropdown,
    /* Adds an entry to the dropdown.

    Args:
        labelContent: A node to use as the visible part of the entry. Should
                      probably be a 32x32 image.
        value: The string to use as this entry's value when selected.
        checked: Whether this entry should be selected by default.

    Returns:
        The <input> element for this entry. Its 'checked' attribute may be
        changed to select this entry.
    */
    add: function(labelContent, value, checked) {
        var input = document.createElement("input")
        var id = this.name + "-" + this.length
        this.length++
        input.id = id
        input.name = this.name
        input.type = "radio"
        input.value = value
        input.checked = checked
        input.addEventListener("change", this.handler)
        this.dropdown.appendChild(input)
        var label = document.createElement("label")
        label.htmlFor = id
        label.appendChild(labelContent)
        //label.title = value
        this.dropdown.appendChild(label)
        return input
    },
    addBreak: function() {
        this.dropdown.appendChild(document.createElement("br"))
    },
    addRule: function() {
        this.dropdown.appendChild(document.createElement("hr"))
    },
    remove: function() {
        this.parentNode.removeChild(this.dropdown)
        this.parentNode.removeChild(this.spacer)
    }
}
