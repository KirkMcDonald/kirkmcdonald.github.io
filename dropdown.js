/*Copyright 2019-2021 Kirk McDonald

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.*/

let dropdownLocal = d3.local()

function toggleDropdown() {
    let {dropdownNode, onOpen, onClose} = dropdownLocal.get(this)
    let dropdown = d3.select(dropdownNode)
    let classes = dropdownNode.classList
    if (classes.contains("open")) {
        classes.remove("open")
        if (onClose) {
            onClose(dropdown)
        }
    } else {
        let selected = dropdown.select("input:checked + label")
        dropdown.select(".spacer")
            .style("width", selected.style("width"))
            .style("height", selected.style("height"))
        classes.add("open")
        if (onOpen) {
            onOpen(dropdown)
        }
    }
}

// Appends a dropdown to the selection, and returns a selection over the div
// for the content of the dropdown.
export function makeDropdown(selector, onOpen, onClose) {
    let dropdown = selector.append("div")
        .classed("dropdownWrapper", true)
        .each(function() {
            let dropdownNode = this
            dropdownLocal.set(this, {dropdownNode, onOpen, onClose})
        })
    dropdown.append("div")
        .classed("clicker", true)
        .on("click", toggleDropdown)
    let dropdownInner = dropdown.append("div")
        .classed("dropdown", true)
        .on("click", toggleDropdown)
    dropdown.append("div")
        .classed("spacer", true)
    return dropdownInner
}

let inputId = 0
let labelFor = 0

// Appends a dropdown input to the selection.
//
// Args:
//   name: Should be unique to the dropdown.
//   checked: Should be true when a given input is the selected one.
//   callback: Called when the selected item is changed.
//
// Returns:
//   Selection with the input's label.
export function addInputs(selector, name, checked, callback) {
    selector.append("input")
        .on("change", function(event, d) {
            toggleDropdown.call(this)
            callback.call(this, d)
        })
        .attr("id", () => "input-" + inputId++)
        .attr("name", name)
        .attr("type", "radio")
        .property("checked", checked)
    let label = selector.append("label")
        .attr("for", () => "input-" + labelFor++)
    return label
}

// Wrapper around makeDropdown/addInputs to create an input for each item in
// data.
export function dropdown(selector, data, name, checked, callback) {
    let dd = makeDropdown(selector)
        .selectAll("div")
        .data(data)
        .join("div")
    return addInputs(dd, name, checked, callback)
}
