function Factory(name, speed, modules) {
    this.name = name
    this.speed = speed
    this.modules = modules
}

var CATEGORY_SPEEDS = {
    "chemistry": new Factory("chemical-plant", 1.25, 2),
    "oil-processing": new Factory("oil-refinery", 1, 2),
    "smelting": new Factory("furnace", 2, 2),
    "rocket-building": new Factory("rocket-silo", 1, 4),
    "centrifuging": new Factory("centrifuge", 0.75, 2),
}

var ASSEMBLY_1 = new Factory("assembling-machine", 0.5, 0)
var ASSEMBLY_2 = new Factory("assembling-machine-2", 0.75, 2)
var ASSEMBLY_3 = new Factory("assembling-machine-3", 1.25, 4)

var MINER = new Factory("basic-mining-drill", 1, 3)
