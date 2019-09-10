'use strict'

import { define_prop, define_props, define_value, define_getter, remove_every as compactor, error } from '@hyper/utils'
import { emit, remove } from '@hyper/listeners'

// knicked from: https://github.com/dominictarr/observable/blob/master/index.js
// * exported classes
// * remove utility functions (micro-optimization, reduces readability)
// * change from object traversal to arrays
//  * change all() from `for (var k in ary) ary[k](val)` -> `for (var i = 0; i < ary.length; i++) ary[i](val)`
//  * then, in remove() use `.splice` instead of `delete`. however, to avoid the case that a listener is removed from inside of a listener, the value is set to null and only compacted after 10 listeners have been removed
// * add `._obv` property to all returned functions (necessary for hyper-hermes to know that it's an observable instead of a context)
// * changed `value` to only propagate when the value has actually changed. to force all liseners to receive the current value, `call observable.set()` or `observable.set(observable())`


export function ensure_obv (obv) {
  if (typeof obv !== 'function' || typeof obv._obv !== 'string')
    error('expected an observable')
}


// one-way binding: bind lhs to rhs -- starting with the rhs value
export function bind1 (l, r) {
  l(r())
  return r(l)
}

// two-way binding: bind lhs to rhs and rhs to lhs -- starting with the rhs value
export function bind2 (l, r) {
  l(r())
  let remove_l = l(r), remove_r = r(l)
  return () => { remove_l(); remove_r() }
}

// An observable that stores a value.
if (DEBUG) var VALUE_LISTENERS = 0
export function value (initial) {
  let listeners = []
  // if the value is already an observable, then just return it
  if (typeof initial === 'function' && initial._obv === 'value') return initial
  if (DEBUG) obv.gc = () => compactor(listeners)
  if (DEBUG) define_prop(obv, 'listeners', { get: obv.gc })
  obv.v = initial
  obv.set = (val) => emit(listeners, obv.v, obv.v = val === undefined ? obv.v : val)
  obv.once = (fn, do_immediately) => {
    let remove = obv((val, prev) => {
      fn(val, prev)
      remove()
    }, do_immediately)
    return remove
  }
  obv._obv = 'value'
  return obv

  function obv (val, do_immediately) {
    return (
      val === undefined ? obv.v                                                               // getter
    : typeof val !== 'function' ? (obv.v === val ? undefined :
      (DEBUG && (typeof val === 'object' && Object.prototype.toString.call(val) === '[object Object]') && error('use obv/obj_value to store plain objects (it properly deep compares them)')),
      emit(listeners, obv.v, obv.v = val), val) // setter only sets if the value has changed (won't work for byref things like objects or arrays)
    : (listeners.push(val), (DEBUG && VALUE_LISTENERS++), (obv.v === undefined || do_immediately === false ? obv.v : val(obv.v)), () => {                 // listener
        remove(listeners, val)
        DEBUG && VALUE_LISTENERS--
      })
    )
  }
}


// an observable object
// @Incomplete: find a solution here because this isn't necessarily possible to be used with `pure_getters`
export function obv_obj (initialValue, _keys) {
  // if the value is already an observable, then just return it
  // this is actually incorrect, because maybe we want a new object that observes different keys
  // this kind of needs a little more thought, I think :)
  if (initialValue && initialValue._obv === 'object') return initialValue

  let obj = {}
  let obvs = {}
  let keys = []
  let props = {
    _obv: define_value('object'),
    // TODO: implement get/set,on/off for compatibility with scuttlebutt?
    get: define_value((path, default_value) => {
      let o = obj, p, paths = Array.isArray(path) ? path
        : typeof path === 'string' && ~path.indexOf('.') ? path.split('.')
        : [path]

      while (p = paths.unshift()) {
        if ((o = obj[p]) === undefined) {
          o = obj[p] = {}
        }
      }

      return o
    }),
    set: define_value((v) => {
      for (let k of keys) {
        if (obvs[k] && v[k]) obvs[k](v[k])
      }
    })
  }

  for (let k of Array.isArray(_keys) ? _keys : Object.keys(initialValue)) {
    let _obv, v = initialValue[k]
    if (v !== undefined) {
      if (v._obv === 'value') obvs[k] = v, keys.push(k)
      else if (v._obv) props[k] = define_value(v)
      else keys.push(k)
    }
  }

  for (let k of keys) props[k] = define_getter(              // define_getter defaults to allow the prop to be enumerable and reconfigurable
    () => (obvs[k] || (obvs[k] = value(initialValue[k])))(), // get
    (v) => obvs[k](v)                                        // set
  )

  // @Incomplete - needs to have cleanup. what's the point of observing something if you can't listen to its changes...
  //               which means you'll need to stop listening at some point, too
  define_props(obj, props)
  return obj
}

/*
##property
observe a property of an object, works with scuttlebutt.
could change this to work with backbone Model - but it would become ugly.
*/

export function property (model, key) {
  obv._obv = 'property'
  return obv

  function obv (val) {
    return (
      val === undefined ? model.get(key)
    : typeof val !== 'function' ? model.set(key, val)
    : (on(model, 'change:'+key, val), val(model.get(key)), () => {
        off(model, 'change:'+key, val)
      })
    )
  }
}


// @Improvement:
// there is an inefficiency here where `down` will get called as many times as there are listeners.
// it's just a middle-man.
// it could be improved to store its own listeners and only subscribe to obv when it has listenrs.

// listens to `obv`, calling `down` with the value first before passing it on to the listener
// when set, it'll call `up` (if it's set), otherwise `down` with the set value before setting
// that transformed value in `obv`
export function transform (obv, down, up) {
  if (DEBUG) ensure_obv(obv)

  observable._obv = obv._obv
  return observable

  function observable (arg, do_immediately) {
    return (
      arg === undefined ? down(obv())
    : typeof arg !== 'function' ? obv((up || down)(arg))
    : obv((cur, old) => { arg(down(cur, old)) }, do_immediately)
    )
  }
}



// transform an array of obvs
if (DEBUG) var COMPUTE_LISTENERS = 0
export function compute (obvs, compute_fn) {
  let is_init = true, len = obvs.length
  let obv_vals = new Array(len)
  let listeners = [], removables = [], fn

  // the `let` is important here, as it makes a scoped variable used inside the listener attached to the obv. (var won't work)
  for (let i = 0; i < len; i++) {
    fn = obvs[i]
    if (typeof fn === 'function') {
      if (DEBUG) ensure_obv(fn)
      removables.push(fn((v) => {
        let prev = obv_vals[i]
        obv_vals[i] = v
        if (prev !== v && is_init === false) obv(compute_fn.apply(null, obv_vals))
      }, is_init))
    } else {
      // items in the obv array can also be literals
      obv_vals[i] = fn
    }
  }

  obv._obv = 'value'
  if (DEBUG) obv.gc = () => compactor(listeners)
  if (DEBUG) define_prop(obv, 'listeners', { get: obv.gc })
  obv.cleanup = () => { for (fn of removables) fn() }

  obv.v = compute_fn.apply(null, obv_vals)
  is_init = false

  return obv

  function obv (arg, do_immediately) {
    // this is probably the clearest code I've ever written... lol
    return (
      arg === undefined ? (                 // 1. to arg: getter... eg. obv()
        obv.v === undefined ? (
          obv.v = compute_fn.apply(null, obv_vals))
      : obv.v)
    : typeof arg !== 'function' ? (         // 2. arg is a value: setter... eg. obv(1234)
      obv.v === arg ? undefined             // same value? do nothing
      : emit(listeners, obv.v, obv.v = arg), arg) // emit changes to liseners
    : (listeners.push(arg),                 // arg is a function. add it to the listeners
      (DEBUG && COMPUTE_LISTENERS++),       // dev code to help keep leaks from getting out of control
      (do_immediately === false ? 0         // if do_immediately === false, do notihng
        : arg(obv.v)),                      // otherwise call the listener with the current value
      () => { remove(listeners, arg); DEBUG && COMPUTE_LISTENERS-- }) // unlisten function
    )
  }
}

export function calc (obvs, compute_fn) {
  let len = obvs.length, fn
  let obv_vals = new Array(len)

  // the `let` is important here, as it makes a scoped variable used inside the listener attached to the obv. (var won't work)
  for (let i = 0; i < len; i++) {
    obv_vals[i] = typeof (fn = obvs[i]) === 'function' ? fn() : fn
  }

  return compute_fn.apply(null, obv_vals)
}

export function boolean (obv, truthy, falsey) {
  return (
    transform(obv,
      (val) => val ? truthy : falsey,
      (val) => val == truthy ? true : false
    )
  )
}

export function is_obv (obv, type = null) {
  return typeof obv === 'function' && ((!type && obv._obv) || obv._obv === type)
}

export function obv_property (obj, key, o) {
  define_prop(obj, key, define_getter((v) => { o(v) }, () => o()))
  return () => { define_prop(obj, key, define_value(o(), true)) }
}

export function PRINT_COUNTS () {
  let counts = { value: VALUE_LISTENERS, compute: COMPUTE_LISTENERS }
  console.log(counts)
  return counts
}


// older stuff
