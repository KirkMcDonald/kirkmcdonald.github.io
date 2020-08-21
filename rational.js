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

function Rational(p, q) {
    if (q.lesser(bigInt.zero)) {
        p = bigInt.zero.minus(p)
        q = bigInt.zero.minus(q)
    }
    var gcd = bigInt.gcd(p.abs(), q)
    if (gcd.greater(bigInt.one)) {
        p = p.divide(gcd)
        q = q.divide(gcd)
    }
    this.p = p
    this.q = q
}
Rational.prototype = {
    constructor: Rational,
    toFloat: function() {
        return this.p.toJSNumber() / this.q.toJSNumber()
    },
    toString: function() {
        if (this.q.equals(bigInt.one)) {
            return this.p.toString()
        }
        return this.p.toString() + "/" + this.q.toString()
    },
    toDecimal: function(maxDigits, roundingFactor) {
        if (maxDigits == null) {
            maxDigits = 3
        }
        if (roundingFactor == null) {
            roundingFactor = new Rational(bigInt(5), bigInt(10).pow(maxDigits+1))
        }

        var sign = ""
        var x = this
        if (x.less(zero)) {
            sign = "-"
            x = zero.sub(x)
        }
        x = x.add(roundingFactor)
        var divmod = x.p.divmod(x.q)
        var integerPart = divmod.quotient.toString()
        var decimalPart = ""
        var fraction = new Rational(divmod.remainder, x.q)
        var ten = new Rational(bigInt(10), bigInt.one)
        while (maxDigits > 0 && !fraction.equal(roundingFactor)) {
            fraction = fraction.mul(ten)
            roundingFactor = roundingFactor.mul(ten)
            divmod = fraction.p.divmod(fraction.q)
            decimalPart += divmod.quotient.toString()
            fraction = new Rational(divmod.remainder, fraction.q)
            maxDigits--
        }
        if (fraction.equal(roundingFactor)) {
            while (decimalPart[decimalPart.length - 1] == "0") {
                decimalPart = decimalPart.slice(0, decimalPart.length - 1)
            }
        }
        if (decimalPart != "") {
            return sign + integerPart + "." + decimalPart
        }
        return sign + integerPart
    },
    toUpDecimal: function(maxDigits) {
        var fraction = new Rational(bigInt.one, bigInt(10).pow(maxDigits))
        var divmod = this.divmod(fraction)
        var x = this
        if (!divmod.remainder.isZero()) {
            x = x.add(fraction)
        }
        return x.toDecimal(maxDigits, zero)
    },
    toMixed: function() {
        var divmod = this.p.divmod(this.q)
        if (divmod.quotient.isZero() || divmod.remainder.isZero()) {
            return this.toString()
        }
        return divmod.quotient.toString() + " + " + divmod.remainder.toString() + "/" + this.q.toString()
    },
    isZero: function() {
        return this.p.isZero()
    },
    isOne: function() {
        return this.p.equals(1) && this.q.equals(1)
    },
    isInteger: function() {
        return this.q.equals(bigInt.one)
    },
    ceil: function() {
        var divmod = this.p.divmod(this.q)
        var result = new Rational(divmod.quotient, bigInt.one)
        if (!divmod.remainder.isZero()) {
            result = result.add(one)
        }
        return result
    },
    floor: function() {
        var divmod = this.p.divmod(this.q)
        var result = new Rational(divmod.quotient, bigInt.one)
        if (result.less(zero) && !divmod.remainder.isZero()) {
            result = result.sub(one)
        }
        return result
    },
    equal: function(other) {
        return this.p.equals(other.p) && this.q.equals(other.q)
    },
    less: function(other) {
        return this.p.times(other.q).lesser(this.q.times(other.p))
    },
    abs: function() {
        if (this.less(zero)) {
            return this.mul(minusOne)
        }
        return this
    },
    add: function(other) {
        return new Rational(
            this.p.times(other.q).plus(this.q.times(other.p)),
            this.q.times(other.q)
        )
    },
    sub: function(other) {
        if (other.isZero()) return this
        return new Rational(
            this.p.times(other.q).subtract(this.q.times(other.p)),
            this.q.times(other.q)
        )
    },
    mul: function(other) {
        if (this.isZero()) return zero
        if (other.isZero()) return zero
        if (this.isOne()) return other
        if (other.isOne()) return this
        return new Rational(
            this.p.times(other.p),
            this.q.times(other.q)
        )
    },
    div: function(other) {
        return new Rational(
            this.p.times(other.q),
            this.q.times(other.p)
        )
    },
    divmod: function(other) {
        var quotient = this.div(other)
        var div = quotient.floor()
        var mod = this.sub(other.mul(div))
        return {quotient: div, remainder: mod}
    },
    reciprocate: function () {
        return new Rational(this.q, this.p)
    },
}

function RationalFromString(s) {
    var i = s.indexOf("/")
    if (i === -1) {
        return RationalFromFloat(Number(s))
    }
    var j = s.indexOf("+")
    var q = bigInt(s.slice(i + 1))
    if (j !== -1) {
        var integer = bigInt(s.slice(0, j))
        var p = bigInt(s.slice(j + 1, i)).plus(integer.times(q))
    } else {
        var p = bigInt(s.slice(0, i))
    }
    return new Rational(p, q)
}

// Decimal approximations.
var _one_third = new Rational(bigInt(33333), bigInt(100000))
var _two_thirds = new Rational(bigInt(33333), bigInt(50000))

function RationalFromFloat(x) {
    if (Number.isInteger(x)) {
        return RationalFromFloats(x, 1)
    }
    // Sufficient precision for our data?
    var r = new Rational(bigInt(Math.round(x * 100000)), bigInt(100000))
    // Recognize 1/3 and 2/3 explicitly.
    var divmod = r.divmod(one)
    if (divmod.remainder.equal(_one_third)) {
        return divmod.quotient.add(oneThird)
    } else if (divmod.remainder.equal(_two_thirds)) {
        return divmod.quotient.add(twoThirds)
    }
    return r
}

function RationalFromFloats(p, q) {
    return new Rational(bigInt(p), bigInt(q))
}

var minusOne = new Rational(bigInt.minusOne, bigInt.one)
var zero = new Rational(bigInt.zero, bigInt.one)
var one = new Rational(bigInt.one, bigInt.one)
var half = new Rational(bigInt.one, bigInt(2))
var oneThird = new Rational(bigInt.one, bigInt(3))
var twoThirds = new Rational(bigInt(2), bigInt(3))
