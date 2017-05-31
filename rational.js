"use strict"

function Rational(p, q, gcd) {
    if (q.lesser(bigInt.zero)) {
        p = bigInt.zero.minus(p)
        q = bigInt.zero.minus(q)
    }
    if (!gcd) {
        gcd = bigInt.gcd(p.abs(), q)
    }
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
    toDecimal: function(maxDigits) {
        if (!maxDigits) {
            maxDigits = 3
        }
        var roundingFactor = new Rational(bigInt(5), bigInt(10).pow(maxDigits+1))
        var x = this.add(roundingFactor)
        var divmod = x.p.divmod(x.q)
        var integerPart = divmod.quotient.toString()
        var decimalPart = ""
        var fraction = new Rational(divmod.remainder, x.q)
        var ten = new Rational(bigInt(10), bigInt.one)
        while (maxDigits > 0 && !fraction.isZero()) {
            fraction = fraction.mul(ten)
            divmod = fraction.p.divmod(fraction.q)
            decimalPart += divmod.quotient.toString()
            fraction = new Rational(divmod.remainder, fraction.q)
            maxDigits--
        }
        while (decimalPart[decimalPart.length - 1] == "0") {
            decimalPart = decimalPart.slice(0, decimalPart.length - 1)
        }
        if (decimalPart != "") {
            return integerPart + "." + decimalPart
        }
        return integerPart
    },
    isZero: function() {
        return this.p.isZero()
    },
    isInteger: function() {
        return this.q.equals(bigInt.one)
    },
    equal: function(other) {
        return this.p.equals(other.p) && this.q.equals(other.q)
    },
    less: function(other) {
        return this.p.times(other.q).lesser(this.q.times(other.p))
    },
    add: function(other) {
        return new Rational(
            this.p.times(other.q).plus(this.q.times(other.p)),
            this.q.times(other.q)
        )
    },
    sub: function(other) {
        return new Rational(
            this.p.times(other.q).subtract(this.q.times(other.p)),
            this.q.times(other.q)
        )
    },
    mul: function(other) {
        return new Rational(
            this.p.times(other.p),
            this.q.times(other.q),
            bigInt.gcd(this.p, other.q).times(bigInt.gcd(this.q, other.p))
        )
    },
    div: function(other) {
        return new Rational(
            this.p.times(other.q),
            this.q.times(other.p),
            bigInt.gcd(this.p, other.p).times(bigInt.gcd(this.q, other.q))
        )
    },
}

function RationalFromString(s) {
    var i = s.indexOf("/")
    if (i === -1) {
        return RationalFromFloat(Number(s))
    }
    var p = Number(s.slice(0, i))
    var q = Number(s.slice(i + 1))
    return RationalFromFloats(p, q)
}

function RationalFromFloat(x) {
    if (Number.isInteger(x)) {
        return RationalFromFloats(x, 1)
    }
    // Sufficient precision for our data?
    return new Rational(bigInt(Math.round(x * 10000)), bigInt(10000))
}

function RationalFromFloats(p, q) {
    return new Rational(bigInt(p), bigInt(q))
}

var zero = new Rational(bigInt.zero, bigInt.one)
var one = new Rational(bigInt.one, bigInt.one)
var half = new Rational(bigInt.one, bigInt(2))
