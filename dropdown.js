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
        input.name = "mod"
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
