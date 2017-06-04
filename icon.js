"use strict"

var PX_WIDTH = 32
var PX_HEIGHT = 32

function Sprite(name, row, col) {
    this.name = name
    this.row = row
    this.col = col
}
Sprite.prototype = {
    constructor: Sprite,
    getImage: function() {
        var im = blankImage()
        im.classList.add("icon")
        var x = -this.col * PX_WIDTH
        var y = -this.row * PX_HEIGHT
        im.style.setProperty("background-position", x + "px " + y + "px")
        im.title = this.name
        return im
    },
}

function getImage(name) {
    var sprite = spriteNames[name]
    if (sprite) {
        return sprite.getImage()
    }
    return null
}

function blankImage() {
    var im = document.createElement("img")
    // Chrome wants the <img> element to have a src attribute, or it will
    // draw a border around it. Cram in this transparent 1x1 pixel image.
    im.src = "images/pixel.gif"
    return im
}
var spriteNames = {}

function getSprites(data) {
    var width = data.sprites.width
    var names = data.sprites.names
    for (var i = 0; i < names.length; i++) {
        var row = Math.floor(i / width)
        var col = i % width
        var name = names[i]
        spriteNames[name] = new Sprite(name, row, col)
    }
}
