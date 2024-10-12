/*Copyright 2021 Kirk McDonald

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.*/

export class CirclePath {
    constructor(nx, ny, pairs) {
        let {x, y} = pairs[0]
        let r = null
        let sweep = null
        // (x, y): The coordinate.
        // (nx, ny): The unit vector tangent to the curve at this point.
        // r: The radius of the circle leading to this point.
        // sweep: 1 = clockwise, 0 = counter-clockwise
        // r and sweep are null for the first point, as there is no circle
        // leading to it.
        let points = [{x, y, nx, ny, r, sweep}]
        let prevX = x
        let prevY = y
        for (let {x, y} of pairs.slice(1)) {
            let dx = (x - prevX) / 2
            let dy = (y - prevY) / 2
            let t = nx*dx + ny*dy
            let r1 = -ny*dx + nx*dy
            // If deflection is less than one pixel, draw a straight line.
            if (-0.5 < r1 && r1 < 0.5) {
                let r = null
                let sweep = null
                // Still update n vector.
                let [normdx, normdy] = norm([dx, dy])
                let dot = nx*normdx + ny*normdy
                nx = 2*dot*normdx - nx
                ny = 2*dot*normdy - ny
                points.push({x, y, nx, ny, r, sweep})
                prevX = x
                prevY = y
                continue
            }
            let sweep = 1
            let npx = -ny
            let npy = nx
            if (r1 < 0) {
                sweep = 0
                r1 = -r1
                npx = -npx
                npy = -npy
            }
            let r = r1 + t**2 / r1
            let cx = npx * r
            let cy = npy * r
            // compute new tangent
            npx = (cx - 2*dx) / r
            npy = (cy - 2*dy) / r
            nx = npy
            ny = -npx
            if (sweep === 0) {
                nx = -nx
                ny = -ny
            }
            points.push({x, y, nx, ny, r, sweep})
            prevX = x
            prevY = y
        }
        this.points = points
    }

    path() {
        let {x, y} = this.points[0]
        let parts = [`M ${x},${y}`]
        for (let {x, y, r, sweep} of this.points.slice(1)) {
            if (r === null || Number.isNaN(r)) {
                parts.push(`L ${x},${y}`)
                continue
            }
            parts.push(`A ${r} ${r} 0 0 ${sweep} ${x} ${y}`)
        }
        return parts.join(" ")
    }

    offset(offset) {
        let tx = this.points[0].nx
        let ty = this.points[0].ny
        let points = []
        for (let {x, y, nx, ny} of this.points) {
            points.push({x: x + -ny*offset, y: y + nx*offset})
        }
        return new CirclePath(tx, ty, points)
    }

    transpose() {
        let points = []
        for (let {x, y, nx, ny, r, sweep} of this.points) {
            if (sweep === 0) {
                sweep = 1
            } else if (sweep === 1) {
                sweep = 0
            }
            points.push({
                x: y,
                y: x,
                nx: ny,
                ny: nx,
                r: r,
                sweep: sweep,
            })
        }
        let obj = Object.create(CirclePath.prototype)
        obj.points = points
        return obj
    }
}

function norm([x, y]) {
    let d = Math.sqrt(x**2 + y**2)
    return [x/d, y/d]
}

const MIN_RADIUS = 10

// Paths come in four kinds. All mentioned slopes are within the frame of
// reference of the initial tangent vector.
// (E.g. when t is <1, 0>, slopes have the usual meaning.)
// 1) Straight line
//      Used when slope == 0.
// 2) Double arcs
//      Used when slope of overall line is in the range [-0.75, 0.75],
//      excluding 0.
//
//      Consists of two circular arcs, one beginning at the start point and
//      terminating at the middle, the other beginning at the middle and
//      terminating at the end point.
// 3) Initial adjustment w/ double arcs
//      Used with steeper slopes than the previous, so long as the first
//      critical point is located before the line crossing through the center
//      with double the slope.
//
//      Similar to the double arcs, but with a short initial curve on either
//      end to permit the slope at the middle point to equal double the
//      overall slope (similar to a cubic Bezier curve).
// 4) Initial adjustment w/ straight line
//      Used as final fallback in all other cases.
//
//      Generally only needed when the overall slope is too steep for other
//      approaches to be feasible.

// Vector from start point to end point in reference frame of tangent vector.
function toFrame(tx, ty, x, y) {
    let dotx = tx*x + ty*y
    let doty = -ty*x + tx*y
    return [dotx, doty]
}

function fromFrame(tx, ty, x, y) {
    return toFrame(tx, -ty, x, y)
}

function frameSlope(tx, ty, x1, y1, x2, y2) {
    let dx = x2 - x1
    let dy = y2 - y1
    let [fx, fy] = toFrame(tx, ty, dx, dy)
    if (fx === 0) {
        return null
    }
    return fy/fx
}

function linePath(tx, ty, x1, y1, x2, y2) {
    return new CirclePath(tx, ty, [
        {x: x1, y: y1},
        {x: x2, y: y2},
    ])
}

function doubleArcPath(tx, ty, x1, y1, x2, y2) {
    let midx = (x1 + x2) / 2
    let midy = (y1 + y2) / 2
    return new CirclePath(tx, ty, [
        {x: x1, y: y1},
        {x: midx, y: midy},
        {x: x2, y: y2},
    ])
}

// Vector transpose functions in SVG coord space (i.e. inverted y axis).
function R(x, y) {
    return [-y, x]
}
function L(x, y) {
    return [y, -x]
}

function doubleArcAdjustPath(tx, ty, x1, y1, x2, y2, width) {
    let dx = x2 - x1
    let dy = y2 - y1
    let [fx, fy] = toFrame(tx, ty, dx, dy)
    let T
    if (fy > 0) {
        // Curving to right.
        T = R
    } else {
        // Curving to left.
        T = L
    }
    let [nx, ny] = T(tx, ty)
    // radius of first circle
    let r = width/2 + MIN_RADIUS
    // center point of first circle
    let cx = x1 + nx*r
    let cy = y1 + ny*r
    // center point of whole curve
    let p3x = (x1 + x2) / 2
    let p3y = (y1 + y2) / 2
    // desired tangent vector at center point
    let [ctx, cty] = fromFrame(tx, ty, fx/2, fy)
    // unit vector normal to tangent at center point
    // (points at center of second circle)
    let [cnx, cny] = norm(T(ctx, cty))
    // proceed from p3, r units towards center of circle 2
    let midx = p3x + cnx*r
    let midy = p3y + cny*r
    // vector pointing from center of circle 1, to that point
    let crossx = midx - cx
    let crossy = midy - cy
    // unit vector pointing from midpoint of that cross-vector, to center of
    // circle 2
    let [mx, my] = norm(T(crossx, crossy))
    // reflect cn over m; gives unit vector pointing from center of circle 1
    // to center of circle 2
    let dot = cnx*mx + cny*my
    let ox = 2*dot*mx - cnx
    let oy = 2*dot*my - cny
    // calculate points 2 and 4
    let p2x = cx + -ox*r
    let p2y = cy + -oy*r
    let p4x = x2 - (p2x - x1)
    let p4y = y2 - (p2y - y1)
    return new CirclePath(tx, ty, [
            {x: x1, y: y1},
            {x: p2x, y: p2y},
            {x: p3x, y: p3y},
            {x: p4x, y: p4y},
            {x: x2, y: y2},
    ])
}

function lineAdjustPath(tx, ty, x1, y1, x2, y2, width) {
    let dx = x2 - x1
    let dy = y2 - y1
    let [fx, fy] = toFrame(tx, ty, dx, dy)
    let T
    if (fy > 0) {
        // Curving to right.
        T = R
    } else {
        // Curving to left.
        T = L
    }
    let [nx, ny] = T(tx, ty)
    // radius of both circles
    let r = width/2 + MIN_RADIUS
    // center points of both circles
    let r1x = x1 + nx*r
    let r1y = y1 + ny*r
    let r2x = x2 - nx*r
    let r2y = y2 - ny*r
    // center point of whole curve
    let cx = (x1 + x2) / 2
    let cy = (y1 + y2) / 2
    // distance between circle center and curve center
    let d = Math.sqrt((cx - r1x)**2 + (cy - r1y)**2)
    // unit vector from circle center to curve center
    let ax = (cx - r1x) / d
    let ay = (cy - r1y) / d
    // normal pointing towards inflection point
    let [bx, by] = T(-ax, -ay)
    // A wee spot o' trig.
    let d1 = r**2/d
    let h = r**2 - Math.sqrt(r**2 - r**4/d**2)
    let px = ax*d1 + bx*h
    let py = ay*d1 + by*h

    return new CirclePath([
            {x: x1, y: y1},
            {x: r1x + px, y: r1y + py},
            {x: r2x - px, y: r2y - py},
            {x: x2, y: y2},
    ])
}

export function makeCurve(tx, ty, x1, y1, x2, y2, width) {
    let dx = x2 - x1
    let dy = y2 - y1
    let [fx, fy] = toFrame(tx, ty, dx, dy)
    if (fy === 0) {
        return linePath(tx, ty, x1, y1, x2, y2)
    }
    let slope = fy/fx
    if (-0.75 <= slope && slope <= 0.75) {
        return doubleArcPath(tx, ty, x1, y1, x2, y2)
    }
    return doubleArcAdjustPath(tx, ty, x1, y1, x2, y2, width)
}
