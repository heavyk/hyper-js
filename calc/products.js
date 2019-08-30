import factors from './factors'

export default function products (number) {
  let fx = factors(number), len = fx.length, products = [],
    i, j, a, b
  for (i = 0; i < len; i++) {
    for (j = 0; j < len; j++) {
      a = fx[i]
      b = fx[j]
      if ((a * b) === number) {
        products.push([a,b])
      }
    }
  }

  return products
}
