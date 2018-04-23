"use strict"

var PX_WIDTH = 32
var PX_HEIGHT = 32

var sheet_hash

function Sprite(name, col, row) {
    this.name = name
    this.icon_col = col
    this.icon_row = row
}

function getImage(obj, suppressTooltip) {
    var im = blankImage()
    im.classList.add("icon")
    var x = -obj.icon_col * PX_WIDTH
    var y = -obj.icon_row * PX_HEIGHT
    im.style.setProperty("background", "url(images/sprite-sheet-" + sheet_hash + ".png)")
    im.style.setProperty("background-position", x + "px " + y + "px")
    if (tooltipsEnabled && obj.renderTooltip && !suppressTooltip) {
        var node = obj.renderTooltip()
        var t = new Tooltip(im, {
            placement: "right",
            title: node,
            html: true,
            offset: "0, 20",
            container: document.body,
            boundariesElement: "window"
        })
    } else {
        im.title = obj.name
    }
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
    sheet_hash = data.sprites.hash
    sprites = {}
    for (var name in data.sprites.extra) {
        var d = data.sprites.extra[name]
        sprites[name] = new Sprite(d.name, d.icon_col, d.icon_row)
    }
}
