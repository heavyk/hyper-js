
import { is_obv, ensure_obv, bind2 } from './observable'

// register a listener
export const on = (emitter, event, listener, opts = false) =>
  (emitter.on || emitter.addEventListener)
    .call(emitter, event, listener, opts)

// unregister a listener
export const off = (emitter, event, listener, opts = false) =>
  (emitter.off || emitter.removeListener || emitter.removeEventListener)
    .call(emitter, event, listener, opts)

// dispatch an event
// reading simulant source, it appears to be a bit more complicated than just this:
//  (but I'm not worrying about supporting old browsers). this is designed for modern browsers
// right now, val is simply being passed through... obviously it should set the correct fields though...
// which I'm going to just ignore for the time being...
export const dispatch_event = (element, event, val) => (element.dispatchEvent(new Event(event)), val)

export const prevent_default = (e) => e && e.preventDefault()

export function listen (element, event, attr, listener, do_immediately, opts) {
  let on_event = (e) => { listener(typeof attr === 'function' ? attr() : attr ? element[attr] : e) }
  on(element, event, on_event, opts)
  do_immediately && attr && on_event()
  return () => off(element, event, on_event, opts)
}

// observe any event, reading any attribute
export function obv_event (element, attr = 'value', event = 'keyup', event_filter, listener) {
  event_filter = typeof event_filter === 'function' ? event_filter
    : ((e) => e.which === 13 && !e.shiftKey)

  observable._obv = 'event'
  return observable

  function observable (val) {
    return (
      val === undefined ? val
    : typeof val !== 'function' ?  undefined //read only
    : (typeof listener === 'function' ? listener
        : (listener = (e) => event_filter(e) ? (val(element[attr], e), prevent_default(e), true) : false), // BADNESS!! val is defined in the observable function!
        (on(element, event, listener), () => {
          off(element, event, listener)
        })
      )
    )
  }
}


// returns an event listener (for example, to be used in combination with addEventListener)
// which will modify the value of `obv` whenever the returned function is called.
export function update_obv (obv, update_fn) {
  if (DEBUG) ensure_obv(obv)
  if (DEBUG) if (typeof update_fn !== 'function') error('update_fn should be a function which updates the obv value, eg. (v) => !v')
  return (evt) => obv(update_fn(obv(), evt))
}


//observe html element - aliased as `input`
export { attribute as input }
export function attribute (element, attr = 'value', event = 'input') {
  observable._obv = 'attribute'
  return observable

  function observable (val, do_immediately) {
    return (
      val === undefined ? element[attr]
    : typeof val !== 'function' ? dispatch_event(element, event, element[attr] = val)
    : listen(element, event, attr, val, do_immediately)
    )
  }
}

// observe a select element
export function select (element, attr = 'value', event = 'change') {
  const get_attr = (idx = element.selectedIndex) => ~idx ? element.options[idx][attr] : null
  const set_attr = (val) => {
    var options = element.options, i = 0
    for (; i < options.length; i++) {
      if (options[i][attr] == val) {
        // TODO: don't dispatch if the value is the same?
        return dispatch_event(element, event, get_attr(element.selectedIndex = i))
      }
    }
  }

  observable._obv = 'select'
  return observable

  function observable (val, do_immediately) {
    return (
      val === undefined ? element.options[element.selectedIndex][attr]
    : typeof val !== 'function' ? set_attr(val)
    : listen(element, event, get_attr, val, do_immediately)
    )
  }
}

//toggle based on an event, like mouseover, mouseout
export function toggle (el, up_event, down_event) {
  var _val = false
  const onUp = () => _val || val.call(el, _val = true)
  const onDown = () => _val && val.call(el, _val = false)

  observable._obv = 'toggle'
  return observable

  function observable (val) {
    return (
      val === undefined ? _val
    : typeof val !== 'function' ? undefined //read only
    : (on(el, up_event, onUp), on(el, down_event || up_event, onDown), () => {
        off(el, up_event, onUp); off(el, down_event || up_event, onDown)
      })
    )
  }
}

// TODO: maybe implement?
// it would be cool to be able to set these programatically. it's possible too.
// it's a little complicated though (see simulant).
// it could be useful for indicating to the user where they should bo looking next.

export function hover (e) { return toggle(e, 'mouseover', 'mouseout')}
export function touch (e) { return toggle(e, 'touchstart', 'touchend')}
export function mousedown (e) { return toggle(e, 'mousedown', 'mouseup')}
export function focus (e) { return toggle(e, 'focus', 'blur')}

// call like this `add_event.call(cleanupFuncs, el, listener, opts)`
// furthermore, it may be wise to make the `cleanupFuncs = this` for all these type of functions
export function add_event (e, event, listener, opts) {
  on(e, event, listener, opts)
  this.push(() => { off(e, event, listener, opts) })
}

// https://www.html5rocks.com/en/mobile/touchandmouse/
// https://www.html5rocks.com/en/mobile/touch/
// look into `passive: true` as a replacement for the `preventDefault` functionality.
export function do_boink (el, obv, opts) {
  this.push(
    listen(el, 'click', false, (ev) => { is_obv(obv) ? obv(!obv()) : obv.call(el, ev) }, 0, opts),
    listen(el, 'touchstart', false, (ev) => { prevent_default(ev); is_obv(obv) ? obv(!obv()) : obv.call(el, ev) }, 0, opts)
  )
}

export function do_press (el, obv, pressed = true, normal = false) {
  this.push(
    listen(el, 'mouseup', false, () => { obv(normal) }),
    listen(el, 'mousedown', false, () => { obv(pressed) }),
    listen(el, 'touchend', false, (e) => { prevent_default(e); obv(normal) }),
    listen(el, 'touchstart', false, (e) => { prevent_default(e); obv(pressed) })
  )
}

export function observe (el, observe_obj) {
  var s, cleanupFuncs = this
  for (s in observe_obj) ((s, v) => {
    // observable
    switch (s) {
      case 'input':
        cleanupFuncs.push(attribute(el, observe_obj[s+'.attr'], observe_obj[s+'.on'])(v))
        break
      case 'hover':
        cleanupFuncs.push(hover(el)(v))
        break
      case 'focus':
        cleanupFuncs.push(focus(el)(v))
        break
      case 'select_label':
        s = select(el, 'label')
        cleanupFuncs.push(
          is_obv(v)
            ? bind2(s, v)
            : s(v)
        )
        break
      case 'select': // default setter: by value
      case 'select_value':
        s = select(el)
        cleanupFuncs.push(
          is_obv(v)
            ? bind2(s, v)
            : s(v)
        )
        break
      case 'boink':
        do_boink.call(cleanupFuncs, el, v)
        break
      case 'press':
        do_press.call(cleanupFuncs, el, v)
        break
      default:
      // case 'keyup':
      // case 'keydown':
      // case 'touchstart':
      // case 'touchend':
        if (!~s.indexOf('.')) {
          if (typeof v !== 'function') error('observer must be a function')
          // if (s === 'edit') debugger
          cleanupFuncs.push(obv_event(el, observe_obj[s+'.attr'], (observe_obj[s+'.event'] || s), observe_obj[s+'.valid'])(v))
          // if (s === 'edit') debugger
        }
    }
  })(s, observe_obj[s])
}
