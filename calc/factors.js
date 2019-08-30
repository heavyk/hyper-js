
export default function factors (number) {
  let factors = []
  for (let i = 0; i <= number; i++) {
    if ((number % i) === 0) factors.push(i)
  }

  return factors
}
