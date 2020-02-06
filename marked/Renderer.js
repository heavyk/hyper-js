import { defaults } from './defaults.js'
import { cleanUrl, escape } from './helpers.js'

import { h } from '@hyper/dom/hyper-hermes'

/**
 * Renderer
 */
export default class Renderer {
  constructor (options) {
    this.options = options || defaults
  }

  code (code, infostring, escaped) {
    const lang = (infostring || '').match(/\S*/)[0]
    if (this.options.highlight) {
      const out = this.options.highlight(code, lang)
      if (out != null && out !== code) {
        escaped = true
        code = out
      }
    }

    return h('pre',
      h('code', {
        c: lang ? this.options.langPrefix + escape(lang, true) : '',
        html: escaped ? code : escape(code, true),
      })
    )
  }

  blockquote (quote) {
    return h('blockquote', quote)
  }

  html (html) {
    return h(0, {html})
  }

  heading (text, level, raw, slugger) {
    return this.options.headerIds
      ? h('h'+level, {id: this.options.headerPrefix + slugger(raw)}, text)
      : h('h'+level, text)
  }

  hr () {
    return h('hr')
  }

  list (body, ordered, start) {
    // const type = ordered ? 'ol' : 'ul',
    //   startatt = (ordered && start !== 1) ? (' start="' + start + '"') : ''
    // return '<' + type + startatt + '>\n' + body + '</' + type + '>\n'
    return h(ordered ? 'ol' : 'ul', {start: ordered && start !== 1 ? start : undefined}, body)
  }

  listitem (text) {
    return h('li', text)
  }

  checkbox (checked) {
    return h('input', {type: 'checkbox', checked, disabled: 1})
  }

  paragraph (text) {
    return h('p', text)
  }

  table (header, body) {
    return h('table',
      h('thead', header),
      body ? h('tbody', body) : body,
    )
  }

  tablerow (content) {
    return h('tr', content)
  }

  tablecell (content, flags) {
    return h(flags.header ? 'th' : 'td', {align: flags.align}, content)
  }

  // span level renderer
  strong (text) {
    return h('strong', text)
  }

  em (text) {
    return h('em', text)
  }

  codespan (text) {
    return h('code', text)
  }

  br () {
    return h('br')
  }

  del (text) {
    return h('del', text)
  }

  link (href, title, text) {
    return (href = cleanUrl(this.options.baseUrl, href)) === null
      ? text
      : h('a', {href, title}, text)
  }

  image (src, title, text) {
    return (src = cleanUrl(this.options.baseUrl, src)) === null
      ? text
      : h('a', {src, title, alt: text}, text)
  }

  text (text) {
    return text
  }
}
