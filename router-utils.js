import { pick, compact, isEmpty, stringify } from '@hyper/utils'

export function pathVars (path) {
  let m = path.match(/\/:\w+/g)
  return m ? m.map((name) => name.substr(2)) : []
}

export function pathToRegExp (path) {
  return new RegExp(
    pathToRegExpString(path)
      .replace(/^\^(\\\/)?/, '^\\/?')
      .replace(/(\\\/)?\$$/, '\\/?$'),
    'i'
  )
}

export function pathToStrictRegExp (path) {
  return new RegExp(pathToRegExpString(path))
}

function pathToRegExpString (path) {
  return ('^' + path + '$')
    .replace(/\/:\w+(\([^)]+\))?/g, '(?:\/([^/]+)$1)')
    .replace(/\(\?:\/\(\[\^\/]\+\)\(/, '(?:/(')
    .replace(/\//g, '\\/')
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

export function stringifyHash (data) {
  data = compact(data)

  return data.length
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
