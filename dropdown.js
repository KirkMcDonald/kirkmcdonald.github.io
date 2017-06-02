"use strict"

var dropDownStyles = {}

function getDropdownStyle(length) {
    var styleName = "dropdown-" + length
    if (styleName in dropDownStyles) {
        return styleName
    }
    var style = document.createElement("style")
    var height = 32 * length
    var css = sprintf(".%s:hover { height: %dpx; }", styleName, height)
    style.appendChild(new Text(css))
    document.getElementsByTagName("head")[0].appendChild(style)
    dropDownStyles[styleName] = style
    return styleName
}

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
    } else {
        this.dropdown.classList.add(getDropdownStyle(this.length))
    }
    node.appendChild(this.dropdown)
    this.form = document.createElement("form")
    this.dropdown.appendChild(this.form)
}
Dropdown.prototype = {
    constructor: Dropdown,
    /* Adds an entry to the dropdown.

    Args:
        labelContent: A node to use as the visible part of the entry. Should
                      probably be a 32x32 image.
        value: The string to use as this entry's value when selected.
        checked: Whether this entry should be selected by default.
    */
    add: function(labelContent, value, checked) {
        var input = document.createElement("input")
        var id = this.name + "-" + this.length
        if (!this.style) {
            this.dropdown.classList.remove(getDropdownStyle(this.length))
        }
        this.length++
        if (!this.style) {
            this.dropdown.classList.add(getDropdownStyle(this.length))
        }
        input.id = id
        input.type = "radio"
        input.value = value
        input.checked = checked
        input.addEventListener("change", this.handler)
        this.form.appendChild(input)
        var label = document.createElement("label")
        label.htmlFor = id
        label.appendChild(labelContent)
        label.title = value
        this.form.appendChild(label)
    }
}
