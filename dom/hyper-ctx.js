import { error, __debug } from '@hyper/utils'
import { define_getter, define_value } from '@hyper/utils'
// import { random_id } from '@hyper/utils'
import { h, s } from '@hyper/dom/hyper-hermes'
import { doc, getElementById, isNode } from '@hyper/dom/dom-base'
import { Node_prototype } from '@hyper/dom/dom-base'

// default obv functions provided
import { value, transform, compute } from '@hyper/dom/observable'
import obj_value from '@hyper/obv/obj_value'
import { update_obv } from '@hyper/dom/observable-event'

// I'm not sure this is the best way to do this...
// since it's the global context, should it be cached somewhere?

export function global_ctx () {
  let el = getElementById('global_ctx') || new_ctx({
    _id:0, ERROR: 'THIS IS THE GLOBAL CTX',
    o: {},
    h, s,
    // @Incomplete: it doesn't save much space. should perhaps the obvs that are not used be optional?
    v: value,
    t: transform,
    // c: compute,
    c: (obvs, compute_fn, obv) => {
      obv = compute(obvs, compute_fn)
      h.z(obv.x)
      return obv
    },
    m: update_obv,
    V: obj_value,
    z: (fn) => {
      cleanupFuncs.push(
        DEBUG && typeof fn !== 'function'
        ? error('adding a non-function value to cleanupFuncs')
        : fn
      )
      return fn
    },
  }, () => {
    // bind the global ctx to a meta tag in the head called 'global_ctx'
    return doc.head.aC(h('meta#global_ctx'))
  })
  return el_ctx(el)
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

  let cleanupFuncs = []
  let obvs = Object.create(G.o, {})
  let ctx = Object.create(G, {
    _id: define_value(++last_id),
    o: define_value(obvs),
    z: define_value((fn) => {
      cleanupFuncs.push(
        DEBUG && typeof fn !== 'function'
        ? error('adding a non-function value to cleanupFuncs')
        : fn
      )
      return fn
    }),
    _h: define_value(null, true),
    _s: define_value(null, true),
    h: define_getter(() => ctx._h || (ctx._h = G.h.context())),
    s: define_getter(() => ctx._s || (ctx._s = G.s.context())),
    cleanupFuncs: define_value(cleanupFuncs),
    c: define_value((obvs, compute_fn, obv) => {
      obv = compute(obvs, compute_fn)
      cleanupFuncs.push(obv.x)
      return obv
    }),
    parent: define_value(G),
    cleanup: define_value((f) => {
      while (f = cleanupFuncs.pop()) f()
      if (f = ctx._h) f.cleanup()
      if (f = ctx._s) f.cleanup()
    })
  })

  let mo, el = fn(ctx, ...args)

  if (DEBUG && Array.isArray(el)) error(`this will assign a context to your element, so an array won't work. instead, wrap these elements in a container element`)
  if (DEBUG && !isNode(el) && el != null && !el.then) error('you must return an element when creating a new context')

  if (el && el.then) {
    el.then(el => EL_CTX.set(el, ctx))
  } else {
    EL_CTX.set(el, ctx)
  }

  return el
}

// shortcut to remove myself from the dom (and cleanup if it's got nodes)
Node_prototype.rm = function () { return el_cleanup(this), this.remove() }
