import Renderer from './Renderer.js'
import { defaults } from './defaults.js'
import { inline } from './rules.js'
import { findClosingBracket } from './helpers.js'

import { error } from '@hyper/utils'
import { h } from '@hyper/dom/hyper-hermes'

// function to unescape text such as: \[notalink\]\(neither this\) -> [notalink](neither this)
function unescapes (text) {
  return text ? text.replace(inline._escapes, '$1') : text
}

let tags = 'a|kbd|pre|code'.split('|')

/**
 * Inline Lexer & Compiler
 */
export default class InlineLexer {
  constructor (links, options) {
    this.options = options || defaults
    this.links = links
    this.rules = inline.normal
    this.options.renderer = this.options.renderer || new Renderer()
    this.renderer = this.options.renderer
    this.renderer.options = this.options

    if (!this.links) {
      error('Tokens array requires a `links` property.')
    }

    this.rules = inline.breaks
  }

  /**
   * Static Lexing/Compiling Method
   */
  static output (src, links, options) {
    const inline = new InlineLexer(links, options)
    return inline.output(src)
  }

  /**
   * Lexing/Compiling
   */
  output (src) {
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
      // if (DEBUG && src.startsWith('<!--')) debugger

      // escape
      if (cap = this.rules.escape.exec(src)) {
        src = src.substring(cap[0].length)
        append(cap[1])
      }

      // tag
      else if ((cap = this.rules.tag.exec(src))) {
        // cap[1] - closing tag
        // cap[2] - opening tag
        // @Cleanup: remove this.inLink
        if (!this.inLink && cap[2] === 'a') {
          this.inLink = true
        } else if (this.inLink && cap[1] === 'a') {
          this.inLink = false
        }

        src = src.substring(cap[0].length)

        if (tags.includes(cap[1] || cap[2])) {
          if (cap[2]) {
            // entering tag
            in_tag = h(cap[2])

            // raw block means that text is output exactly as it's written and isn't transformed by markdown
            this.inRawBlock = true
          } else if (cap[1]) {
            // leaving tag
            cap = in_tag
            in_tag = 0

            append(cap)
            this.inRawBlock = false
          } else {
            in_tag = 0
            // this shouldn't happen. it may happen though if it's like an html comment or something...
            if (DEBUG) debugger
          }
        }
        // if (cap[1]) append(this.renderer.el(cap[1], cap[2]))
        // if (cap[1]) debugger
      }

      // link
      else if (cap = this.rules.link.exec(src)) {
        const lastParenIndex = findClosingBracket(cap[3], '()')
        if (lastParenIndex > -1) {
          // I don't understand when this case is hit. I can't seem to get it to go
          debugger
          const linkLen = (cap[1] ? 5 : 4) + cap[2].length + lastParenIndex
          cap[3] = cap[3].substring(0, lastParenIndex)
          cap[0] = cap[0].substring(0, linkLen).trim()
          cap[4] = ''
        }

        src = src.substring(cap[0].length)
        this.inLink = true
        href = cap[3].trim().replace(/^<([\s\S]*)>$/, '$1')
        append(this.outputLink(cap, {
          href: unescapes(href),
          title: unescapes(cap[4] && cap[4].slice(1, -1))
        }))
        this.inLink = false
      }

      // reflink, nolink
      else if ((cap = this.rules.reflink.exec(src))
        || (cap = this.rules.nolink.exec(src))) {
        src = src.substring(cap[0].length)
        link = (cap[3] || cap[2]).replace(/\s+/g, ' ')
        link = this.links[link.toLowerCase()]
        if (!link || !link.href) {
          // out += cap[0].charAt(0)
          // not sure if this is right...
          append(cap[0].charAt(0))
          if (DEBUG) debugger
          src = cap[0].substring(1) + src
        } else {
          if (DEBUG) debugger
          this.inLink = true
          append(this.outputLink(cap, link))
          this.inLink = false
        }
      }

      // strong
      else if (cap = this.rules.strong.exec(src)) {
        src = src.substring(cap[0].length)
        append(this.renderer.strong(this.output(cap[4] || cap[3] || cap[2] || cap[1])))
      }

      // em
      else if (cap = this.rules.em.exec(src)) {
        src = src.substring(cap[0].length)
        append(this.renderer.em(this.output(cap[6] || cap[5] || cap[4] || cap[3] || cap[2] || cap[1])))
      }

      // code
      else if (cap = this.rules.code.exec(src)) {
        src = src.substring(cap[0].length)
        append(this.renderer.codespan(escape(cap[2].trim(), true)))
      }

      // br
      else if (cap = this.rules.br.exec(src)) {
        src = src.substring(cap[0].length)
        append(this.renderer.br())
      }

      // del (gfm)
      else if (cap = this.rules.del.exec(src)) {
        src = src.substring(cap[0].length)
        append(this.renderer.del(this.output(cap[1])))
      }

      // autolink
      else if (cap = this.rules.autolink.exec(src)) {
        src = src.substring(cap[0].length)
        if (cap[2] === '@') {
          text = escape(this.mangle(cap[1]))
          href = 'mailto:' + text
        } else {
          text = escape(cap[1])
          href = text
        }
        append(this.renderer.link(href, null, text))
      }

      // url (gfm)
      else if (!this.inLink && (cap = this.rules.url.exec(src))) {
        if (cap[2] === '@') {
          text = escape(cap[0])
          href = 'mailto:' + text
        } else {
          // do extended autolink path validation
          do {
            prevCapZero = cap[0]
            cap[0] = this.rules._backpedal.exec(cap[0])[0]
          } while (prevCapZero !== cap[0])
          text = escape(cap[0])
          if (cap[1] === 'www.') {
            href = 'http://' + text
          } else {
            href = text
          }
        }
        src = src.substring(cap[0].length)
        append(this.renderer.link(href, null, text))
      }

      // text
      else if (cap = this.rules.text.exec(src)) {
        src = src.substring(cap[0].length)
        if (this.inRawBlock) {
          append(this.renderer.text(cap[0]))
        } else {
          append(this.renderer.text(this.smartypants(cap[0])))
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
  outputLink (cap, link) {
    // @Incomplete: these should have a link prefix renderers registered
    // eg {'': link () { ... }, '!': image () { ... }, etc. }
    let prefix = cap[1] || ''
    // return cap[0].charAt(0) !== '!'
    //   ? this.renderer.link(link.href, link.title, this.output(cap[2]))
    //   : this.renderer.image(link.href, link.title, cap[2])
    // wtf is this.output getting called?!?!
    // return this.renderer.link[prefix](link.href, link.title, this.output(cap[2]))
    return this.renderer.link[prefix](link.href, link.title, cap[2])
  }

  /**
   * Smartypants Transformations
   */
  smartypants (text) {
    if (!this.options.smartypants) return text
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
  mangle (text) {
    if (!this.options.mangle) return text
    const l = text.length
    let out = '',
      i = 0,
      ch

    for (; i < l; i++) {
      ch = text.charCodeAt(i)
      if (Math.random() > 0.5) {
        ch = 'x' + ch.toString(16)
      }
      out += '&#' + ch + ';'
    }

    return out
  }
}
