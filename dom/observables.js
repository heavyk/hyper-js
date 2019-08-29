
// common obv patterns

// append px to the end of a string
//   this shouldn't be used any more because hh automatically adds 'px' on to all
//   numeric attributes (cept for opacity)
export var _px = (v) => typeof v === 'string' && ~v.indexOf('px') ? v : v + 'px'
export var px = (obv) => transform(obv, _px)

// log a value to the console
export var obv_log = (obv, name = obv._obv, level = 'log') => {
  return obv((v) => console[level](name+':', v))
}

export var obv_debug = (obv, ns = '') => {
  let log = require('debug')(ns)
  return obv((v) => log(name+':', v))
}
