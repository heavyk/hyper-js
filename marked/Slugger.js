/**
 * Slugger generates header id
 */

export default function Slugger () {
  let seen = []

  return function slug (value) {
    let slug = value.trim()
      .toLowerCase()
      .replace(/[\u2000-\u206F\u2E00-\u2E7F\\'!"#$%&()*+,./:;<=>?@[\]^`{|}~]/g, '')
      .replace(/\s/g, '-')

    if (seen.hasOwnProperty(slug)) {
      let originalSlug = slug
      do {
        seen[originalSlug]++
        slug = originalSlug + '-' + seen[originalSlug]
      } while (seen.hasOwnProperty(slug))
    }
    seen[slug] = 0

    return slug
  }
}
