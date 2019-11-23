
import { after, next_tick } from '@hyper/utils'
import { eases } from './toast-zone'

import './whammy.css'

export default function whammy ({h}, frame) {
  return (msg, seconds = 2, ease = 'fast', animation = 'whammy') => {
    let el = h('.whammy', {
      style: { animation: `${animation} ${seconds}s ${eases[ease] || ease} 1 normal forwards` }
    }, msg)

    frame.aC(el)

    if (seconds) after(seconds, () => {
      el.style.opacity = 0
      after(1, () => el.rm()) // max 1s fade out :) this isn't the 90's
    })

    return el
  }
}
