import { random_idx } from '@lib/utils'

function shuffle_array (array) {
  var i, j, tmp
  for (i = 0; i < array.length; i++) {
    j = random_idx(i + 1)
    tmp = array[i]
    array[i] = array[j]
    array[j] = tmp
  }

  return array
}

export default shuffle_array
