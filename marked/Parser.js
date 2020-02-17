import Renderer from './Renderer.js'
import Slugger from './Slugger.js'
import InlineLexer from './InlineLexer.js'
import TextRenderer from './TextRenderer.js'
import { defaults } from './defaults.js'
import { unescape } from './helpers.js'

import { merge, error } from '@hyper/utils'

/**
 * Parsing & Compiling
 */
export default class Parser {
  constructor (G, options) {
    this.tokens = []
    this.token = null
    this.options = options || defaults
    this.options.renderer = this.options.renderer || Renderer(G)
    this.renderer = this.options.renderer
    this.renderer.options = this.options
    this.slugger = Slugger()
  }

  /**
   * Static Parse Method
   */
  static parse (G, tokens, options) {
    return new Parser(G, options).parse(tokens)
  }

  /**
   * Parse Loop
   */
  parse (tokens) {
    this.inline = new InlineLexer(tokens.links, this.options)
    // use an InlineLexer with a TextRenderer to extract pure text
    this.inlineText = new InlineLexer(
      tokens.links,
      merge({}, this.options, { renderer: new TextRenderer() })
    )
    this.tokens = tokens.reverse()

    let out = []
    while (this.next()) {
      out.push(this.tok())
    }

    return out
  }

  /**
   * Next Token
   */
  next () {
    this.token = this.tokens.pop()
    return this.token
  }

  /**
   * Preview Next Token
   */
  peek () {
    return this.tokens[this.tokens.length - 1] || 0
  }

  /**
   * Parse Text Tokens
   */
  parseText () {
    let body = this.token.text

    while (this.peek().type === 'text') {
      body += '\n' + this.next().text
    }

    return this.inline.output(body)
  }

  /**
   * Parse Current Token
   */
  tok () {
    let body
    let token = this.token
    switch (token.type) {
      case 'space': {
        return ''
      }
      case 'hr': {
        return this.renderer.hr()
      }
      case 'heading': {
        return this.renderer.heading(
          this.inline.output(token.text),
          token.depth,
          this.inlineText.output(token.text),
          this.slugger
        )
      }
      case 'code': {
        return this.renderer.code(token.text,
          token.lang,
          token.escaped)
      }
      case 'link': {
        return this.renderer.link[token.prefix](token.href, token.title, token.text)
      }
      case 'table': {
        let header = []
        let cells = []
        let i, row, cell, j

        // header
        cell = []
        for (i = 0; i < token.header.length; i++) {
          cell.push(this.renderer.tablecell(
            this.inline.output(token.header[i]),
            { header: true, align: token.align[i]}
          ))
        }

        header.push(this.renderer.tablerow(cell))
        for (i = 0; i < token.cells.length; i++) {
          row = token.cells[i]

          cell = ''
          for (j = 0; j < row.length; j++) {
            cell.push(
              this.renderer.tablecell(
                this.inline.output(row[j]),
                { header: false, align: token.align[j]}
              )
            )
          }

          cells.push(this.renderer.tablerow(cell))
        }

        return this.renderer.table(header, cells)
      }
      case 'blockquote_start': {
        body = []

        while (this.next().type !== 'blockquote_end') {
          body.push(this.tok())
        }

        return this.renderer.blockquote(body)
      }
      case 'list_start': {
        body = []
        const { ordered, start } = token

        while (this.next().type !== 'list_end') {
          body.push(this.tok())
        }

        return this.renderer.list(body, ordered, start)
      }
      case 'list_item_start': {
        body = []
        const loose = token.loose
        const checked = token.checked
        const task = token.task

        if (task) {
          body.push(this.renderer.checkbox(checked))
          if (loose) {
            const nextToken = this.peek()
            if (nextToken.type === 'text') {
              nextToken.text = ' ' + nextToken.text
            }
          }
        }

        while ((token = this.next()).type !== 'list_item_end') {
          body.push(!loose && token.type === 'text'
            ? this.parseText() // not loose
            : this.tok()
          )
        }
        return this.renderer.listitem(body, task, checked)
      }
      case 'paragraph': {
        return this.renderer.paragraph(this.inline.output(token.text))
      }
      case 'text': {
        return this.renderer.paragraph(this.parseText())
      }
      default: {
        error('Token with "' + token.type + '" type was not found.')
      }
    }
  }
}
