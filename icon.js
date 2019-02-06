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

var PX_WIDTH = 32
var PX_HEIGHT = 32

var sheet_hash

function Sprite(name, col, row) {
    this.name = name
    this.icon_col = col
    this.icon_row = row
}

function getImage(obj, suppressTooltip, tooltipTarget) {
    var im = blankImage()
    im.classList.add("icon")
    var x = -obj.icon_col * PX_WIDTH
    var y = -obj.icon_row * PX_HEIGHT
    im.style.setProperty("background", "url(images/sprite-sheet-" + sheet_hash + ".png)")
    im.style.setProperty("background-position", x + "px " + y + "px")
    if (tooltipsEnabled && obj.renderTooltip && !suppressTooltip) {
        addTooltip(im, obj, tooltipTarget)
    } else {
        im.title = obj.name
    }
    im.alt = obj.name
    return im
}

function addTooltip(im, obj, target) {
    var node = obj.renderTooltip()
    return new Tooltip(im, node, target)
}

function blankImage() {
    var im = document.createElement("img")
    // Chrome wants the <img> element to have a src attribute, or it will
    // draw a border around it. Cram in this transparent 1x1 pixel image.
    im.src = "images/pixel.gif"
    return im
}

var sprites

function getExtraImage(name) {
    return getImage(sprites[name])
}

function getSprites(data) {
    sheet_hash = data.sprites.hash
    sprites = {}
    for (var name in data.sprites.extra) {
        var d = data.sprites.extra[name]
        sprites[name] = new Sprite(d.name, d.icon_col, d.icon_row)
    }
}
