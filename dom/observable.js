'use strict'

import { define_prop, define_props, define_value, define_getter, remove_every as compactor, error } from '@hyper/utils'

// knicked from: https://github.com/dominictarr/observable/blob/master/index.js
// mostly unmodified...
// * exported classes
// * remove utility functions (micro-optimization, reduces readability)
// * change from object traversal to arrays
//  * change all() from `for (var k in ary) ary[k](val)` -> `for (var i = 0; i < ary.length; i++) ary[i](val)`
//  * then, in remove() use `.splice` instead of `delete`. however, to avoid the case that a listener is removed from inside of a listener, the value is set to null and only compacted after 10 listeners have been removed
// * add `.observable` property to all returned functions (necessary for hyper-hermes to know that it's an observable instead of a context)
// * changed `value` to only propagate when the value has actually changed. to force all liseners to receive the current value, `call observable.set()` or `observable.set(observable())`
// * changed `.observable` property name to `._obv`
// (TODO) use isEqual function to compare values before setting the observable (this may not be necessary actually because objects should not really be going into observables)
// (TODO) add better documentation for each function

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
  var remove_l = l(r), remove_r = r(l)
  return () => { remove_l(); remove_r() }
}

// trigger all listeners
// old_val has to come first, to allow for things using it to do something like this:
// emit(emitters, current_val = val, current_val)
function emit (listeners, old_val, val) {
  for (var fn, c = 0, i = 0; i < listeners.length; i++)
    if (typeof (fn = listeners[i]) === 'function') fn(val, old_val)
    else c++

  // if there are RUN_COMPACTOR_NULLS or more null values, compact the array on next tick
  if (c > RUN_COMPACTOR_NULLS) setTimeout(compactor, 1, listeners)
}

// remove a listener
export function remove (array, item) {
  var i = array.indexOf(item)
  if (~i) array[i] = null // in the compactor function, we explicitly check to see if it's null.
}

// An observable that stores a value.
if (DEBUG) var VALUE_LISTENERS = 0
export function value (initialValue) {
  // if the value is already an observable, then just return it
  if (typeof initialValue === 'function' && initialValue._obv === 'value') return initialValue
  var _val = initialValue, listeners = []
  if (DEBUG) observable.gc = () => compactor(listeners)
  if (DEBUG) define_prop(observable, 'listeners', { get: observable.gc }) // only on DEBUG builds, is this is accessible.
  observable.set = (val) => emit(listeners, _val, _val = val === undefined ? _val : val)
  observable.once = (fn, do_immediately) => {
    var remove = observable((val, prev) => {
      fn(val, prev)
      remove()
    }, do_immediately)
    return remove
  }
  observable._obv = 'value'
  return observable

  function observable (val, do_immediately) {
    return (
      val === undefined ? _val                                                               // getter
    : typeof val !== 'function' ? (_val === val ? undefined : emit(listeners, _val, _val = val), val) // setter only sets if the value has changed (won't work for byref things like objects or arrays)
    : (listeners.push(val), (DEBUG && VALUE_LISTENERS++), (_val === undefined || do_immediately === false ? _val : val(_val)), () => {                 // listener
        remove(listeners, val)
        DEBUG && VALUE_LISTENERS--
      })
    )
  }
}

/*
// An observable that stores a number value.
export function number (initialValue) {
  // if the value is already an observable, then just return it
  if (typeof initialValue === 'function' && initialValue._obv === 'value') return initialValue
  var _val = initialValue, listeners = []
  // DEPRECATED! - I'm not very convinced that this function provides much value.
  //    it only saves having to call observable to retrieve the value.
  //    instead, I think it may be better to just make `_val` a property of ovservable
  error("DEPRECATED: please don't use this any more.")
  observable.set = (val) => emit(listeners, _val, _val = val === undefined ? _val : val)
  observable.add = (val) => observable(_val + (typeof val === 'function' ? val() : val))
  observable.mul = (val) => observable(_val * (typeof val === 'function' ? val() : val))
  observable._obv = 'value'
  return observable

  function observable (val, do_immediately) {
    return (
      val === undefined ? _val                                                               // getter
    : typeof val !== 'function' ? (_val === val ? undefined : emit(listeners, _val, _val = val), val) // setter only sets if the value has changed (won't work for byref things like objects or arrays)
    : (listeners.push(val), (_val === undefined || do_immediately === false ? _val : val(_val)), () => {                 // listener
        remove(listeners, val)
      })
    )
  }
}
*/

// an observable object
export function obv_obj (initialValue, _keys) {
  // if the value is already an observable, then just return it
  // this is actually incorrect, because maybe we want a new object that observes different keys
  // this kind of needs a little more thought, I think :)
  if (initialValue && initialValue._obv === 'object') return initialValue

  var obj = {}
  var obvs = {}
  var keys = []
  var props = {
    _obv: define_value('object'),
    // TODO: implement get/set,on/off for compatibility with scuttlebutt?
    get: define_value((path, default_value) => {
      var o = obj, p, paths = Array.isArray(path) ? path
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
  observable._obv = 'property'
  return observable

  function observable (val) {
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
export function compute (observables, compute_fn) {
  var is_init = true, len = observables.length
  var obv_vals = new Array(len)
  var listeners = [], removables = [], cur_value, fn

  // the `let` is important here, as it makes a scoped variable used inside the listener attached to the obv. (var won't work)
  for (let i = 0; i < len; i++) {
    fn = observables[i]
    if (typeof fn === 'function') {
      if (DEBUG) ensure_obv(fn)
      removables.push(fn((v) => {
        var prev = obv_vals[i]
        obv_vals[i] = v
        if (prev !== v && is_init === false) observable(compute_fn.apply(null, obv_vals))
      }, is_init))
    } else {
      // items in the observable array can also be literals
      obv_vals[i] = fn
    }
  }

  observable._obv = 'value'
  if (DEBUG) observable.gc = () => compactor(listeners)
  if (DEBUG) define_prop(observable, 'listeners', { get: observable.gc })
  observable.cleanup = () => { for (fn of removables) fn() }

  cur_value = compute_fn.apply(null, obv_vals)
  is_init = false

  return observable

  function observable (arg, do_immediately) {
    // this is probably the clearest code I've ever written... lol
    return (
      arg === undefined ? (                 // 1. to arg: getter... eg. obv()
        cur_value === undefined ? (
          cur_value = compute_fn.apply(null, obv_vals))
      : cur_value)
    : typeof arg !== 'function' ? (         // 2. arg is a value: setter... eg. obv(1234)
      cur_value === arg ? undefined         // same value? do nothing
      : emit(listeners, cur_value, cur_value = arg), arg) // emit changes to liseners
    : (listeners.push(arg),                 // arg is a function. add it to the listeners
      (DEBUG && COMPUTE_LISTENERS++),       // dev code to help keep leaks from getting out of control
      (do_immediately === false ? 0         // if do_immediately === false, do notihng
        : arg(cur_value)),                  // otherwise call the listener with the current value
      () => { remove(listeners, arg); DEBUG && COMPUTE_LISTENERS-- }) // unlisten function
    )
  }
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

export function observable_property (obj, key, o) {
  define_prop(obj, key, define_getter((v) => { o(v) }, () => o()))
  return () => { define_prop(obj, key, define_value(o(), true)) }
}

export function PRINT_COUNTS () {
  let counts = { value: VALUE_LISTENERS, compute: COMPUTE_LISTENERS }
  console.log(counts)
  return counts
}


// older stuff
