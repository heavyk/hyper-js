// super simple array of listeners.
// instead of splicing on removal (or some other expensive array modifying operation)
// it nulls out the listener.
// when emitting, if it encounters a null, it counts them up and if they reach a threshold:
// RUN_COMPACTOR_NULLS -- then the expensive compactor will run the compactor

import { remove_every as compactor } from '@hyper/utils'

// trigger all listeners
// old_val has to come first, to allow for things using it to do something like this:
// emit(emitters, current_val = val, current_val)
export function emit (listeners, old_val, val) {
  let fn, c = 0, i = 0
  for (; i < listeners.length; i++)
    if (typeof (fn = listeners[i]) === 'function') fn(val, old_val)
    else c++

  // if there are RUN_COMPACTOR_NULLS or more null values, compact the array on next tick
  if (c > RUN_COMPACTOR_NULLS) setTimeout(compactor, 1, listeners)
}

// remove a listener
export function remove (array, item) {
  let i = array.indexOf(item)
  if (~i) array[i] = null // in the compactor function, we explicitly check to see if it's null.
}
