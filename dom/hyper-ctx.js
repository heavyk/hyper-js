import { error, __debug } from '@hyper/utils'
import { define_getter, define_value } from '@hyper/utils'
// import { random_id } from '@hyper/utils'
import { h, s } from '@hyper/dom/hyper-hermes'
import { doc, getElementById, isNode } from '@hyper/dom/dom-base'

// default obv functions provided
import { value, transform, compute } from '@hyper/dom/observable'
import { update_obv } from '@hyper/dom/observable-event'

// I'm not sure this is the best way to do this...
// since it's the global context, should it be cached somewhere?

export function global_ctx () {
  // let ctx
  let el = doc.getElementById('global_ctx') || new_ctx({
    _id:0, ERROR: 'THIS IS THE GLOBAL CTX',
    o: {},
    h, s,
    v: value, t: transform, c: compute, m: update_obv
  }, (_ctx) => {
    // ctx = _ctx
    return doc.head.aC(h('meta#global_ctx'))
  })
  return el_ctx(el)
  // return ctx || el_ctx(el)
}

const EL_CTX = new Map()
export function el_ctx (el) {
  let ctx
  while ((ctx = EL_CTX.get(el)) == null && (el = el.parentNode) != null) {}
  return ctx
}

export function el_cleanup (el) {
  let ctx = EL_CTX.get(el)
  if (ctx) {
    ctx.cleanup()
    EL_CTX.delete(el)
  }
}

export function cleanup () {
  for (let [el, ctx] of EL_CTX.entries()) {
    // there are potentially cases where you may hold on to a node for a little bit before reinserting it into the dom.
    // so, maybe it should be added to a list for gc after some timeout. if it has a parent again, remove it from the list
    if (!el.parentNode) {
      ctx.cleanup()
      EL_CTX.delete(el)
    }
  }
}

let last_id = 0
export function new_ctx (G = global_ctx(), fn, ...args) {
  if (DEBUG && typeof fn !== 'function') error('new_ctx is now called with a function which returns an element')

  var cleanupFuncs = []
  var obvs = {}
  var ctx = Object.create(G, {
    _id: define_value(++last_id),
    // _ns: define_value(name),
    // _ctx: define_value(sub),
    o: define_value(obvs),
    _h: define_value(null, true),
    _s: define_value(null, true),
    h: define_getter(() => ctx._h || (ctx._h = G.h.context())),
    s: define_getter(() => ctx._s || (ctx._s = G.s.context())),
    cleanupFuncs: define_value(cleanupFuncs),
    parent: define_value(G),
    cleanup: define_value((f) => {
      // while (f = sub.pop()) f.cleanup()
      while (f = cleanupFuncs.pop()) f()
      if (ctx._h) ctx._h.cleanup()
      if (ctx._s) ctx._s.cleanup()
    })
  })

  let mo, el = fn(ctx, ...args)

  if (DEBUG && Array.isArray(el)) error('this will assign a context to your element, so wrap these elements in a container element')
  if (DEBUG && !isNode(el) && el != null) error('you must return an element when creating a new context')

  EL_CTX.set(el, ctx)

  return el
}

import { Node_prototype } from '@hyper/dom/hyper-hermes'

// shortcut to remove myself from the dom (and cleanup if it's got nodes)
Node_prototype.rm = function () { return el_cleanup(this), this.remove() }
