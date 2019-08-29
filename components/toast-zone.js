
import './toast-zone.css'

export const eases = {
  fast: 'cubic-bezier(.33,.57,0,1)',
  impact: 'cubic-bezier(.42,0,0,1)',
}

export default function toaster (G, toast_zone_style) {
  const {h} = G

  let toast_zone = h('.toast-zone', {style: toast_zone_style})
  toast_zone.toast = (msg, seconds = 3, ease = 'ease-in', animation = 'toasted') => {

    let el = h('.toast', {
      boink: function () { this.style.display = 'none' },
      style: {animation: `${animation} .1s ${eases[ease] || ease}`}
    }, msg)

    toast_zone.aC(el)

    if (seconds) setTimeout(() => {
      el.style.opacity = 0
      setTimeout(() => toast_zone.rC(el), 1000) // max 1s fade out... this isn't the 90's :)
    }, seconds * 1000)

    return el
  }

  return toast_zone
}
