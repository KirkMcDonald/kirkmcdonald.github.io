/*Copyright 2019 Kirk McDonald

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.*/
import { Rational, one } from "./rational.js"

export const DEFAULT_RATE = "m"
export const DEFAULT_RATE_PRECISION = 3
export const DEFAULT_COUNT_PRECISION = 1
export const DEFAULT_FORMAT = "decimal"

let seconds = one
let minutes = Rational.from_float(60)
let hours = Rational.from_float(3600)

let displayRates = new Map([
    ["s", seconds],
    ["m", minutes],
    ["h", hours],
])

export let longRateNames = new Map([
    ["s", "second"],
    ["m", "minute"],
    ["h", "hour"],
])

export class Formatter {
    constructor() {
        this.setDisplayRate(DEFAULT_RATE)
        this.displayFormat = "decimal"
        this.ratePrecision = DEFAULT_RATE_PRECISION
        this.countPrecision = DEFAULT_COUNT_PRECISION
    }
    setDisplayRate(rate) {
        this.rateName = rate
        this.longRate = longRateNames.get(rate)
        this.rateFactor = displayRates.get(rate)
    }
    align(s, prec) {
        if (this.displayFormat === "rational") {
            return s
        }
        let idx = s.indexOf(".")
        if (idx === -1) {
            idx = s.length
        }
        let toAdd = prec - s.length + idx
        if (prec > 0) {
            toAdd += 1
        }
        while (toAdd > 0) {
            s += "\u00A0"
            toAdd--
        }
        return s
    }
    rate(rate) {
        rate = rate.mul(this.rateFactor)
        if (this.displayFormat === "rational") {
            return rate.toMixed()
        } else {
            return rate.toDecimal(this.ratePrecision)
        }
    }
    alignRate(rate) {
        return this.align(this.rate(rate), this.ratePrecision)
    }
    count(count) {
        if (this.displayFormat === "rational") {
            return count.toMixed()
        } else {
            return count.toUpDecimal(this.countPrecision)
        }
    }
    alignCount(count) {
        return this.align(this.count(count), this.countPrecision)
    }
}
