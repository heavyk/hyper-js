import { random_idx, swap } from '@lib/utils'

function shuffle_array (array) {
  for (var i = 0; i < array.length; i++) {
    swap(array, i, random_idx(i + 1))
  }

  return array
}

export default shuffle_array
