import debounce from './lodash/debounce'
import { after } from '@hyper/utils'

export default function onScroll (el, percent_or_px, handler) {
  let _el = el && el.scrollHeight ? el : window
  let body = el && el.scrollHeight ? el : document.body
  let throttled = debounce(_onScroll, 100, {leading: true, trailing: true, maxWait: 200})
  // let throttled = () => { console.log('scroll?'); _throttled.apply(this, arguments) }
  let timeout

  _el.addEventListener('scroll', throttled)
  let obj = {
    cancel () {
      _el.removeEventListener('scroll', throttled)
    }
  }
  after(1, () => {
    if (timeout) clearTimeout(timeout)
    throttled()
  })

  return obj

  function _onScroll (e) {
    if (obj.working) return timeout ? null : timeout = after(0.01, throttled)
    let rect = body.getBoundingClientRect()
    let bottom_px = window.pageYOffset + window.innerHeight

    if ((percent_or_px < 1 && (rect.height * percent_or_px) < bottom_px) || (rect.height - percent_or_px) < bottom_px) {
      obj.working = true
      handler(function () {
        after(0.01, throttled)
        obj.working = false
      })
    }
  }
}
