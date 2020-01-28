
import { each, assign, next_tick, int } from '@hyper/utils'
import { win, body, getComputedStyle } from '@hyper/dom/dom-base'
import { on, off } from '@hyper/dom/dom-base'
import { get_prop_value, int_prop_value, sum_prop_values } from '@hyper/dom/dom-base'

import raf from '@hyper/dom/request-animation-frame'

import h from '@hyper/dom/hyper-hermes'

function nlElastic (node, keypath, padding = 24) {
  let ta = node
  let $ta = node

  // exit if elastic already applied (or is the mirror element)
  if ($ta.dataset.elastic) return

  // ensure the element is a textarea, and browser is capable
  if (ta.nodeName !== 'TEXTAREA' || (SUPPORT_ANCIENT && !getComputedStyle)) return

  // set these properties before measuring dimensions
  assign($ta.style, {
    overflow: 'hidden',
    overflowY: 'hidden',
    wordWrap: 'break-word',
  })

  // force text reflow
  var text = ta.value
  ta.value = ''
  ta.value = text

  if (IS_RACTIVE) var ractive = Ractive.getNodeInfo(node).ractive
  let mirrorInitStyle = 'position: absolute; top: -999px; right: auto; bottom: auto;' +
      'left: 0; overflow: hidden; box-sizing: content-box;' +
      (SUPPORT_ANCIENT ? '-webkit-box-sizing: content-box; -moz-box-sizing: content-box;') +
      'min-height: 0 !important; height: 0 !important; padding: 0;' +
      'word-wrap: break-word; border: 0;'
  let mirror = h('textarea', {
      aria: { hidden: 'true' },
      tabindex: -1,
      style: mirrorInitStyle,
      data: { elastic: true },
    })
  let taStyle = getComputedStyle(ta)
  let resize = get_prop_value(taStyle, 'resize')
  let borderBox = get_prop_value(taStyle, 'box-sizing') === 'border-box' || (SUPPORT_ANCIENT && (
      get_prop_value(taStyle, '-moz-box-sizing') === 'border-box' ||
      get_prop_value(taStyle, '-webkit-box-sizing') === 'border-box'))
  let boxOuter = !borderBox ? {width: 0, height: 0} : {
      width: sum_prop_values(taStyle, 'border-right-width|padding-right|padding-left|border-left-width'),
      height: sum_prop_values(taStyle, 'border-top-width|padding-top|padding-bottom|border-bottom-width'),
    }
  let minHeightValue = int_prop_value(taStyle, 'min-height')
  let heightValue = int_prop_value(taStyle, 'height')
  let minHeight = Math.max(minHeightValue, heightValue) - boxOuter.height
  let maxHeight = int_prop_value(taStyle, 'max-height')
  let copyStyle = 'font-family|font-size|font-weight|font-style|letter-spacing|line-height|text-transform|word-spacing|text-indent'.split('|')
  let mirrored, active

  if (SUPPORT_ANCIENT) {
      // Opera returns max-height of -1 if not set
    maxHeight = maxHeight && maxHeight > 0 ? maxHeight : 9e4
  }

  // append mirror to the DOM
  body.aC(mirror)

  // set resize and apply elastic
  $ta.style.resize =  (resize === 'none' || resize === 'vertical') ? 'none' : 'horizontal'
  $ta.dataset.elastic = true

  /*
   * methods
   */

  function initMirror () {
    let mirrorStyle = mirrorInitStyle

    mirrored = ta
    // copy the essential styles from the textarea to the mirror
    taStyle = getComputedStyle(ta)
    each(copyStyle, (val) => {
      mirrorStyle += val + ':' + get_prop_value(taStyle, val) + ';'
    })

    if (SUPPORT_ANCIENT) mirror.setAttribute('style', mirrorStyle)
    else mirror.style = mirrorStyle
  }

  function adjust () {
    if (mirrored !== ta) {
      initMirror()
    }

    // active flag prevents actions in function from calling adjust again
    if (!active) {
      // @Performance: all of this reading and writing of values likely causes many layout recalcs.
      // probably want to do it in an animation frame or something... eg. read it all, then set it in raf
      let taHeight = ta.style.height === '' ? 'auto' : int(ta.style.height)
      let taComputedStyleWidth = get_prop_value(getComputedStyle(ta), 'width')
      let mirrorHeight
      let width
      let overflow
      active = true

      mirror.value = ta.value // optional whitespace to improve animation
      mirror.style.overflowY = ta.style.overflowY

      // ensure getComputedStyle has returned a readable 'used value' pixel width
      if (taComputedStyleWidth.substr(taComputedStyleWidth.length - 2, 2) === 'px') {
        // update mirror width in case the textarea width has changed
        width = int(taComputedStyleWidth) - boxOuter.width
        mirror.style.width = width + 'px'
      }

      mirrorHeight = mirror.scrollHeight

      if (mirrorHeight > maxHeight) {
        mirrorHeight = maxHeight
        overflow = 'scroll'
      } else if (mirrorHeight < minHeight) {
        mirrorHeight = minHeight
      }
      mirrorHeight += boxOuter.height + 24
      ta.style.overflowY = overflow || 'hidden'

      if (taHeight !== mirrorHeight) {
        ta.style.height = mirrorHeight + 'px'
        if (IS_RACTIVE) raf(() => ractive.fire('elastic:resize', $ta))
      }

      // small delay to prevent an infinite loop
      next_tick(() => active = false)
    }
  }

  function forceAdjust () {
    active = false
    adjust()
  }

  /*
   * initialise
   */

  // listen
  if (SUPPORT_ANCIENT 'onpropertychange' in ta && 'oninput' in ta) {
    // IE9
    ta['oninput'] = ta.onkeyup = adjust
  } else {
    ta['oninput'] = adjust
  }

  on('resize', forceAdjust)

  if (IS_RACTIVE) {
    if (keypath) ractive.observe(keypath, function (v) {
      forceAdjust()
    })

    ractive.on('elastic:adjust', function () {
      initMirror()
      forceAdjust()
    })
  }

  next_tick(adjust)

  let teardown = () => {
    mirror.rm()
    off('resize', forceAdjust)
  }

  return IS_RACTIVE ? { teardown } : teardown
}

export default nlElastic
