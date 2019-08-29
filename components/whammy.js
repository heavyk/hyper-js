// import './whammy.css'
import { eases } from './toast-zone'

export default function whammy (G) {
  const {h} = G
  return (msg, seconds = 2, ease = 'fast', animation = 'toasted') => {
    let el = h('.whammy', {
      style: { animation: `${animation} ${seconds}s ${eases[ease] || ease} 1 normal forwards` }
    }, msg)
    frame.aC(el)

    if (seconds) setTimeout(() => {
      el.style.opacity = 0
      setTimeout(() => frame.rC(el), 1000) // max 1s fade out :) this isn't the 90's
    }, seconds * 1000)

    return el
  }

}
