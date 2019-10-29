
import './toast-zone.css'

export const eases = {
  fast: 'cubic-bezier(.33,.57,0,1)',
  impact: 'cubic-bezier(.42,0,0,1)',
}

export default function toaster (G, toast_zone_style) {
  const {h} = G

  let toast_zone = h('.toast-zone', {style: toast_zone_style})
  let toasts = []

  function remove (el, keep_pinned) {
    let idx = toasts.indexOf(el)
    if (~idx && el.pinned != keep_pinned) {
      toasts.splice(idx, 1)
      el.style.opacity = 0
      setTimeout(() => toast_zone.rC(el), 1000) // max 1s fade out... this isn't the 90's :)
    }
  }

  toast_zone.toast = (msg, seconds = 3, options = {}) => {
    let { pinned, ease, animation } = Object.assign({
      pinned: seconds == 0,
      ease: 'ease-in',
      animation: 'toasted',
    }, options)

    let el = h('.toast', {
      pinned,
      boink: () => { el.style.display = 'none' },
      style: {animation: `${animation} .1s ${eases[ease] || ease}`}
    }, msg)

    toast_zone.aC(el)
    toasts.push(el)

    if (seconds) setTimeout(remove, seconds * 1000, el)

    return el
  }

  toast_zone.remove = remove
  toast_zone.clear = () => {
    toasts.forEach((el) => remove(el, true))
  }

  return toast_zone
}
