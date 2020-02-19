import Renderer from './Renderer.js'
import { defaults } from './defaults.js'
import { inline } from './rules.js'
import { findClosingBracket, unescapes } from './helpers.js'

import { error } from '@hyper/utils'
import { h } from '@hyper/dom/hyper-hermes'

let tags = 'kbd|pre|code'.split('|')
let rules = inline.breaks

/**
 * Inline Lexer & Compiler
 */
export default function InlineLexer (G, links, options = defaults) {
  // @Optimise: instead of having a renderer, just have a text option, so that it renders text instead.
  options.renderer = options.renderer || new Renderer(G)
  let renderer = options.renderer
  renderer.options = options

  let inRawBlock

  if (!links) {
    error('Tokens array requires a `links` property.')
  }

  function output (src) {
    let out = [],
      last,
      in_tag,
      link,
      text,
      href,
      cap,
      prevCapZero

    function append (it) {
      if (typeof it === 'string' && typeof last === 'string') {
        // append
        last = (out[out.length - 1] += it)
      } else {
        if (in_tag) {
          in_tag.aC(it)
        } else {
          out.push(last = it)
        }
      }
    }

    while (src) {
      // escape
      if (cap = rules.escape.exec(src)) {
        src = src.substring(cap[0].length)
        append(cap[1])
      }

      // tag
      else if ((cap = rules.tag.exec(src))) {
        // cap[1] - closing tag
        // cap[2] - opening tag
        src = src.substring(cap[0].length)

        if (tags.includes(cap[1] || cap[2])) {
          if (cap[2]) {
            // entering tag
            in_tag = h(cap[2])

            // raw block means that text is output exactly as it's written and isn't transformed by markdown
            inRawBlock = true
          } else if (cap[1]) {
            // leaving tag
            cap = in_tag
            in_tag = 0

            append(cap)
            inRawBlock = false
          } else if (DEBUG) {
            // this shouldn't happen. it may happen though if it's like an html comment or something...
            in_tag = 0
            debugger
          }
        }
      }

      // link
      else if (cap = rules.link.exec(src)) {
        src = src.substring(cap[0].length)
        href = cap[3].trim()
        append(outputLink(cap, {
          href: unescapes(href),
          title: unescapes(cap[4] && cap[4].slice(1, -1))
        }))
      }

      // reflink, nolink
      else if ((cap = rules.reflink.exec(src))
        || (cap = rules.nolink.exec(src))) {
        src = src.substring(cap[0].length)
        link = (cap[3] || cap[2]).replace(/\s+/g, ' ')
        link = links[link.toLowerCase()]
        if (!link || !link.href) {
          // out += cap[0].charAt(0)
          // not sure if this is right...
          append(cap[0].charAt(0))
          if (DEBUG) debugger // @Incomplete: test these. not sure they're working properly
          src = cap[0].substring(1) + src
        } else {
          if (DEBUG) debugger // @Incomplete: test these. not sure they're working properly
          append(outputLink(cap, link))
        }
      }

      // strong
      else if (cap = rules.strong.exec(src)) {
        src = src.substring(cap[0].length)
        append(renderer.strong(output(cap[4] || cap[3] || cap[2] || cap[1])))
      }

      // em
      else if (cap = rules.em.exec(src)) {
        src = src.substring(cap[0].length)
        append(renderer.em(output(cap[6] || cap[5] || cap[4] || cap[3] || cap[2] || cap[1])))
      }

      // code
      else if (cap = rules.code.exec(src)) {
        src = src.substring(cap[0].length)
        append(renderer.codespan(escape(cap[2].trim(), true)))
      }

      // br
      else if (cap = rules.br.exec(src)) {
        src = src.substring(cap[0].length)
        append(renderer.br())
      }

      // del (gfm)
      else if (cap = rules.del.exec(src)) {
        src = src.substring(cap[0].length)
        append(renderer.del(output(cap[1])))
      }

      // autolink
      else if (cap = rules.autolink.exec(src)) {
        src = src.substring(cap[0].length)
        if (cap[2] === '@') {
          text = escape(mangle(cap[1]))
          href = 'mailto:' + text
        } else {
          text = escape(cap[1])
          href = text
        }
        append(renderer.link(href, null, text))
      }

      // url (gfm)
      else if (cap = rules.url.exec(src)) {
        if (cap[2] === '@') {
          text = escape(cap[0])
          href = 'mailto:' + text
        } else {
          // do extended autolink path validation
          do {
            prevCapZero = cap[0]
            cap[0] = rules._backpedal.exec(cap[0])[0]
          } while (prevCapZero !== cap[0])
          text = escape(cap[0])
          if (cap[1] === 'www.') {
            href = 'http://' + text
          } else {
            href = text
          }
        }
        src = src.substring(cap[0].length)
        append(renderer.link(href, null, text))
      }

      // text
      else if (cap = rules.text.exec(src)) {
        src = src.substring(cap[0].length)
        if (inRawBlock) {
          append(renderer.text(cap[0]))
        } else {
          append(renderer.text(smartypants(cap[0])))
        }
      }

      else if (src) {
        error('Infinite loop on byte: ' + src.charCodeAt(0))
      }
    }

    return out
  }

  /**
   * Compile Link
   */
  function outputLink (cap, link) {
    // @Incomplete: these should have a link prefix renderers registered
    // eg {'': link () { ... }, '!': image () { ... }, etc. }
    let prefix = cap[1] || ''
    // return cap[0].charAt(0) !== '!'
    //   ? renderer.link(link.href, link.title, output(cap[2]))
    //   : renderer.image(link.href, link.title, cap[2])
    // wtf is output getting called?!?!
    // return renderer.link[prefix](link.href, link.title, output(cap[2]))
    return renderer.link[prefix](link.href, link.title, cap[2])
  }

  /**
   * Smartypants Transformations
   */
  function smartypants (text) {
    if (!options.smartypants) return text
    return text
      // em-dashes
      .replace(/---/g, '\u2014')
      // en-dashes
      .replace(/--/g, '\u2013')
      // opening singles
      .replace(/(^|[-\u2014/(\[{"\s])'/g, '$1\u2018')
      // closing singles & apostrophes
      .replace(/'/g, '\u2019')
      // opening doubles
      .replace(/(^|[-\u2014/(\[{\u2018\s])"/g, '$1\u201c')
      // closing doubles
      .replace(/"/g, '\u201d')
      // ellipses
      .replace(/\.{3}/g, '\u2026')
  }

  /**
   * Mangle Links
   */
  function mangle (text) {
    if (!options.mangle) return text
    let out = '',
      i = 0,
      ch

    for (; i < text.length; i++) {
      ch = text.charCodeAt(i)
      if (Math.random() > 0.5) {
        ch = 'x' + ch.toString(16)
      }
      out += '&#' + ch + ';'
    }

    return out
  }

  return output
}
