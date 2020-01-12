// commonly used globals exported (to save a few bytes)
export const win = window
export const doc = win.document
export const body = doc.body
export const getComputedStyle = win.getComputedStyle
export const customElements = win.customElements
export const location = doc.location
export const IS_LOCAL = ~location.host.indexOf('localhost')
export const base_path = location.pathname
export const origin = location.protocol + '//' + location.hostname + (location.port ? ':' + location.port : '')

// shortcut document creation functions
export const txt = (t) => doc.createTextNode(t)
export const comment = (t) => doc.createComment(t)
export const cE = (el) => doc.createElement(el)

export const isNode = (el) => el && el.nodeType
export const isText = (el) => el && el.nodeType == 3
export const getElementById = (el) => typeof el === 'string' ? doc.getElementById(el) : el

const anchor = cE('a')
// export const parse_href = (href) => (anchor.href = href, anchor)
export const href_pathname = (href) => (anchor.href = href, anchor.pathname)
export const href_query = (href) => (anchor.href = href, anchor.search.slice(1).split('&'))
export const href_hash = (href) => (anchor.href = href, anchor.hash.slice(1))

export function scrollTo (id_or_el) {
  var el = getElementById(id_or_el)

  return !el ? null : isNode(el)
    ? win.scrollBy(0, el.getBoundingClientRect().top)
    : win.scrollTo(0, 0)
}

export function getStyleProperty (element, prop) {
  var st = element.currentStyle
  return st ? st[prop]
    : getComputedStyle ? getComputedStyle(element, null).getPropertyValue(prop)
    : element.style[prop]
}

export function offsetOf (child) {
  var i = 0
  while ((child = child.previousSibling) != null) i++
  return i
}

// event stuff
// @Cleanup: replace all instances of 'addEventListener' with this function (to save a few bytes)
export function on (emitter, event, listener, opts = false) {
  (emitter.on || emitter.addEventListener).call(emitter, event, listener, opts)
}

// @Cleanup: replace all instances of 'removeEventListener' with this function (to save a few bytes)
export function off (emitter, event, listener, opts = false) {
  (emitter.off || emitter.removeEventListener).call(emitter, event, listener, opts)
}

// dispatch an event
// reading simulant source, it appears to be a bit more complicated than just this:
//  (but I'm not worrying about supporting old browsers). this is designed for modern browsers
// right now, val is simply being passed through... obviously it should set the correct fields though...
// which I'm going to just ignore for the time being...
export function dispatch_event (element, event, val) {
  (element.dispatchEvent(new Event(event)), val)
}

export function prevent_default (event) {
  event && (event.preventDefault(), event.stopImmediatePropagation())
}
