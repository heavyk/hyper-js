
import { eases } from './toast-zone'

import './whammy.css'

export default function whammy (G) {
  const {h} = G
  return (msg, seconds = 2, ease = 'fast', animation = 'whammy') => {
    let el = h('.whammy', {
      style: { animation: `${animation} ${seconds}s ${eases[ease] || ease} 1 normal forwards` }
    }, msg)
    frame.aC(el)

    if (seconds) setTimeout(() => {
      el.style.opacity = 0
      setTimeout(() => el.rm(), 1000) // max 1s fade out :) this isn't the 90's
    }, seconds * 1000)

    return el
  }

}
