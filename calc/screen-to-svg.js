
export function screenToSVG(svg, x, y) { // svg is the svg DOM node
  var pt = svg.createSVGPoint()
  pt.x = x
  pt.y = y
  var cursorPt = pt.matrixTransform(svg.getScreenCTM().inverse())
  return {x: Math.floor(cursorPt.x), y: Math.floor(cursorPt.y)}
}
