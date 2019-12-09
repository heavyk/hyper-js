
import { error } from '@hyper/utils'

export const CARDINAL = 'zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen'.split(' ')
export const ORDINAL = 'zeroth first second third fourth fifth'.split(' ')

export function ordinal_suffix (i) {
  var j = i % 10, k = i % 100
  return (j == 1 && k != 11)
    ? i + 'st' : (j == 2 && k != 12)
    ? i + 'nd' : (j == 3 && k != 13)
    ? i + 'rd' : i + 'th'
}

export function cardinal (i) {
  return i < 20 ? CARDINAL[i] : error('not yet implemented')
}

export function ordinal (i) {
  return i < 6 ? ORDINAL[i] : cardinal(i) + ordinal_suffix(i)
}
