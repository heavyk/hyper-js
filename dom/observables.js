
// common obv patterns

// append px to the end of a string
//   this shouldn't be used any more because hh automatically adds 'px' on to all
//   numeric attributes (cept for opacity)
export var _px = (v) => typeof v === 'string' && ~v.indexOf('px') ? v : v + 'px'
export var px = (obv) => transform(obv, _px)
