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
  constructor (options) {
    this.tokens = []
    this.token = null
    this.options = options || defaults
    this.options.renderer = this.options.renderer || new Renderer()
    this.renderer = this.options.renderer
    this.renderer.options = this.options
    this.slugger = Slugger()
  }

  /**
   * Static Parse Method
   */
  static parse (tokens, options) {
    return new Parser(options).parse(tokens)
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
    switch (this.token.type) {
      case 'space': {
        return ''
      }
      case 'hr': {
        return this.renderer.hr()
      }
      case 'heading': {
        return this.renderer.heading(
          this.inline.output(this.token.text),
          this.token.depth,
          this.inlineText.output(this.token.text),
          this.slugger
        )
      }
      case 'code': {
        return this.renderer.code(this.token.text,
          this.token.lang,
          this.token.escaped)
      }
      case 'table': {
        let header = []
        let cells = []
        let i, row, cell, j

        // header
        cell = []
        for (i = 0; i < this.token.header.length; i++) {
          cell.push(this.renderer.tablecell(
            this.inline.output(this.token.header[i]),
            { header: true, align: this.token.align[i]}
          ))
        }
        header.push(this.renderer.tablerow(cell))

        for (i = 0; i < this.token.cells.length; i++) {
          row = this.token.cells[i]

          cell = ''
          for (j = 0; j < row.length; j++) {
            cell.push(this.renderer.tablecell(
              this.inline.output(row[j]),
              { header: false, align: this.token.align[j]}
            ))
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
        const ordered = this.token.ordered,
          start = this.token.start

        while (this.next().type !== 'list_end') {
          body.push(this.tok())
        }

        return this.renderer.list(body, ordered, start)
      }
      case 'list_item_start': {
        body = []
        const loose = this.token.loose
        const checked = this.token.checked
        const task = this.token.task

        if (this.token.task) {
          if (loose) {
            if (this.peek().type === 'text') {
              const nextToken = this.peek()
              nextToken.text = this.renderer.checkbox(checked) + ' ' + nextToken.text
            } else {
              this.tokens.push({
                type: 'text',
                text: this.renderer.checkbox(checked)
              })
            }
          } else {
            body.push(this.renderer.checkbox(checked))
          }
        }

        while (this.next().type !== 'list_item_end') {
          body.push(!loose && this.token.type === 'text'
            ? this.parseText()
            : this.tok()
          )
        }
        return this.renderer.listitem(body, task, checked)
      }
      case 'html': {
        // TODO parse inline content if parameter markdown=1
        return this.renderer.html(this.token.text)
      }
      case 'paragraph': {
        return this.renderer.paragraph(this.inline.output(this.token.text))
      }
      case 'text': {
        return this.renderer.paragraph(this.parseText())
      }
      default: {
        error('Token with "' + this.token.type + '" type was not found.')
      }
    }
  }
}
