
import { empty_array, extend, swap, define_prop, define_getter, error } from '@hyper/utils'
import { is_obv, value } from '@hyper/dom/observable'
import { new_ctx } from '@hyper/dom/hyper-ctx'
import ObservableArray from '@hyper/dom/observable-array'

// G: ctx from which to inherit sub ctxs
// data: an ObservableArray of values which will be transformed into a dom reprenstation by `fn`
// fn: function receiving 1-3 arguments: (d, ctx, idx) for each item in the array
// opts:
//   plain: true/false - the data passed for each value in the array is a plain object or value/obv_object
//   min: [number] - render at least n items always. for items that are empty, call opts.empty_fn instead
//   empty_fn: [function] - @Incomplete: should receive (idx).
export default class RenderingArray extends ObservableArray {
  constructor (G, data, fn, opts = {}) {
    super()
    opts = extend({ plain: true }, opts)
    let k, fl, self = this
    self.fn = typeof data === 'function' ? (fn = data) : fn
    fl = self.fl = fn.length
    self.G = G
    self.d = data instanceof ObservableArray ? data : new ObservableArray() && DEBUG && error('data must be a ObservableArray')
    // this should have cleanupFuncs in the context (which adds h/s cleanup to the list when it makes the context)
    G.z(() => { self.cleanup() })

    // where we store the id/data which gets passed to the rendering function
    self._d = []
    // if (fl >= 2) self._ctx = []
    if (fl >= 3) self._idx = []

    // assigns options to `self`
    for (k in opts) self[k] = opts[k]

    // if data has length, then render and add each of them
    self.data(data)

    // finally, if min is an obv, it'll want to ensure any missing empty ones are rendered
    if (k = opts.min) {
      self.empty_fn = typeof opts.empty_fn === 'function' ? opts.empty_fn : () => 'empty'
      if (is_obv(k)) k((new_min) => {
        let real_len = self.length
        let empty_els = real_len - self._d.length
        let to_add = new_min - empty_els
        if (to_add < 0) super.splice(real_len + to_add, -to_add) // chop everything off the end
        if (to_add > 0) for (; to_add > 0; to_add--) super.push(self.empty_fn(real_len++))
        self.min = new_min
      })
    }
  }

  data (data) {
    let self = this
    const onchange = self._onchange = (e) => {
      let v, t, i, j, k
      let len = self._d.length
      let fl = self.fl
      let type = e.type
      let min = +self.min || 0
      switch (type) {
        // @Leak: perhaps check to see if idx obvs do not have any listeners
        case 'swap':
          if ((i = e.from) < 0) i += len // -idx
          if ((j = e.to) < 0) j += len   // -idx
          if (fl >= 1) swap(self._d, j, i)
          // if (fl >= 2) swap(self._ctx, j, i)
          if (fl >= 3) {
            self._idx[i](j)
            self._idx[j](i)
            swap(self._idx, j, i)
          }
          swap(self, j, i)
          break
        case 'move':
          if ((i = e.from) < 0) i += len // -idx
          if ((j = e.to) < 0) j += len   // -idx
          if (fl >= 1) v = self._d.splice(i, 1), self._d.splice(j, 0, v[0])
          // if (fl >= 2) v = self._ctx.splice(i, 1), self._ctx.splice(j, 0, v[0])
          if (fl >= 3) {
            v = self._idx.splice(i, 1), self._idx.splice(j, 0, v[0])
            self._idx[i](j)
            self._idx[j](i)
          }
          v = super.splice(i, 1), super.splice(j, 0, v[0])
          break
        case 'set':
          if ((i = e.idx) < 0) i += len // -idx
          v = e.val
          super[i] = v
          if (fl >= 1) self._d[i].set(v)
          break
        case 'unshift':
          i = 0
          // make space in storage arrays by splicing in undefined values (to be filled in by fn_call)
          v = new Array(e.values.length)
          if (fl >= 1) self._d.splice(0, 0, ...v)
          // if (fl >= 2) self._ctx.splice(0, 0, ...v)
          if (fl >= 3) self._idx.splice(0, 0, ...v)
          for (v of e.values) super.unshift(self.fn_call(v, i++))
          if (fl >= 3) for (; i < len; i++) self._idx[i](i)
          if (min && (i = min - len - v.length) > 0) super.splice(-i, i) // remove that many values from the end of the rendering array
          break
        case 'push':
          j = len
          i = len + e.values.length
          t = []
          // make space in storage arrays
          if (fl >= 1) self._d.length = i
          // if (fl >= 2) self._ctx.length = i
          if (fl >= 3) self._idx.length = i
          i = Math.min(i, min) - len
          for (v of e.values) t.push(self.fn_call(v, len++))
          // calculate how many elements need to be removed and remove or push
          if (i > 0) super.splice(j, i, ...t)
          else super.push(...t)
          break
        case 'splice':
          if ((i = e.idx) < 0) i += len // -idx
          j = e.remove
          // make space in storage arrays by splicing in undefined values (to be filled in by fn_call)
          v = new Array(k = e.add.length)
          if (fl >= 1) self._d.splice(i, j, ...v)
          // if (fl >= 2) t = self._ctx.splice(i, j, ...v)
          if (fl >= 3) self._idx.splice(i, j, ...v)
          // for (v of t) v.cleanup()
          t = [] // temp array to save rendered elements
          len += k - j
          k = i
          for (v of e.add) t.push(self.fn_call(v, k++))
          if (fl >= 3) for (k = i; k < len; k++) self._idx[k](k)
          super.splice(i, j, ...t)
          if (min) {
            i = min - len
            if (i < 0) super.splice(i, -i)
            if (i > 0) super.push(...empty_array(i, self.empty_fn))
          }
          break
        case 'remove':
          if ((i = e.idx) < 0) i += len // -idx
          if (fl >= 1) self._d.splice(i, 1)
          // if (fl >= 2) self._ctx.splice(i, 1)[0].cleanup()
          if (fl >= 3) self._idx.splice(i, 1)
          super.splice(i, 1)
          if (min >= len) super.push(self.empty_fn())
          if (fl >= 3) for (len--; i < len; i++) self._idx[i](i)
          break
        case 'replace':
        case 'insert':
          if ((i = e.idx) < 0) i += len // -idx
          j = type === 'replace' ? 1 : 0
          if (fl >= 1) self._d.splice(i, j, null)
          // if (fl >= 2) v = self._ctx.splice(i, j, null)
          if (fl >= 3) self._idx.splice(i, j, null)
          super.splice(i, j, self.fn_call(e.val, i))
          if (j > 0) {
            // replace
            // if (fl >= 2 && v[0]) v[0].cleanup()                        // replace: clean up old ctx
          } else {
            // insert
            if (fl >= 3) for (; i <= len; i++) self._idx[i](i)   // insert: update the indexes
            if (len <= min) super.pop()
          }
          break
        case 'sort':
          t = []
          i = min - len
          if (min && i > 0) v = super.splice(-i, i)
          let listen = (e) => { t.push(e) }
          self.d.on('change', listen)
          self.d.sort(e.compare)
          self.d.off('change', listen)
          for (v of t) super.emit('change', v)
          if (min && i > 0) v = super.splice(-i, 0, ...v)
          break
        case 'empty':
          super.empty()
          if (fl >= 1) self._d.length = 0
          // if (fl >= 2) { for (v of self._ctx) { v.cleanup() } self._ctx.length = 0 }
          if (fl >= 3) self._idx.length = 0
          if (min) super.push(...empty_array(min, self.empty_fn))
          break
        // no args
        case 'reverse':
          // reverse the indexes
          for (i = 0; i < len; i++) self._idx[i](len - i - 1)
          // set len to 0 so we don't cleanup() or shift the idx
          len = 0
          // nobreak
        case 'shift':
          if (len) for (i = 1; i < len; i++) self._idx[i](i - 1)
          // nobreak
        case 'pop':
          self._d[type]()
          // if ((v = self._ctx[type]()) && len) v.cleanup()
          self._idx[type]()
          super[type]()
          if (min && len && min > len) super.push(self.empty_fn())
          break
      }
    }

    if (data instanceof ObservableArray) {
      let i = 0, len = data.length, min = +self.min || 0, _d = []

      // empty / cleanup the array
      // @Optimise: technically, the array doesn't need to be emptied at all...
      //   just update the values of self._d for each one, then push on (or splice off) the difference
      if (self.length > 0) self.empty()

      if (len || min) {
        for (; i < len; i++) _d.push(self.fn_call(data[i], i))
        if (min > len) for (; i < min; i++) _d.push(self.empty_fn(i))
        super.push(..._d)
      }

      if (self._obv_len) self._obv_len(len)
      self.d.off('change', onchange)
      self.d = data
      define_prop(self, 'obv_len', define_getter(() => self.d.obv_len))
      data.on('change', onchange)
    }

    return self.d
  }

  fn_call (d, idx) {
    let { fl, fn, G } = this // @Incomplete: add _d, and _idx
    let __d, __idx
    if (fl === 0) return fn()
    else {
      __d = this._d[idx] || (this._d[idx] = this.plain ? d : typeof d === 'object' ? obv_obj(d) : value(d))
      if (fl === 1) return fn(__d)
      else {
        if (fl === 2) return new_ctx(this.G, fn, __d)
        else { //if (fl === 3) {
          // TODO: check to see if this observable needs to be cleaned up (I don't think so, anyway, but maybe I'm wrong)
          __idx = this._idx[idx] || (this._idx[idx] = value(idx))
          return new_ctx(G, fn, __d, __idx)
        }
      }
    }
  }

  cleanup () {
    // clean up contexts (and remove any arrayFragment elements too)
    this._onchange({type: 'empty'})
    // stop listening to data changes (in case the data element is used in more than one place)
    this.d.off('change', this._onchange)
  }
}

;(() => {
  // so it garbage collects...
  let proto = RenderingArray.prototype
  for (let p of ['swap','move','set','unshift','push','splice','remove','replace','insert','sort','empty','pop','reverse','shift','setPath'])
    proto[p] = function () { return this.d[p].apply(this.d, arguments) }
})()

// RenderingArray is already some pretty dense code,
// however, it would be nice to make a fixed size
// version which only renders a 'window' of the data.
// when the window is bigger than the data size, it'll show
// empty spots. and when the window is smaller than the data,
// it can optionally include call a function which inserts dummy elements or resizes
// some ending elements to simulate the data existing farther up in the scroll.

// some options would be to simply copy and paste the majority of the code, or to
// try and do everything with options in RenderingArray.
//
// the idea of making extra space on the top/bottom to simulate more data being there
// than is rendered would nearly require a whole separate functin -- cept there would
// *still* be 80% or more duplicated code.

// for stuff like this, I really wish js had jon's jai macros!!! (LOL, I know..)

// export class FixedSizeRenderingArray extends RenderingArray {
//   constructor (G, data, fn, size, fn_empty, opts) {
//     super(G, data, fn, opts)
//     this.fne = fn_empty
//   }
// }
