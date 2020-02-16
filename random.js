
export const random_id = () => Math.random().toString(32).substr(2)
export const random_idx = (len) => Math.floor(Math.random() * len)
export const random_int = (max, min = 0) => min + Math.floor(Math.random() * (max - min))
export const random_int2 = (max, min = 0) => min + Math.floor(Math.sqrt(Math.random() * (max - min) * (max - min)))
export const random_number = (max, min = 0) => min + (Math.random() * (max - min))
export const random_number2 = (max, min = 0) => min + (Math.sqrt(Math.random() * (max - min) * (max - min)))
export const sample_array = (array, length) => {
  return (length || (length = array == null ? 0 : array.length)) ? array[random_idx(length)] : undefined
}
