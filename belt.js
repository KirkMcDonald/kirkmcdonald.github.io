/*Copyright 2019-2021 Kirk McDonald

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.*/
import { Icon } from "./icon.js"
import { Rational } from "./rational.js"

class Belt {
    constructor(key, name, col, row, rate) {
        this.key = key
        this.name = name
        this.rate = rate
        this.icon_col = col
        this.icon_row = row
        this.icon = new Icon(this)
    }
    renderTooltip() {
        let self = this
        let t = d3.create("div")
            .classed("frame", true)
        let header = t.append("h3")
        header.append(() => self.icon.make(32, true))
        header.append(() => new Text(self.name))
        t.append("b")
            .text(`Max throughput: `)
        t.append(() => new Text(`${spec.format.rate(this.rate)}/${spec.format.longRate}`))
        return t.node()
    }
}

export function getBelts(data) {
    let beltObjs = []
    for (let beltInfo of data.belts) {
        // Belt speed is given in tiles/tick, which we can convert to
        // items/second as follows:
        //       tiles      ticks              32 pixels/tile
        // speed ----- * 60 ------ * 2 lanes * --------------
        //       tick       second             8 pixels/item
        let baseSpeed = Rational.from_float_approximate(beltInfo.speed)
        let speed = baseSpeed.mul(Rational.from_float(480))
        beltObjs.push(new Belt(
            beltInfo.key,
            beltInfo.localized_name.en,
            beltInfo.icon_col,
            beltInfo.icon_row,
            speed,
        ))
    }
    beltObjs.sort(function(a, b) {
        if (a.rate.less(b.rate)) {
            return -1
        } else if (b.rate.less(a.rate)) {
            return 1
        }
        return 0
    })
    let belts = new Map()
    for (let belt of beltObjs) {
        belts.set(belt.key, belt)
    }
    return belts
}
