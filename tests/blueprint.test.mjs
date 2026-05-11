import assert from "node:assert/strict"
import test from "node:test"
import { deflateSync, inflateSync } from "node:zlib"

import {
    applyBlueprintCounts,
    countBlueprintItems,
    decodeBlueprintString,
    getBlueprintRoot,
    importBlueprintFromDocument,
} from "../blueprint.js"

function encodeBlueprint(payload) {
    return "0" + deflateSync(JSON.stringify(payload)).toString("base64")
}

function inflate(bytes) {
    return inflateSync(Buffer.from(bytes)).toString("utf8")
}

function fakeItem(key, name = key, order = key) {
    return {
        key,
        name,
        group: "group",
        subgroup: "subgroup",
        order,
    }
}

function fakeSpec(items) {
    let targets = [
        {
            index: 0,
            itemKey: "old-target",
            removed: false,
        },
    ]
    let spec = {
        items: new Map(items.map(item => [item.key, item])),
        buildTargets: targets,
        removed: [],
        added: [],
        removeTarget(target) {
            target.removed = true
            this.removed.push(target.itemKey)
            this.buildTargets.splice(target.index, 1)
            for (let i = target.index; i < this.buildTargets.length; i++) {
                this.buildTargets[i].index = i
            }
        },
        addTarget(itemKey) {
            let target = {
                index: this.buildTargets.length,
                itemKey,
                rates: [],
                setRate(rate) {
                    this.rates.push(rate)
                },
            }
            this.buildTargets.push(target)
            this.added.push(itemKey)
            return target
        },
    }
    return spec
}

function fakeDocument(elements) {
    return {
        getElementById(id) {
            return elements[id] || null
        },
    }
}

test("decodes a valid blueprint string", () => {
    let encoded = encodeBlueprint({
        blueprint: {
            item: "blueprint",
            entities: [
                {
                    entity_number: 1,
                    name: "transport-belt",
                    position: {x: 0, y: 0},
                },
            ],
        },
    })

    let decoded = decodeBlueprintString(encoded, inflate)

    assert.equal(decoded.blueprint.item, "blueprint")
    assert.equal(decoded.blueprint.entities[0].name, "transport-belt")
})

test("rejects blueprint books for the first version", () => {
    let decoded = {
        blueprint_book: {
            item: "blueprint-book",
            blueprints: [],
        },
    }

    assert.throws(
        () => getBlueprintRoot(decoded),
        /single blueprint strings are supported/i,
    )
})

test("counts entities and tiles according to import options", () => {
    let root = {
        entities: [
            {name: "transport-belt"},
            {name: "transport-belt"},
            {name: "assembling-machine-2"},
        ],
        tiles: [
            {name: "refined-concrete"},
            {name: "refined-concrete"},
        ],
    }

    assert.deepEqual(
        Array.from(countBlueprintItems(root, {entities: true, tiles: true})),
        [
            ["transport-belt", 2],
            ["assembling-machine-2", 1],
            ["refined-concrete", 2],
        ],
    )
    assert.deepEqual(
        Array.from(countBlueprintItems(root, {entities: false, tiles: true})),
        [["refined-concrete", 2]],
    )
})

test("counts module item requests when the module option is enabled", () => {
    let root = {
        entities: [
            {
                name: "assembling-machine-3",
                items: {
                    "productivity-module-3": 4,
                    "speed-module-3": 2,
                    "iron-plate": 50,
                },
            },
            {
                name: "beacon",
                items: {
                    "speed-module-3": 2,
                },
            },
        ],
    }
    let moduleItems = new Set(["productivity-module-3", "speed-module-3"])

    assert.deepEqual(
        Array.from(countBlueprintItems(root, {
            entities: false,
            tiles: false,
            modules: true,
            moduleItems,
        })),
        [
            ["productivity-module-3", 4],
            ["speed-module-3", 4],
        ],
    )
    assert.deepEqual(
        Array.from(countBlueprintItems(root, {
            entities: false,
            tiles: false,
            modules: false,
            moduleItems,
        })),
        [],
    )
})

test("applies known blueprint counts as item-rate targets", () => {
    let spec = fakeSpec([
        fakeItem("transport-belt", "Transport belt", "b"),
        fakeItem("assembling-machine-2", "Assembling machine 2", "a"),
    ])
    let counts = new Map([
        ["transport-belt", 12],
        ["assembling-machine-2", 3],
    ])

    let result = applyBlueprintCounts(spec, counts)

    assert.deepEqual(spec.removed, ["old-target"])
    assert.deepEqual(spec.added, ["assembling-machine-2", "transport-belt"])
    assert.deepEqual(spec.buildTargets.map(target => target.rates[0]), ["3", "12"])
    assert.deepEqual(result.imported.map(entry => [entry.item.key, entry.count]), [
        ["assembling-machine-2", 3],
        ["transport-belt", 12],
    ])
    assert.deepEqual(result.unknown, [])
})

test("skips unknown names while importing known counts", () => {
    let spec = fakeSpec([
        fakeItem("transport-belt", "Transport belt", "b"),
    ])
    let counts = new Map([
        ["transport-belt", 4],
        ["mystery-entity", 9],
    ])

    let result = applyBlueprintCounts(spec, counts)

    assert.deepEqual(spec.added, ["transport-belt"])
    assert.deepEqual(spec.buildTargets.map(target => target.rates[0]), ["4"])
    assert.deepEqual(result.unknown, [["mystery-entity", 9]])
})

test("imports a blueprint from document controls and updates the solution", () => {
    let encoded = encodeBlueprint({
        blueprint: {
            item: "blueprint",
            entities: [{name: "transport-belt"}],
            tiles: [{name: "refined-concrete"}],
        },
    })
    let spec = fakeSpec([
        fakeItem("transport-belt", "Transport belt", "b"),
        fakeItem("refined-concrete", "Refined concrete", "c"),
    ])
    spec.updated = 0
    spec.updateSolution = function() {
        this.updated++
    }
    let status = {className: "", textContent: ""}
    let doc = fakeDocument({
        blueprint_string: {value: encoded},
        blueprint_include_entities: {checked: true},
        blueprint_include_tiles: {checked: false},
        blueprint_include_modules: {checked: false},
        blueprint_status: status,
    })

    let result = importBlueprintFromDocument(spec, doc, inflate)

    assert.equal(spec.updated, 1)
    assert.deepEqual(spec.added, ["transport-belt"])
    assert.deepEqual(result.imported.map(entry => [entry.item.key, entry.count]), [
        ["transport-belt", 1],
    ])
    assert.match(status.textContent, /imported 1 blueprint target/i)
})

test("imports module requests from document controls", () => {
    let encoded = encodeBlueprint({
        blueprint: {
            item: "blueprint",
            entities: [
                {
                    name: "assembling-machine-3",
                    items: {
                        "productivity-module-3": 4,
                        "iron-plate": 50,
                    },
                },
            ],
        },
    })
    let spec = fakeSpec([
        fakeItem("assembling-machine-3", "Assembling machine 3", "a"),
        fakeItem("productivity-module-3", "Productivity module 3", "b"),
        fakeItem("iron-plate", "Iron plate", "c"),
    ])
    spec.modules = new Map([
        ["productivity-module-3", {}],
    ])
    spec.updated = 0
    spec.updateSolution = function() {
        this.updated++
    }
    let status = {className: "", textContent: ""}
    let doc = fakeDocument({
        blueprint_string: {value: encoded},
        blueprint_include_entities: {checked: false},
        blueprint_include_tiles: {checked: false},
        blueprint_include_modules: {checked: true},
        blueprint_status: status,
    })

    let result = importBlueprintFromDocument(spec, doc, inflate)

    assert.equal(spec.updated, 1)
    assert.deepEqual(spec.added, ["productivity-module-3"])
    assert.deepEqual(result.imported.map(entry => [entry.item.key, entry.count]), [
        ["productivity-module-3", 4],
    ])
})
