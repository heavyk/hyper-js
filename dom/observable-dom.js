import { value } from '@hyper/lib/dom/observable'
import { comment } from '@hyper/lib/dom/dom-base'
import { new_ctx, el_ctx } from '@hyper/lib/dom/hyper-ctx'
import { random_id, __debug } from '@hyper/lib/utils'

// I have been considering using the dom for the ctx lookup,
// recursively looking up the heierarchy for something like ._ctx (see `el_ctx`)
//
// that, potentially would make things a bit easier, but I dunno yet, so for now we pass `G`
// in the future, perhaps I want to instead make `this` become the `G`
//
// another idea is to store named contexts in `G` since we're already passing them around.
// the best thing would be to do both: store the named contexts in `G` and have local contexts as well.

// a section, really is just an observable that provides a context, then cleans up that context when it's done
export function section (G, name, fn) {
  error('not working properly after ctx changes')
  var section_name = typeof name == 'string' ? name : (fn = name, random_id())
  let el = this[section_name] || (this[section_name] = value())
  if (typeof fn === 'function') {
    let local_ctx = get_context(section_name + '_ctx')
    G.z(() => local_ctx.cleanup())
    el(fn.call(this, local_ctx))
  } else {
    el(comment('SECTION:' + name))
  }
  G._sections[name] = __debug()

  return el
}

function get_context (G, el) {
  error('not implemented')
  var ctx =
    typeof el === 'object' ? (el_ctx(el) || el._G = new_ctx(G)) :
    typeof el === 'string' ? G._ctx[el] ||
  // if (typeof el !== 'string') el = el_ctx(el)
  // return
  // this[ns] || (this[ns] = ctx = new_ctx({h, s}),
  //   h.x.push(() => { ctx.cleanup() }), ctx) // return the ctx, not the return value of push
}
