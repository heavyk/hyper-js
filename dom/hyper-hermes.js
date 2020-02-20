// hyper-hermes
// knicked from https://github.com/dominictarr/hyperscript
// many modifications...
// also took some inspiration from https://github.com/Raynos/mercury

// TODO: to make errors a bit more user-friedly, I began utilising the error function.
//       however, when building the plugin library, an errorless version should be created (to reduce size)
//       additionally, other things unnecessary (old/unused) things can be omitted as wel, for further savings.

import { is_obv } from './observable'
import { observe_event, add_event } from './observable-event'
import { define_prop, kind_of, array_idx, define_value, error } from '@hyper/utils'
import { after, next_tick } from '@hyper/utils'

import { win, doc, customElements } from './dom-base'
import { isNode, txt, comment, cE, set_style } from './dom-base'
import { lookup_parent_with_attr } from './dom-base'
import { Node_prototype } from './dom-base'

// add your own (or utilise this to make your code smaller!)
export let short_attrs = { s: 'style', c: 'class', for: 'htmlFor' }
// however, when using setAttribute, these need to be reversed
export let short_attrs_rev = { style: 's', className: 'class', htmlFor: 'for' }

// can be used to save bytes:
// h(1,{value:11})
//     vs.
// h('input',{value:11})
// when common_tags = ['div','input']
//
// however, it's less efficient if either a class or id has to be specified:
// h(0,{c:'lala'})
//     vs.
// h('div.lala')
//
// this does not currently work (but it could):
// h('0.lala')
//     vs.
// h('div.lala')
//
// however this does:
// h(2)
// when common_tags = ['div','input','div.lala']
export let common_tags = ['div']

function hyper_hermes (create_element) {
  let cleanupFuncs = []

  function h(...args) {
    let e
    function item (l) {
      let r, s, i, o, k
      function parse_selector (string) {
        let v, m = string.split(/([\.#]?[a-zA-Z0-9_:-]+)/)
        if (/^\.|#/.test(m[1])) e = create_element('div')
        // if (!root) root = e // the first element this
        for (v of m) {
          if (typeof v === 'string' && (i = v.length)) {
            if (!e) {
              e = create_element(v, args)
            } else {
              if ((k = v[0]) === '.' || k === '#') {
                if (s = v.substring(1, i)) {
                  if (k === '.') e.classList.add(s)
                  else e.id = s
                }
              }
            }
          }
        }
      }

      if (!e && typeof l === 'number' && l < common_tags.length)
        // we overwrite 'l', so it does not try and add a text node of its number to the element
        l = parse_selector(common_tags[l])

      if (l != null)
      if (typeof l === 'string') {
        if (!e) {
          parse_selector(l)
        } else {
          e.aC(r = txt(l))
        }
      } else if (typeof l === 'number'
        || typeof l === 'boolean'
        || l instanceof Date
        || l instanceof RegExp ) {
          e.aC(r = txt(l.toString()))
      } else if (Array.isArray(l)) {
        e.aC(l, cleanupFuncs)
      } else if (isNode(l) || l instanceof win.Text) {
        e.aC(r = l)
      } else if (typeof l === 'object') {
        // is a promise
        if (typeof l.then === 'function') {
          e.aC(r = comment(DEBUG ? '1:promise-value' : 1))
          l.then((v) => {
            let node = make_node(e, v, cleanupFuncs)
            if (DEBUG && r.parentNode !== e) error('promise unable to insert itself into the dom because parentNode has changed')
            else e.rC(node, r)
          })
        } else for (k in l) set_attr(e, k, l[k], cleanupFuncs)
      } else if (typeof l === 'function') {
        r = make_obv_node(e, l, cleanupFuncs)
      } else if (DEBUG) {
        error('unknown/unsupported item being appended to element')
      }

      return r
    }

    while (args.length) {
      item(args.shift())
    }

    return e
  }

  h.x = cleanupFuncs
  h.z = (fn) => {
    cleanupFuncs.push(
      DEBUG && typeof fn !== 'function'
      ? error('adding a non-function value to cleanupFuncs')
      : fn
    )
    return fn
  }
  h.cleanup = () => {
    for (let i = 0; i < cleanupFuncs.length; i++) {
      cleanupFuncs[i]()
    }
  }

  return h
}

// these two probably need to be moved to dom-base
// instead of saving them into a set, we just lookup_parent_with_attr(e, 'roadtrip')
// export let roadtrips = new Set
// this is so that custom attributes can be used to define custom behaviour
export let custom_attrs = {
  boink: (cleanupFuncs, e, fn) => { observe_event(cleanupFuncs, e, {boink: fn}) },
  press: (cleanupFuncs, e, fn) => { observe_event(cleanupFuncs, e, {press: fn}) },
  hover: (cleanupFuncs, e, fn) => { observe_event(cleanupFuncs, e, {hover: fn}) },
  focused: (cleanupFuncs, e, fn) => { observe_event(cleanupFuncs, e, {focus: fn}) },
  selected: (cleanupFuncs, e, fn) => { observe_event(cleanupFuncs, e, {select: fn}) },
  input: (cleanupFuncs, e, fn) => { observe_event(cleanupFuncs, e, {input: fn}) },
  go: (cleanupFuncs, e, url, roadtrip) => {
    // call on next_tick, to make sure the element is added to the dom.
    next_tick(() => {
      // set the event handler:
      observe_event(cleanupFuncs, e, {boink: () => {
        if (!roadtrip) {
          // look upward to see if one of the container elements has a roadtrip in it
          roadtrip = lookup_parent_with_attr(e, 'roadtrip')
          if (DEBUG && !roadtrip) {
            console.info('element:', e)
            error(`using 'go' attr when no roadtrip is defined for a parent element`)
          } else {
            roadtrip = roadtrip.roadtrip
          }
        }

        roadtrip.goto(typeof url === 'function' ? url() : url)
      }})
    })
  }
}

export function set_attr (e, key_, v, cleanupFuncs = []) {
  // convert short attributes to long versions. s -> style, c -> className
  let s, o, i, k = short_attrs[key_] || key_
  if (typeof v === 'function') {
    next_tick(() => {
      if (typeof(o = custom_attrs[k]) === 'function') {
        o(cleanupFuncs, e, v)
      } else if (k.substr(0, 2) === 'on') {
        add_event(cleanupFuncs, e, k.substr(2), v, false)
      } else if (k.substr(0, 6) === 'before') {
        add_event(cleanupFuncs, e, k.substr(6), v, true)
      } else {
        // setAttribute was used here, primarily for svg support.
        // we may need to make a second version or something which works well with svg, perhaps instead using setAttributeNode
        // however, as mentioned in this article it may be desirable to use property access instead
        // https://stackoverflow.com/questions/22151560/what-is-happening-behind-setattribute-vs-attribute
        // observable (write-only) value
        cleanupFuncs.push(v.call(e, (v) => {
          set_attr(e, k, v, cleanupFuncs)
        }, 1)) // 1 = do_immediately
        s = e.nodeName
        s === "INPUT" && observe_event(cleanupFuncs, e, {input: v})
        s === "SELECT" && observe_event(cleanupFuncs, e, k === 'label' ? {select_label: v} : {select: v})
      }
    })
  } else {
    if (k === 'assign' || k === 'extend') {
      // for(s in v) e[s] = v[s]
      Object.assign(e, v)
    } else if (k === 'data') {
      if (typeof v === 'object')
        for(s in v) e.dataset[s] = v[s]
      else error('data property should be passed as an object')
    } else if (k === 'multiple') {
      e.multiple = !!v
    } else if (k === 'contenteditable') {
      e.contentEditable = !!v
    } else if (k === 'autofocus') {
      after(0.01, () => e.focus())
    } else if (k === 'autoselect') {
      after(0.01, () => {
        e.focus()
        o = [v[0] || 0, v[1] || -1]
        e.setSelectionRange.apply(e, range)
      })
    } else if (k === 'selected') {
      e.defaultSelected = !!v
    } else if (k === 'checked') {
      e.defaultChecked = !!v
    } else if (k === 'value') {
      e.defaultValue = e.value = v
    } else if (k === 'for') {
      e.htmlFor = v
    } else if (k === 'class') {
      if (v) {
        o = e.classList
        if (Array.isArray(v)) for (s of v) s && o.add(s)
        else if (typeof v === 'object')
          for (let s in v) is_obv(v[s])
            ? cleanupFuncs.push(v[s]((v) => o.toggle(s, v), 1))
            : o.toggle(s, v[s])
        else o.add(v)
      }
    } else if ((i  = (k === 'on')) || k === 'before') {
      // 'before' is used to denote the capture phase of event propagation
      // see: http://stackoverflow.com/a/10654134 to understand the capture / bubble phases
      // before: {click: (do) => something}
      if (typeof v === 'object') {
        for (s in v)
          if (typeof (o = v[s]) === 'function')
            add_event(cleanupFuncs, e, s, o, i ? false : true)
      }
    } else if (k === 'html') {
      e.innerHTML = v
    } else if (k === 'observe') {
      // I believe the set-timeout here is to allow the element time to be added to the dom.
      // it is likely that this is undesirable most of the time (because it can create a sense of a value 'popping' into the dom)
      // so, likely I'll want to move the whole thing out to a function which is called sometimes w/ set-timeout and sometimes not.
      next_tick(() => observe_event(cleanupFuncs, e, v))
    } else if (k === 'style') {
      if (typeof v === 'string') {
        e.style.cssText = v
      } else {
        set_style(e, v, cleanupFuncs)
      }
    } else if (~k.indexOf('-')) {
      // in weird cases with stuff like data- or other attrs containing hyphens, use setAttribute
      e.setAttribute(k, v)
    } else if (v !== undefined) {
      if (typeof(o = custom_attrs[k]) === 'function') {
        o(cleanupFuncs, e, v)
      } else if (~(i = k.indexOf(':'))) {
        // for namespaced attributes, such as xlink:href
        // (I'm really not aware of any others than xlink... PRs accepted!)
        // ref: http://stackoverflow.com/questions/7379319/how-to-use-creatensresolver-with-lookupnamespaceuri-directly
        // ref: https://developer.mozilla.org/en-US/docs/Web/API/Document/createNSResolver
        if (k.substr(0, i) === 'xlink') {
          e.setAttributeNS('http://www.w3.org/1999/xlink', k.substr(++i), v)
        } else {
          error('unknown namespace for attribute: ' + k)
        }
      } else {
        // for svgs you have to setAttribute. for example, s('rect', {cx: 5}) will fail, as cx is a read-only property
        // however, it is worth noting that setAttribute is about 30% slower than setting the property directly
        // https://jsperf.com/setattribute-vs-property-assignment/7
        // it's likely a not-null check for e.namespaceURI is less overhead than using setAttribute for everyone
        if (doc.isDefaultNamespace(e.namespaceURI)) e[k] = v
        else e.setAttribute(short_attrs_rev[k] || k, v)
      }
    }
  }
}

export function arrayFragment (e, arr, cleanupFuncs) {
  var v, frag = doc.createDocumentFragment()
  var activeElement = (el) => el === (e.activeElement || doc.activeElement)
  // function deepActiveElement() {
  //   let a = doc.activeElement
  //   while (a && a.shadowRoot && a.shadowRoot.activeElement) a = a.shadowRoot.activeElement
  //   return a
  // }

  // append nodes to the fragment, with parent node as e
  for (v of arr) frag.aC(make_node(e, v, cleanupFuncs))

  if (arr.observable === 'array') {
    // TODO: add a comment to know where the array begins and ends (a la angular)
    function onchange (ev) {
      var i, j, o, oo, len = arr.length
      switch (ev.type) {
      case 'unshift':
        for (i = ev.values.length - 1; i >= 0; i--)
          e.insertBefore(isNode(o = ev.values[i]) ? o : txt(o), arr[0])
        break
      case 'push':
        for (i = 0; i < ev.values.length; i++)
          e.insertBefore(isNode(o = ev.values[i]) ? o : txt(o), arr[arr.length + ev.values.length - i - 1])
        break
      case 'pop':
        e.removeChild(arr[len-1])
        break
      case 'shift':
        e.removeChild(arr[0])
        break
      case 'splice':
        if ((j = ev.idx) < 0) j += len // -idx
        // experimental:
        if (ev.remove) for (i = 0; i < ev.remove; i++) {
          if (o = arr[j++]) {
            if (oo = ev.add[i]) e.replaceChild(isNode(oo) ? oo : txt(oo), o)
            else e.removeChild(o)
          }
        }
        if (ev.add) for (i = 0; i < ev.add.length; i++)
          e.insertBefore(isNode(o = ev.add[i]) ? o : txt(o), arr[j])
        // working (just in case replaceChild has some weird cases):
        // if (ev.remove) for (i = 0; i < ev.remove; i++)
        //   if (o = arr[j++]) e.removeChild(o)
        // if (ev.add) for (i = 0; i < ev.add.length; i++)
        //   e.insertBefore(isNode(o = ev.add[i]) ? o : txt(o), arr[j])

        break
      case 'sort':
        // technically no longer used, but still exists mainly for comparison purposes
        // although less element swaps are done with quiksort, it may be taxing on paint performance...
        // looking into it eventually :)
        for (i = 0, oo = ev.orig; i < arr.length; i++) {
          o = arr[i]
          if (i !== (j = oo.indexOf(o))) {
            if (activeElement(o) || o.focused === 1) i = 1
            e.removeChild(o)
            e.insertBefore(o, arr[i - 1])
            if (i === 1) o.focus(), o.focused = 0
          }
        }
        break
      case 'replace':
        o = ev.val
        oo = ev.old
        if (activeElement(o) || o.focused === 1) i = 1
        if (activeElement(oo)) oo.focused = 1
        e.replaceChild(o, oo)
        if (i === 1) o.focus(), o.focused = 0
        break
      case 'insert':
        if ((i = ev.idx) < 0) i += len // -idx
        e.insertBefore(ev.val, arr[i])
        break
      case 'reverse':
        for (i = 0, j = +(arr.length / 2); i < j; i++)
          arr.emit('change', {type: 'swap', from: i, to: arr.length - i - 1 })
        break
      case 'move':
        if ((i = ev.from) < 0) i += len // -idx
        if ((j = ev.to) < 0) j += len   // -idx
        o = arr[i]
        if (activeElement(o)) i = 1
        e.insertBefore(o, arr[j])
        if (i === 1) o.focus()
        break
      case 'swap':
        ev.j = h('div.swap', o = {s: {display: 'none'}})
        ev.k = h('div.swap', o)
        if ((i = ev.from) < 0) i += len // -idx
        if ((j = ev.to) < 0) j += len   // -idx
        oo = arr[i]
        o = arr[j]
        if (activeElement(o)) i = 1
        else if (activeElement(oo)) i = 2
        e.replaceChild(ev.j, oo)
        e.replaceChild(ev.k, o)
        e.replaceChild(o, ev.j)
        e.replaceChild(oo, ev.k)
        if (i === 1) o.focus()
        else if (i === 2) oo.focus()
        break
      case 'remove':
        if ((i = ev.idx) < 0) i += len // -idx
        e.removeChild(arr[i])
        break
      case 'set':
        if ((i = ev.idx) < 0) i += len // -idx
        e.replaceChild(ev.val, arr[i])
        break
      case 'empty':
        for (i = 0; i < arr.length; i++)
          e.removeChild(arr[i])
        break
      default:
        console.log('unknown event', ev)
      }
    }

    arr.on('change', onchange)
    cleanupFuncs.push(() => { arr.off('change', onchange) })
  }
  return frag
}

export var special_elements = {}
define_prop(special_elements, 'define', define_value((name, fn, args) => {
  // if (DEBUG) console.log('defining', name, args)
  customElements.define(name, fn)
  special_elements[name] = typeof args === 'number' ? args : Array.isArray(args) ? args.length : fn.length || 0
}))

export var h = new_dom_context(1)
export function new_dom_context (no_cleanup) {
  // TODO: turn this into ctx = new Context ((el, args) => { ... })
  //  -- and, turn the context fn into a class??
  var ctx = hyper_hermes((el, args) => {
    var i
    return !~el.indexOf('-') ? cE(el)
      : (i = special_elements[el]) !== undefined ? new (customElements.get(el))(...args.splice(0, i))
      : new (customElements.get(el))
  })

  if (!no_cleanup) h.z(() => ctx.cleanup())
  ctx.context = new_dom_context
  return ctx
}

export var s = new_svg_context(1)
export function new_svg_context (no_cleanup) {
  var ctx = hyper_hermes((el) => doc.createElementNS('http://www.w3.org/2000/svg', el))

  if (!no_cleanup) s.z(() => ctx.cleanup())
  ctx.context = new_svg_context
  return ctx
}

export function make_node (e, v, cleanupFuncs, placeholder) {
  return  isNode(v) ? v
    : Array.isArray(v) ? arrayFragment(e, v, cleanupFuncs)
    : typeof v === 'function' ? (
      is_obv(v) ? make_obv_node(e, v, cleanupFuncs) : (() => {
        while (typeof v === 'function') v = v.call(e, e)
        return make_node(e, v, cleanupFuncs)
      })()
    )
    : v == null ? comment(DEBUG ? '0:null' : 0)
    : typeof v.then === 'function' ? (v.then((v) => {
      let node = make_node(e, v, cleanupFuncs)
      if (DEBUG && placeholder.parentNode !== e) error('promise unable to insert itself into the dom because parentNode has changed')
      else e.rC(node, placeholder)
    }), placeholder = comment(DEBUG ? '2:promise-value' : 2))
    : txt(v)
}

export function make_obv_node (e, v, cleanupFuncs = []) {
  let r, o, nn, clean = [], placeholder
  if (typeof v === 'function') {
    if (is_obv(v)) {
      // observable
      e.aC(r = comment(DEBUG ? '3:obv-value' : 3))
      e.aC(placeholder = comment(DEBUG ? '4:obv-bottom' : 4))
      cleanupFuncs.push(v((val) => {
        nn = make_node(e, val, cleanupFuncs)
        if (Array.isArray(r)) {
          for (val of r) e.rm(val)
        } else if (r) {
          if (DEBUG && r.parentNode !== e) error('obv unable to replace child node because parentNode has changed')
          else e.rC(nn, r)
        }

        e.iB(nn, placeholder)
        r = Array.isArray(val) ? val : nn
      }), () => (placeholder.rm(), r && Array.isArray(r) ? each(r, r => r.rm()) : r.rm()))
    } else {
      // normal function
      o = make_node(e, v, cleanupFuncs)
      if (o != null) r = e.aC(o, cleanupFuncs)
    }
    r = make_node(e, r, cleanupFuncs)
  } else {
    r = make_node(e, v, cleanupFuncs)
  }
  return r
}

// shortcut to append multiple children (w/ cleanupFuncs)
Node_prototype.iB = function (el, ref, cleanupFuncs) { return this.insertBefore(make_obv_node(this, el, cleanupFuncs), ref) }
// shortcut to append multiple children (w/ cleanupFuncs)
Node_prototype.aC = function (el, cleanupFuncs) { return this.appendChild(isNode(el) ? (el.parentNode !== this ? el : undefined) : make_obv_node(this, el, cleanupFuncs)) }
// shortcut to replaceChild
Node_prototype.rC = function (new_child, old_child) { return this.replaceChild(new_child, old_child) }
// shortcut to apply attributes as if they were the second argument to `h('.lala', {these ones}, ...)`
Node_prototype.apply = function (obj, cleanupFuncs) {
  for (let k in obj) set_attr(this, k, obj[k], cleanupFuncs)
}
// https://jsperf.com/remove-all-child-nodes/2.atom
Node_prototype.empty = function () {
  var child
  while (child = this.firstChild) this.removeChild(child)
}

// event emitter shortcuts
Node_prototype.on = Node_prototype.addEventListener
Node_prototype.off = Node_prototype.removeEventListener

export default h
