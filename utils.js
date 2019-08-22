
import isObject from './lodash/isObject'

export function noop () {}

export function error (message) {
  throw new Error(message)
}

export function __debug (msg) {
  if (msg) console.log('entering the debugger. reason:\n    ' + msg)
  if (typeof DEBUG !== 'undefined') debugger
  else console.warn('continuing... (debug not enabled)')
}

// micro-optimization: http://jsperf.com/for-vs-foreach/292
export function forEach (arr, fn) {
  for (var i = 0; i < arr.length; ++i) fn.call(arr, arr[i], i)
}

export function forEachReverse (arr, fn) {
  for (var i = arr.length - 1; i >= 0; i--) fn.call(arr, arr[i], i)
}

export function callEach (arr) {
  for (var i = 0; i < arr.length; ++i) arr[i].call(arr)
}

export function obj_aliases (proto, aliases) {
  for (let k in aliases) proto[k] = proto[aliases[k]]
}

export function parents (el, name) {
  while (el && el.nodeName.toLowerCase() !== name) {
    el = el.parentNode
  }

  return el && el.nodeName.toLowerCase() === name
    ? el
    : null
}

export const random_id = () => Math.random().toString(32).substr(2)
export const random_idx = (len) => Math.floor(Math.random() * len)
export const random_int = (max, min = 0) => min + Math.floor(Math.random() * (max - min))
export const random_int2 = (max, min = 0) => min + Math.floor(Math.sqrt(Math.random() * (max - min) * (max - min)))
export const sample_array = (array) => {
  const length = array == null ? 0 : array.length
  return length ? array[random_idx(length)] : undefined
}

export const is_empty = (value) => (!value || typeof value !== 'object') ? !value : !Object.keys(value).length
export const is_func = (fn) => typeof fn === 'function'

// same as lodash.compact, but does the compaction inline on the same array by resizing it
export function compact (array) {
  var i = -1,
      len = array.length,
      idx = -1

  while (++i < len) {
    var value = array[i]
    if (value) {
      if (i !== ++idx) array[idx] = value
    }
  }
  array.length = idx + 1
  return array
}

// removes (using splice) by strict-comparison all of `value` (default: null) from an array
export function remove_every (array, value = null) {
  var i = -1,
      len = array.length,
      to_remove = 0

  while (++i < len) {
    while (array[i + to_remove] === value) to_remove++
    if (to_remove > 0) {
      array.splice(i, to_remove)
      to_remove = 0
    }
  }

  return array
}

// swaps two elements in an array/object
export function swap (o, to, from) {
  var t = o[to]
  o[to] = o[from]
  o[from] = t
}


// `cb(obj, array[i])` gets called `array.length` times
export function obj_apply (obj, array, cb) {
  for (let item of array) cb(obj, item)
  return obj
}

// `cb(obj, array[i], array2[j])` gets called `array.length * array2.length` times
export function obj_apply2 (obj, array, array2, cb) {
  for (let item of array)
  for (let item2 of array2)
    cb(obj, item, item2)
  return obj
}

// adapted from: https://gist.github.com/rmariuzzo/8761698
export function sprintf(format, ...args) {
  var i = 0
  return format.replace(/%[s|d]/g, () => args[i++])
}

export function parseHash (hash, keys) {
  try {
    var parsed = compact(JSON.parse(decodeURIComponent(hash.substr(2))))

    return keys
      ? pick(parsed, keys)
      : parsed
  } catch (e) {
    return {}
  }
}

export function parseJSON (string) {
  try {
    return JSON.parse(string)
  } catch (e) {
    return string || ''
  }
}

export function objJSON (s) {
  try {
    return typeof s === 'string' ? JSON.parse(s) : s
  } catch (e) {}
  return {}
}

export function joinPaths (...parts) {
  return parts.join('/').replace(/\/+/g, '/')
}

export function parseUri (uri) {
  var parts = uri.match(/^(?:([\w+.-]+):\/\/([^/]+))?([^?#]*)?(\?[^#]*)?(#.*)?/)

  return {
    protocol: parts[1] || '',
    host: parts[2] || '',
    path: parts[3] || '',
    qs: parts[4] || '',
    hash: parts[5] || ''
  }
}

export function parseQS (qs, keys) {
  var index = qs.indexOf('?')
  var parsed = {}

  if (index !== -1) {
    var pairs = qs.substr(index + 1).split('&')
    var pair = []

    for (var i = 0, c = pairs.length; i < c; i++) {
      pair = pairs[i].split('=')

      if ((!isEmpty(pair[1])) && (!isEmpty(parseJSON(pair[1])))) {
        parsed[decodeURIComponent(pair[0])] = parseJSON(decodeURIComponent(pair[1]))
      }
    }
  }

  return keys
    ? pick(parsed, keys)
    : parsed
}

export function pick (object, keys) {
  var x, data = {}

  if (typeof keys === 'function') {
    for (x in object) {
      if (object.hasOwnProperty(x) && keys(object[x], x)) {
        data[x] = object[x]
      }
    }
  } else {
    for (x = 0; x < keys.length; x++) {
      data[keys[x]] = object[keys[x]]
    }
  }

  return data
}


export const stringify = (value) => (!value || typeof value !== 'object') ? value : JSON.stringify(value)

export function stringifyHash (data) {
  data = compact(data)

  return !isEmpty(data)
    ? '#!' + encodeURIComponent(stringify(data))
    : ''
}

export function stringifyQS (data) {
  var qs = ''

  for (var x in data) {
    if (data.hasOwnProperty(x) && !isEmpty(data[x])) {
      qs += '&' + encodeURIComponent(x) + '=' + encodeURIComponent(stringify(data[x]))
    }
  }

  return qs
    ? '?' + qs.substr(1)
    : ''
}

export const camelize = (k) => ~k.indexOf('-') ? k.replace(/-+(.)?/g, (tmp, c) => (c || '').toUpperCase()) : k

// I imagine that something better can be done than this...
export const define_getter = (get, set = void 0, enumerable = true, configurable = true) => ({ get, set, enumerable, configurable })
export const define_value = (value, writable = false, enumerable = true, configurable = true) => ({ value, writable, enumerable, configurable })
export const define_prop = (obj, prop, def) => Object.defineProperty(obj, prop, def)
export const define_props = (obj, prop_defs) => Object.defineProperties(obj, prop_defs)

export function slasher (_path, strip_leading) {
  // strip trailing slash
  var path = _path.replace(/\/$/, '')
  // (optionally) strip leading slash
  return strip_leading && path[0] === '/' ? path.slice(1) : path
}

// get a value from options then return the value (or the default passed)
// puts object into "slow mode" though
export function extract_opts_val (opts, key, _default) {
  var val
  if (val = opts[key]) delete opts[key]
  return val === void 9 ? _default : val
}

// knicked from: https://github.com/elidoran/node-optimal-object/blob/master/lib/index.coffee
export function optimal_obj (obj) {
  Object.create(obj)
  var enforcer = () => obj.blah
  // call twice to ensure v8 optimises the object
  enforcer()
  enforcer()
}

// merges all of `objs` into a new object (doesn't modify any of the `objs`)
export function merge (...objs) {
  return Object.assign({}, ...objs)
}

// merges all of the properties from `obj[1 .. *]` into `obj[0]` and returns `obj[0]`
export function extend (...obj) {
  return Object.assign(...obj)
}

// knicked from: https://stackoverflow.com/questions/27936772/how-to-deep-merge-instead-of-shallow-merge
export function mergeDeep(target, ...sources) {
  if (!sources.length) return target
  var key, src_obj, source = sources.shift()

  if (isObject(target) && isObject(source)) {
    for (key in source) {
      if (isObject(src_obj = source[key])) {
        if (!target[key]) target[key] = {}
        mergeDeep(target[key], src_obj)
      } else {
        Object.assign(target, { [key]: src_obj })
      }
    }
  }

  return mergeDeep(target, ...sources)
}

// same as above, but also concats arrays
export function mergeDeepArray(target, ...sources) {
  if (!sources.length || !isObject(target)) return target
  var key, src_val, obj_val, source

  if (isObject(source = sources.shift())) {
    for (key in source) {
      src_val = source[key]
      obj_val = target[key]
      if (Array.isArray(src_val) || Array.isArray(obj_val)) {
        target[key] = (obj_val || []).concat(src_val)
      } else if (isObject(src_val)) {
        if (!obj_val) target[key] = {}
        mergeDeep(obj_val, src_val)
      } else {
        Object.assign(target, { [key]: src_val })
      }
    }
  }

  return mergeDeep(target, ...sources)
}

window.empty_array = empty_array
export function empty_array (n, init_value = 0) {
  var array = Array(n)
  while (n-- > 0) array[n] = init_value
  return array
}

// left_pad((1234).toString(16), 20, '0')
// > "000000000000000004d2"
export const left_pad = (nr, n = 2, str = '0') => Array(n - (nr+'').length + 1).join(str) + nr

export const which = (event) => (event = event || win.event).which === null ? event.button : event.which

export const kind_of = (val) => val === null ? 'null'
  : typeof val !== 'object' ? typeof val
  : Array.isArray(val) ? 'array'
  : {}.toString.call(val).slice(8, -1).toLowerCase()
