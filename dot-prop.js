// knicked from: https://github.com/jquense/expr
// inspired by: https://github.com/sindresorhus/dot-prop
// Based on Kendo UI Core expression code <https://github.com/telerik/kendo-ui-core#license-information>

export class Cache {
  constructor (maxSize) {
    this._maxSize = maxSize
    this.clear()
  }

  clear () {
    this._size = 0
    this._values = {}
  }

  get (key) {
    return this._values[key]
  }

  set (key, value) {
    this._size >= this._maxSize && this.clear()
    if (!this._values.hasOwnProperty(key)) {
      this._size++
    }
    return this._values[key] = value
  }
}

let SPLIT_REGEX = /[^.^\]^[]+|(?=\[\]|\.\.)/g,
  DIGIT_REGEX = /^\d+$/,
  LEAD_DIGIT_REGEX = /^\d/,
  SPEC_CHAR_REGEX = /[~`!#$%\^&*+=\-\[\]\\';,/{}|\\":<>\?]/g,
  CLEAN_QUOTES_REGEX = /^\s*(['"]?)(.*?)(\1)\s*$/,
  MAX_CACHE_SIZE = 512

let pathCache = new Cache(MAX_CACHE_SIZE)
let setCache = new Cache(MAX_CACHE_SIZE)
let getCache = new Cache(MAX_CACHE_SIZE)

export function getter_no_fn (path, safe) {
  let parts = normalizePath(path)
  return function (data) {
    return getterFallback(parts, safe, data)
  }
}

export function getter_fn (path, safe) {
  let key = path + '_' + safe
  return getCache.get(key) || getCache.set(
      key,
      new Function('data', 'return ' + expr(path, safe, 'data'))
  )
}

export function getter (path, safe) {
  let chunks = path.split('[]').map((chunk, idx) => {
    return getter_fn(idx === 0 ? chunk : chunk.slice(1), safe)
  })

  return function (obj) {
    let res = chunks[0](obj)
    let idx = 1
    while (chunks[idx] && Array.isArray(res)) {
      res = Array.prototype.concat.apply([], res.map(chunks[idx]))
      idx += 1
    }
    return res
  }
}

export function getterCSP (path, safe) {
  let chunks = path.split('[]').map((chunk, idx) => {
    return getter_no_fn(idx === 0 ? chunk : chunk.slice(1), safe)
  })
  return function (obj) {
    let res = chunks[0](obj)
    let idx = 1
    while (chunks[idx] && Array.isArray(res)) {
      res = Array.prototype.concat.apply([], res.map(chunks[idx]))
      idx += 1
    }
    return res
  }
}

function setterCSP (path) {
  let parts = normalizePath(path)
  return function (data, value) {
    return setterFallback(parts, data, value)
  }
}

function setter (path) {
  return setCache.get(path) || setCache.set(
      path,
      new Function(
        'data, value',
        expr(path, 'data') + ' = value'
      )
  )
}

export function get (obj, path, default_value) {
  let value = getter(path, true)(obj)
  return value === undefined ? default_value : value
}

export function set (obj, path, value) {
  return setter(path, true)(obj, value)
}

export function join (segments) {
  return segments.reduce((path, part) => (
    path +
    (isQuoted(part) || DIGIT_REGEX.test(part)
      ? '[' + part + ']'
      : (path ? '.' : '') + part
    )
  ), '')
}

export function forEach (path, cb, thisArg) {
  each(split(path), cb, thisArg)
}

function setterFallback (parts, data, value) {
  let index = 0
  let len = parts.length
  while (index < len - 1) data = data[parts[index++]]
  data[parts[index]] = value
}

function getterFallback (parts, safe, data) {
  let index = 0
  let len = parts.length
  while (index < len) {
    if (data != null || !safe) {
      data = data[parts[index++]]
    } else {
      return
    }
  }
  return data
}

export function normalizePath (path) {
  return pathCache.get(path)
    || pathCache
      .set(path, split(path)
        .map((part) => part.replace(CLEAN_QUOTES_REGEX, '$2'))
  )
}

export function split (path) {
  return path.match(SPLIT_REGEX) || []
}

export function expr (expression, safe, param) {
  expression = expression || ''

  if (typeof safe === 'string') {
    param = safe
    safe = false
  }

  param = param || 'data'

  if (expression && expression.charAt(0) !== '[') expression = '.' + expression

  return safe ? makeSafe(expression, param) : param + expression
}

function each (parts, iter, thisArg) {
  let len = parts.length,
    part,
    idx,
    isArray,
    isBracket

  for (idx = 0; idx < len; idx++) {
    part = parts[idx]

    if (part) {
      if (shouldBeQuoted(part)) {
        part = '"' + part + '"'
      }

      isBracket = isQuoted(part)
      isArray = !isBracket && /^\d+$/.test(part)

      iter.call(thisArg, part, isBracket, isArray, idx, parts)
    }
  }
}

function isQuoted (str) {
  return (
    typeof str === 'string' && str && ~["'", '"'].indexOf(str.charAt(0))
  )
}

function makeSafe (path, param) {
  let result = param,
    parts = split(path),
    isLast

  each(parts, function (part, isBracket, isArray, idx, parts) {
    isLast = idx === parts.length - 1

    part = isBracket || isArray ? '[' + part + ']' : '.' + part

    result += part + (!isLast ? ' || {})' : ')')
  })

  return new Array(parts.length + 1).join('(') + result
}

function shouldBeQuoted (part) {
  return !isQuoted(part) && (
    (part.match(LEAD_DIGIT_REGEX) && !part.match(DIGIT_REGEX))
    || SPEC_CHAR_REGEX.test(part)
  )
}
