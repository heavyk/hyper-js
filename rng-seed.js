
import { win } from '@lib/dom/dom-base'
import { value } from '@lib/dom/observable'
import XSadd from 'ml-xsadd'

/*
 * this function will replace `Math.random` with a prng
 * and set the hash to be your seed (@Incomplete: this should
 * be configurable).
 * it reurns an obv value of the seed which can also be set
 */

export default function rng_seed (seed) {
  const _seed = value(seed)
  Math.unpredictable = Math.random
  let onhashchange = win.onhashchange = (ev) => {
    let hash = location.hash
    console.log('hash seed:', hash)
    _seed(hash ? hash.substr(1)*1 : 0)
  }

  _seed((v) => {
    v *= 1 // ensure it's numeric
    if (!v) v = Math.floor(Math.random() * Number.MAX_SAFE_INTEGER)
    DEBUG && console.info('seed:', v)
    const prng = new XSadd(v)
    history.pushState(null, null, '#'+v)
    Math.random = () => prng.getFloat()
  })

  onhashchange()
  return _seed
}
