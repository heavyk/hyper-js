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

export const get_prop_value = (obj, prop) => obj.getPropertyValue(prop)
export const int_prop_value = (obj, prop) => int(obj.getPropertyValue(prop))
export const sum_prop_values = (obj, props) => (
  Array.isArray(props) ? props : props.split('|')
).reduce((total, prop) => {
  return total + int_prop_value(obj, prop)
}, 0)

export function scroll_to (id_or_el) {
  let el = getElementById(id_or_el)

  return !el ? null : isNode(el)
    ? win.scrollBy(0, el.getBoundingClientRect().top)
    : win.scrollTo(0, 0)
}

export function get_style_prop (element, prop) {
  let st = element.currentStyle
  return st ? st[prop]
    : getComputedStyle ? getComputedStyle(element, null).getPropertyValue(prop)
    : element.style[prop]
}

export function element_offset (child) {
  let i = 0
  while ((child = child.previousSibling) != null) i++
  return i
}

export function lookup_parent_element (el, name) {
  while (el && el.nodeName.toLowerCase() !== name) {
    el = el.parentNode
  }

  return el
}

export function lookup_parent_with_attr (el, attr, filter) {
  while (el && el[attr] === undefined && (!filter || !filter(el))) {
    el = el.parentNode
  }

  return el
}

export function set_style (e, style, cleanupFuncs = []) {
  if (typeof style === 'object') {
    // loaving this commented; need to make sure the scope for s is preserved. js is kinda funny sometimes.
    // for (let s in style) ((s, v) => {
    let v, s
    for (s in style) {
      v = style[s]
      if (typeof v === 'function') {
        // observable
        cleanupFuncs.push(v((v) => {
          e.style[s] = typeof v === 'number' && s !== 'opacity' ? v + 'px' : v
        }, 1))
      } else {
        // this is to make positioning elements a whole lot easier.
        // if you want a numeric value for some reason for something other than px, coerce it to a string first, eg. {order: '1', 'grid-column-start': '3'}
        e.style[s] = typeof v === 'number' && s !== 'opacity' ? v + 'px' : v
      }
    }
    // })(s, style[s])
  } else {
    e.setAttribute('style', style)
  }
}

// by default, for performeance reasons, only passive events are used.
// if preventDefault is called, chrome will spit out an error.
// if you want non-passive, simply pass your own opts: eg.
//   on(emitter, 'click', ..., { passive: false, capture: true })
//             -kenny 14-01-2020
let event_opts = (opts) =>
  opts === true ? { passive: true, capture: true }
  : opts === false ? { passive: true }
  : opts

// event stuff
// @Cleanup: replace all instances of 'addEventListener' with this function (to save a few bytes)
export function on (emitter, event, listener, opts = false) {
  if (DEBUG && emitter.tagName === 'A' && (typeof opts === 'boolean' || opts.passive)) error('you are trying to listen to an event on an element which will perform page navigation. pass `{passive: false}` if you want to change the default behaviour of the anchor element')
  (emitter.on || emitter.addEventListener).call(emitter, event, listener, event_opts(opts))
}

// @Cleanup: replace all instances of 'removeEventListener' with this function (to save a few bytes)
export function off (emitter, event, listener, opts = false) {
  (emitter.off || emitter.removeEventListener).call(emitter, event, listener, event_opts(opts))
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
