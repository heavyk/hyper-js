import Renderer from './Renderer.js'
import Slugger from './Slugger.js'
import InlineLexer from './InlineLexer.js'
import TextRenderer from './TextRenderer.js'
import { defaults } from './defaults.js'
import { unescape } from './helpers.js'

import { merge, error } from '@hyper/utils'

export default function Parser (G, options = defaults) {
  let tokens = []
  let token = null
  let renderer = options.renderer || Renderer(G)
  renderer.options = options
  let slugger = Slugger()
  let inline_output
  let inline_text_output

  function parse (tokens) {
    inline_output = InlineLexer(tokens.links, options)
    // use an InlineLexer with a TextRenderer to extract pure text
    inline_text_output = InlineLexer(
      tokens.links,
      merge({}, options, { renderer: new TextRenderer() })
    )
    tokens = tokens.reverse()

    let out = []
    while (next()) {
      out.push(tok())
    }

    return out
  }

  function next () {
    return token = tokens.pop()
  }

  function peek () {
    return tokens[tokens.length - 1] || 0
  }

  function parseText () {
    let body = token.text

    while (peek().type === 'text') {
      body += '\n' + next().text
    }

    return inline_output(body)
  }

  function tok () {
    let body
    let token = token
    switch (token.type) {
      case 'space': {
        return ''
      }
      case 'hr': {
        return renderer.hr()
      }
      case 'heading': {
        return renderer.heading(
          inline_output(token.text),
          token.depth,
          inline_text_output(token.text),
          slugger
        )
      }
      case 'code': {
        return renderer.code(token.text,
          token.lang,
          token.escaped)
      }
      case 'link': {
        return renderer.link[token.prefix](token.href, token.title, token.text)
      }
      case 'table': {
        let header = []
        let cells = []
        let i, row, cell, j

        // header
        cell = []
        for (i = 0; i < token.header.length; i++) {
          cell.push(renderer.tablecell(
            inline_output(token.header[i]),
            { header: true, align: token.align[i]}
          ))
        }

        header.push(renderer.tablerow(cell))
        for (i = 0; i < token.cells.length; i++) {
          row = token.cells[i]

          cell = ''
          for (j = 0; j < row.length; j++) {
            cell.push(
              renderer.tablecell(
                inline_output(row[j]),
                { header: false, align: token.align[j]}
              )
            )
          }

          cells.push(renderer.tablerow(cell))
        }

        return renderer.table(header, cells)
      }
      case 'blockquote_start': {
        body = []

        while (next().type !== 'blockquote_end') {
          body.push(tok())
        }

        return renderer.blockquote(body)
      }
      case 'list_start': {
        body = []
        const { ordered, start } = token

        while (next().type !== 'list_end') {
          body.push(tok())
        }

        return renderer.list(body, ordered, start)
      }
      case 'list_item_start': {
        body = []
        const loose = token.loose
        const checked = token.checked
        const task = token.task

        if (task) {
          body.push(renderer.checkbox(checked))
          if (loose) {
            const nextToken = peek()
            if (nextToken.type === 'text') {
              nextToken.text = ' ' + nextToken.text
            }
          }
        }

        while ((token = next()).type !== 'list_item_end') {
          body.push(!loose && token.type === 'text'
            ? parseText() // not loose
            : tok()
          )
        }
        return renderer.listitem(body, task, checked)
      }
      case 'paragraph': {
        return renderer.paragraph(inline_output(token.text))
      }
      case 'text': {
        return renderer.paragraph(parseText())
      }
      default: {
        error('Token with "' + token.type + '" type was not found.')
      }
    }
  }

  return parse
}
