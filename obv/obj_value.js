import is_equal from '@hyper/isEqual'
import { define_prop } from '@hyper/utils'
import { remove_every as compactor } from '@hyper/utils'

import { emit, remove } from '@hyper/listeners'

// An observable that stores an object value and uses does a deep object comparison.
if (DEBUG) var OBJ_VALUE_LISTENERS = 0
export default function obj_value (initial) {
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
    : typeof val !== 'function' ? (is_equal(obv.v, val) ? undefined : emit(listeners, obv.v, obv.v = val), val) // setter only sets if the value has changed (won't work for byref things like objects or arrays)
    : (listeners.push(val), (DEBUG && OBJ_VALUE_LISTENERS++), (obv.v === undefined || do_immediately === false ? obv.v : val(obv.v)), () => {                 // listener
        remove(listeners, val)
        DEBUG && OBJ_VALUE_LISTENERS--
      })
    )
  }
}
