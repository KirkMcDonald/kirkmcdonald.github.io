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
