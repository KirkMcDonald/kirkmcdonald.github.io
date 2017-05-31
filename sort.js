"use strict"

function sorted(collection, key) {
    if (!Array.isArray(collection)) {
        collection = Object.keys(collection)
    }
    var indexes = []
    var keyvals = []
    for (var i = 0; i < collection.length; i++) {
        indexes.push(i)
        if (key) {
            keyvals.push(key(collection[i]))
        }
    }
    if (!key) {
        keyvals = collection
    }
    indexes.sort(function(a, b) {
        var x = keyvals[a]
        var y = keyvals[b]
        if (x < y) {
            return -1
        } else if (x > y) {
            return 1
        }
        return 0
    })
    var result = []
    for (var i = 0; i < indexes.length; i++) {
        result.push(collection[indexes[i]])
    }
    return result
}
