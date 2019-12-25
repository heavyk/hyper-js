import MixinEmitter from '@hyper/drip/MixinEmitter'
import { value } from '@hyper/dom/observable'
import { empty_array, extend, swap, define_prop, define_getter, error } from '@hyper/utils'
import isEqual from '@hyper/isEqual'
// import invoke from '@hyper/lodash/invoke'
// import set from '@hyper/lodash/set'

export default class ObservableArray extends MixinEmitter(Array) {
  // this is so all derived objects are of type Array, instead of ObservableArray
  static get [Symbol.species]() { return Array }
  constructor (array) {
    super()
    this.observable = 'array'
    this._up()
    define_prop(this, 'obv_len', define_getter(() => this._obv_len || (this._obv_len = value(this.length))))
    if (Array.isArray(array) && array.length) super.push(...array)
  }

  pop () {
    if (!this.length) return
    this.emit('change', { type: 'pop' })
    let ret = super.pop()
    this._up()
    return ret
  }

  push (...items) {
    if (!items.length) return this.length
    this.emit('change', { type: 'push', values: items })
    let ret = super.push(...items)
    this._up()
    return ret
  }

  reverse () {
    if (this.length <= 1) return this
    this.emit('change', { type: 'reverse' })
    return super.reverse()
  }

  shift () {
    if (!this.length) return
    this.emit('change', { type: 'shift' })
    let ret = super.shift()
    this._up()
    return ret
  }

  swap (from_idx, to_idx) {
    this.emit('change', {type: 'swap', from: from_idx, to: to_idx })
    // let el = super.splice(from_idx, 1)
    // super.splice(to_idx, 0, el[0])
    swap(this, to_idx, from_idx)
  }

  sort (compare) {
    // implementation of selection sort
    // (it's more compares, but the fewest number of swaps, which is better for dom performance)
    if (this.length <= 1) return this
    let i = 0, j, k, a = this, l = a.length
    for (; i < l; i++) {
      // smallest index val
      k = i
      for (j = i+1; j < l; j++) {
        if (compare(a[j], a[k]) <= 0) k = j
      }

      if (k !== i) {
        this.emit('change', {type: 'swap', from: k, to: i })
        swap(a, i, k)
      }
    }

    return this
  }

  shuffle () {
    for (let i = 0, len = this.length; i < len;) {
      this.swap(i, Math.floor(Math.random() * (++i)))
    }
  }

  empty () {
    if (this.length > 0) {
      this.emit('change', { type: 'empty' })
      this.length = 0
      this._up()
    }
    return this
  }

  reset (items) {
    // this should be smarter. it should only do the differenc between this and items
    this.empty()
    if (Array.isArray(items)) this.push(...items)
    return this
  }

  replace (idx, val) {
    this.emit('change', { type: 'replace', val, idx, old: this[idx] })
    super.splice(idx, 1, val)
    return this
  }

  move (from_idx, to_idx) {
    this.emit('change', { type: 'move', from: from_idx, to: to_idx })
    let el = super.splice(from_idx, 1)
    super.splice(to_idx, 0, el[0])
    return this
  }

  insert (idx, val) {
    this.emit('change', { type: 'insert', val, idx })
    super.splice(idx, 0, val)
    this._up()
    return this
  }

  remove (idx) {
    if (typeof idx !== 'number') {
      let iidx = this.indexOf(idx)
      if (~iidx) idx = iidx
      else return this
    }
    this.emit('change', { type: 'remove', idx })
    super.splice(idx, 1)
    this._up()
    return this
  }

  splice (idx, remove, ...add) {
    if (idx === undefined || (remove !== undefined && (+idx >= this.length || +remove <= 0))) return []
    this.emit('change', { type: 'splice', idx, remove, add })
    let ret = super.splice(idx, remove, ...add)
    this._up()
    return ret
  }

  unshift (...items) {
    if (!items.length) return this.length
    this.emit('change', { type: 'unshift', values: items })
    let ret = super.unshift(...items)
    this._up()
    return ret
  }

  set (idx, val) {
    if (idx < 0) idx += this.length
    if (isEqual(this[idx], val)) return
    this.emit('change', { type: 'set', idx, val })
    this[idx] = val
    return this
  }

  // @Optimise: move this out to a separate file, so that
  //            lodash/set and lodash/invoke dependencies aren't pulled in.
  //            (it was only used once in a project from a while ago)
  // setPath (idx, path, value) {
  //   let obj = this[idx]
  //   // in case it's an observable, no need to emit the event
  //   if (obj.observable === 'object') invoke(obj, path, value)
  //   else {
  //     set(obj, path, value)
  //     this.emit('change', { type: 'set', idx, val: obj })
  //   }
  //   return obj
  // }

  // utility to update after an operation
  _up () {
    if (this._obv_len) this._obv_len(this.length)
  }
}

// this function is to replicate changes made to one obv arr to another one(s)
export function ObservableArrayApplies (oarr, ...arr) {
  oarr.on('change', (e) => {
    let a, t
    switch (e.type) {
      case 'swap':
        for (a of arr) {
          t = a[e.to]
          a[e.to] = a[e.from]
          a[e.from] = t
        }
        break
      case 'move':
        for (a of arr) {
          t = a.splice(e.from, 1)
          a.splice(e.to, 0, t[0])
        }
        break
      case 'set':
        for (a of arr) a[e.idx] = e.val
        break
      case 'unshift':
        for (a of arr) a.unshift(...e.values)
        break
      case 'push':
        for (a of arr) a.push(...e.values)
        break
      case 'splice':
        for (a of arr) a.splice(e.idx, e.remove, ...e.add)
        break
      case 'remove':
        for (a of arr) a.splice(e.idx, 1)
        break
      case 'replace':
        for (a of arr) a.splice(e.idx, 1, e.val)
        break
      case 'insert':
        for (a of arr) a.splice(e.idx, 0, e.val)
        break
      case 'sort':
        for (a of arr) a.sort(e.compare)
        break
      case 'empty':
        for (a of arr) a.length = 0
        break
      // no args
      case 'pop':
      case 'reverse':
      case 'shift':
        for (a of arr) a[e.type]()
        break
    }
  })
}

export function ObservableArrayChange (arr, evt, t) {
  switch (evt.type) {
    case 'swap':
      t = arr[evt.to]
      arr[evt.to] = arr[evt.from]
      arr[evt.from] = t
      break
    case 'move':
      t = arr.splice(evt.from, 1)
      arr.splice(evt.to, 0, t[0])
      break
    case 'set':
      t = arr[evt.idx]
      arr[evt.idx] = evt.val
      break
    case 'unshift':
      arr.unshift(...evt.values)
      break
    case 'push':
      arr.push(...evt.values)
      break
    case 'splice':
      arr.splice(evt.idx, evt.remove, ...evt.add)
      break
    case 'remove':
      arr.splice(evt.idx, 1)
      break
    case 'replace':
      arr.splice(evt.idx, 1, evt.val)
      break
    case 'insert':
      arr.splice(evt.idx, 0, evt.val)
      break
    case 'sort':
      arr.sort(evt.compare)
      break
    case 'empty':
      arr.length = 0
      break
    // no args
    case 'pop':
    case 'reverse':
    case 'shift':
      arr[evt.type]()
      break
  }
}

export function ObservableArrayApply (oarr, arr) {
  oarr.on('change', (evt) => ObservableArrayChange(oarr, evt))
}
