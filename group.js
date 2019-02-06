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

function getItemGroups(items, data) {
    // {groupName: {subgroupName: [item]}}
    var itemGroupMap = {}
    for (var itemName in items) {
        var item = items[itemName]
        var group = itemGroupMap[item.group]
        if (!group) {
            group = {}
            itemGroupMap[item.group] = group
        }
        var subgroup = group[item.subgroup]
        if (!subgroup) {
            subgroup = []
            group[item.subgroup] = subgroup
        }
        subgroup.push(item)
    }
    var itemGroups = []
    var groupNames = sorted(itemGroupMap, function(k) {
        return data.groups[k].order
    })
    for (var i = 0; i < groupNames.length; i++) {
        var groupName = groupNames[i]
        var subgroupNames = sorted(itemGroupMap[groupName], function(k) {
            return data.groups[groupName].subgroups[k]
        })
        var group = []
        itemGroups.push(group)
        for (var j = 0; j < subgroupNames.length; j++) {
            var subgroupName = subgroupNames[j]
            var items = itemGroupMap[groupName][subgroupName]
            items = sorted(items, function(item) {
                return item.order
            })
            group.push(items)
        }
    }
    return itemGroups
}
