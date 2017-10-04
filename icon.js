"use strict"

var PX_WIDTH = 32
var PX_HEIGHT = 32

function Sprite(name, col, row) {
    this.name = name
    this.icon_col = col
    this.icon_row = row
}

function getImage(obj) {
    var im = blankImage()
    im.classList.add("icon")
    var x = -obj.icon_col * PX_WIDTH
    var y = -obj.icon_row * PX_HEIGHT
    im.style.setProperty("background-position", x + "px " + y + "px")
    im.title = obj.name
    return im
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
    sprites = {}
    for (var name in data.sprites.extra) {
        var d = data.sprites.extra[name]
        sprites[name] = new Sprite(d.name, d.icon_col, d.icon_row)
    }
}
