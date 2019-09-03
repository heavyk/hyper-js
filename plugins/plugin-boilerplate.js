import { mergeDeep, objJSON, random_id, extend } from '../utils'

import { value } from '../dom/observable'
import ResizeSensor from '../dom/resize-sensor'

import { h } from '../dom/hyper-hermes'
import { doc, body, win, IS_LOCAL, basePath } from '../dom/dom-base'
import { isNode, getElementById } from '../dom/dom-base'
import { new_ctx, el_ctx, global_ctx } from '../dom/hyper-ctx'
// import { makeNode } from '../dom/hyper-hermes'

function pluginBoilerplate (frame, parentNode, _config, _data, DEFAULT_CONFIG, _onload, _afterload) {
  var tmp, mutationObserver, id, G, ctx, E, width, height, _dpr, args
  var C = mergeDeep({}, objJSON(_config), DEFAULT_CONFIG)

  if (IS_LOCAL) {
    tmp = body.style
    tmp.background = '#fff'
    tmp.fontFamily = 'Helvetica Neue,Helvetica,Arial,sans-serif'
    tmp.padding = tmp.margin = 0
  }

  // if a string is provided for the frame, try and find the frame by id, else make a fixud position full-size frame
  id = typeof frame === 'string'
    ? ((tmp = getElementById(frame)) && tmp.id) || frame
    : random_id()

  tmp = {
    s: {
      position: 'absolute',
      left: 0,
      top: 0,
      bottom: 0,
      right: 0,
      // width: '100%',
      // height: '100%',
      overflow: 'hidden'
    }
  }

  // this allows for custom listeners and/or styles to be added to the generated parentNode
  if (typeof parentNode === 'object' && !isNode(parentNode)) tmp = mergeDeep(tmp, parentNode)

  G = global_ctx()
  // frame = isNode(frame) ? frame : h('div#'+id, tmp)
  frame = new_ctx(G, ({h}=G) => {
    ctx = G // save the plugin frame's context
    return isNode(frame) ? frame : h('div#'+id, tmp)
  })

  if (!isNode(parentNode)) parentNode = body
  parentNode.aC(frame)

  // (mutationObserver = new MutationObserver((mutations) => {
  //   // since we only want to know if frame is detached, this is a better, more efficient way:
  //   if (!frame.parentNode) frame.cleanup()
  // })).observe(parentNode, { childList: true })

  win.GG = frame._G = G
  ctx.E = E = { frame: frame, body: doc.body, win: win }

  // @Incomplete - device orientation
  // https://crosswalk-project.org/documentation/tutorials/screens.html
  // https://developer.mozilla.org/en-US/docs/Web/API/CSS_Object_Model/Managing_screen_orientation
  tmp = screen.orientation
  G.o.orientation = value(tmp.type.split('-').concat(tmp.angle))
  tmp.onchange = function (e) { G.orientation((tmp = e.target).type.split('-').concat(tmp.angle)) }

  // TODO: add device motion events
  // https://developers.google.com/web/fundamentals/native-hardware/device-orientation/

  G.o.width = value(width = frame.clientWidth || C.width || 300)
  G.o.height = value(height = frame.clientHeight || C.height || 300)
  G.o.resize = value({width, height})

  if ((_dpr = Math.round(win.devicePixelRatio || 1)) > 4) _dpr = 4
  G.o.dpr = value(_dpr)

  frame._id = id

  ;(function (_cleanup) {
    frame.cleanup = () => {
      parentNode = frame.parentNode
      mutationObserver.disconnect()
      mutationObserver = null
      if (parentNode) parentNode.removeChild(frame)
      if (typeof _cleanup === 'function') _cleanup()
    }
  })(frame.cleanup)

  G.cleanupFuncs.push(frame.cleanup)

  // DEPRECATED!! - I don't like this at all!!
  // we're going to go with a new way of setting and getting
  // all initialised data are put in the D object, the D object will be  able to be cloned/serialised
  // these are the conditions (which are essentially the starting conditions)
  // they can either be values, objects (w/ sub-values), or obvs
  // after init, the only other time conditions are chaged, is if inst.reset({cond: 'new value'})
  // and then the template will be reset (remade) with the new condition's value
  // however, if reset({cond: my_obv}) is called with an observable, then the observable is used directly.
  // this is by design, because then that allows two different temcplates to use the same data structure
  //
  // if (!(set_config = frame.set_config)) {
  //   set_config = frame.set_config = value(C)
  //   set_config((C) => {
  //     var k, v, o
  //     console.log('setting config:', C)
  //     for (k in C) {
  //       v = C[k]
  //       if (typeof (o = G[k]) === 'undefined') {
  //         G[k] = value(v)
  //       } else {
  //         o(v)
  //       }
  //     }
  //   })
  // }

  extend(G, { C, G, E })

  // next thing is, `onload` should operate exactly the same as `reload`
  // it's just the function that is called which will return a working vdom.
  // the only difference between onload and reload is that cleanup is supposed to have been called between the two.

  ;(function (onload) {
    function loader () {
      var e, i = 0, resize
      // remove everything inside of the frame
      frame.empty()
      // while (e = frame.firstChild)
      //   frame.removeChild(e)

      // set the data (not really sure why it's done before comments are removed from the body)
      // if (_data) set_data(_data)

      // remove all html comments from the body (I rememeber they caused problems, but I don't remember exatly what..)
      while (e = body.childNodes[i])
        if (e.nodeName[0] === '#') body.rC(e)
        else i++

      // it would be really cool if this would work with generators, promises, async and normal functions
      // it wouldn't be difficult actually, just borrow some code from `co`
      // https://github.com/tj/co/blob/master/index.js
      if (typeof onload === 'function') {
        // e = makeNode(frame, onload.bind(e, args), h.cleanupFuncs)
        // frame.aC(e)
        // if (e = onload(args)) {
        if (e = new_ctx(G, onload)) {
          frame.aC(e)
          if (typeof _afterload === 'function') _afterload(frame, e)
        }
      }

      resize = new ResizeSensor(frame, () => {
        G.width(width = frame.clientWidth)
        G.height(height = frame.clientHeight)
        G.resize({width, height})
      })
      G.cleanupFuncs.push(() => resize.detach())
    }

    if (doc.body) setTimeout(loader, 1)
    else win.addEventListener('DOMContentLoaded', loader, false)
  })(_onload)

  return args
}

// re-exported
export { doc, body, win, IS_LOCAL }
export { pluginBoilerplate }
export default pluginBoilerplate
