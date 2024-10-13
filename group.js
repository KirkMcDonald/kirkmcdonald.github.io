/*Copyright 2015-2024 Kirk McDonald

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.*/
import { sorted } from "./sort.js"

// Sorts items into their groups and subgroups. Used chiefly by the target
// dropdown.
export function getItemGroups(items, data) {
    // {groupName: {subgroupName: [item]}}
    let itemGroupMap = new Map()
    //for (var itemName in items) {
    for (let [itemKey, item] of items) {
        let group = itemGroupMap.get(item.group)
        if (group === undefined) {
            group = new Map()
            itemGroupMap.set(item.group, group)
        }
        let subgroup = group.get(item.subgroup)
        if (subgroup === undefined) {
            subgroup = []
            group.set(item.subgroup, subgroup)
        }
        subgroup.push(item)
    }
    let itemGroups = []
    let groupNames = sorted(itemGroupMap.keys(), function(k) {
        return data.groups[k].order
    })
    for (let groupName of groupNames) {
        let subgroupNames = sorted(itemGroupMap.get(groupName).keys(), function(k) {
            return data.groups[groupName].subgroups[k]
        })
        let group = []
        itemGroups.push(group)
        for (let subgroupName of subgroupNames) {
            let items = itemGroupMap.get(groupName).get(subgroupName)
            items = sorted(items, function(item) {
                return item.order
            })
            group.push(items)
        }
    }
    return itemGroups
}
