//import {linkHorizontal} from "d3-shape";

function selfPath(d) {
  let x0 = d.source.x1
  let y0 = d.y0
  let x1 = d.source.x1
  let y1 = d.source.y1 + d.width/2 + 10
  let r1 = (y1 - y0) / 2
  let x2 = d.target.x0
  let y2 = d.target.y1 + d.width/2 + 10
  let x3 = d.target.x0
  let y3 = d.y1
  let r2 = (y3 - y2) / 2
  return `M ${x0},${y0} A ${r1} ${r1} 0 0 1 ${x1},${y1} L ${x2},${y2} A ${r2} ${r2} 0 0 1 ${x3},${y3}`
}

function backwardPath(d) {
  let x0 = d.source.x1
  let y0 = d.y0
  let x1 = d.target.x0
  let y1 = d.y1
  let dx = (x0 - x1) / 2
  let xc0 = x0 + dx
  let xc1 = x1 - dx
  return `M ${x0},${y0} C ${xc0},${y0},${xc1},${y1},${x1},${y1}`
}

function horizontalSource(d) {
  return [d.source.x1, d.y0];
}

function horizontalTarget(d) {
  return [d.target.x0, d.y1];
}

export default function() {
  let link = d3.linkHorizontal()
      .source(horizontalSource)
      .target(horizontalTarget);
  return function(d) {
    if (d.direction === "backward") {
      return backwardPath(d)
    } else if (d.direction === "self") {
      return selfPath(d)
    } else {
      return link(d)
    }
  }
}
