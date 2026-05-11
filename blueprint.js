/*Copyright 2026 Kirk McDonald

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.*/

function defaultInflate(bytes) {
    if (!globalThis.pako || !globalThis.pako.inflate) {
        throw new Error("Blueprint decoding requires pako.")
    }
    return globalThis.pako.inflate(bytes, {to: "string"})
}

function decodeBase64(value) {
    if (typeof atob === "function") {
        let binary = atob(value)
        return Uint8Array.from(binary, c => c.charCodeAt(0))
    }
    if (globalThis.Buffer) {
        return Uint8Array.from(globalThis.Buffer.from(value, "base64"))
    }
    throw new Error("This browser does not support base64 decoding.")
}

function addCount(counts, name) {
    if (!name) {
        return
    }
    let count = counts.get(name)
    if (count === undefined) {
        count = 0
    }
    counts.set(name, count + 1)
}

function addAmount(counts, name, amount) {
    if (!name || !Number.isFinite(amount) || amount <= 0) {
        return
    }
    let count = counts.get(name)
    if (count === undefined) {
        count = 0
    }
    counts.set(name, count + amount)
}

function addRequestedItems(counts, entity, allowedItems) {
    if (!entity.items) {
        return
    }
    for (let [name, amount] of Object.entries(entity.items)) {
        if (allowedItems && !allowedItems.has(name)) {
            continue
        }
        addAmount(counts, name, amount)
    }
}

function itemSortKey(item) {
    return [
        item.group || "",
        item.subgroup || "",
        item.order || "",
        item.name || "",
        item.key || "",
    ].join("\0")
}

export function decodeBlueprintString(value, inflate = defaultInflate) {
    value = value.trim()
    if (value === "") {
        throw new Error("Enter a blueprint string to import.")
    }
    if (value[0] !== "0") {
        throw new Error("Blueprint strings must start with version byte 0.")
    }
    let bytes
    try {
        bytes = decodeBase64(value.slice(1))
    } catch (error) {
        throw new Error("Blueprint string is not valid base64.")
    }
    let json
    try {
        json = inflate(bytes)
    } catch (error) {
        throw new Error("Blueprint string could not be decompressed.")
    }
    try {
        return JSON.parse(json)
    } catch (error) {
        throw new Error("Blueprint string did not contain valid JSON.")
    }
}

export function getBlueprintRoot(decoded) {
    if (decoded && decoded.blueprint) {
        return decoded.blueprint
    }
    if (decoded && decoded.blueprint_book) {
        throw new Error("Only single blueprint strings are supported for now.")
    }
    throw new Error("Blueprint string did not contain a blueprint.")
}

export function countBlueprintItems(root, options) {
    let counts = new Map()
    let entities = root.entities || []
    if (options.entities) {
        for (let entity of entities) {
            addCount(counts, entity.name)
        }
    }
    if (options.modules) {
        for (let entity of entities) {
            addRequestedItems(counts, entity, options.moduleItems)
        }
    }
    if (options.tiles) {
        for (let tile of root.tiles || []) {
            addCount(counts, tile.name)
        }
    }
    return counts
}

export function applyBlueprintCounts(spec, counts) {
    let imported = []
    let unknown = []
    for (let [key, count] of counts) {
        let item = spec.items.get(key)
        if (item === undefined) {
            unknown.push([key, count])
        } else {
            imported.push({item, count})
        }
    }
    imported.sort((a, b) => itemSortKey(a.item).localeCompare(itemSortKey(b.item)))
    unknown.sort((a, b) => a[0].localeCompare(b[0]))

    if (imported.length > 0) {
        for (let target of Array.from(spec.buildTargets)) {
            spec.removeTarget(target)
        }
        for (let {item, count} of imported) {
            let target = spec.addTarget(item.key)
            target.setRate(String(count))
        }
    }

    return {imported, unknown}
}

function getRequiredElement(doc, id) {
    let elem = doc.getElementById(id)
    if (elem === null) {
        throw new Error(`Missing blueprint import control: ${id}.`)
    }
    return elem
}

function renderStatus(status, className, lines) {
    status.className = `blueprint-status ${className}`.trim()
    status.textContent = lines.join("\n")
}

function renderImportResult(status, result) {
    let lines = []
    let count = result.imported.length
    let noun = count === 1 ? "target" : "targets"
    lines.push(`Imported ${count} blueprint ${noun}.`)
    if (result.unknown.length > 0) {
        let skipped = result.unknown.map(([key, count]) => `${count} ${key}`).join(", ")
        lines.push(`Skipped unknown items: ${skipped}`)
    }
    renderStatus(status, result.unknown.length > 0 ? "blueprint-warning" : "", lines)
}

export function importBlueprintFromDocument(spec, doc = document, inflate = defaultInflate) {
    let status = getRequiredElement(doc, "blueprint_status")
    try {
        let blueprintInput = getRequiredElement(doc, "blueprint_string")
        let includeEntities = getRequiredElement(doc, "blueprint_include_entities").checked
        let includeTiles = getRequiredElement(doc, "blueprint_include_tiles").checked
        let includeModules = getRequiredElement(doc, "blueprint_include_modules").checked
        if (!includeEntities && !includeTiles && !includeModules) {
            throw new Error("Select at least one blueprint section to import.")
        }
        let decoded = decodeBlueprintString(blueprintInput.value, inflate)
        let root = getBlueprintRoot(decoded)
        let moduleItems = null
        if (spec.modules) {
            moduleItems = new Set(spec.modules.keys())
        }
        let counts = countBlueprintItems(root, {
            entities: includeEntities,
            tiles: includeTiles,
            modules: includeModules,
            moduleItems,
        })
        if (counts.size === 0) {
            throw new Error("No blueprint items found for the selected sections.")
        }
        let result = applyBlueprintCounts(spec, counts)
        if (result.imported.length === 0) {
            throw new Error("No blueprint items matched the current data set.")
        }
        spec.updateSolution()
        renderImportResult(status, result)
        return result
    } catch (error) {
        renderStatus(status, "blueprint-error", [error.message])
        return null
    }
}
