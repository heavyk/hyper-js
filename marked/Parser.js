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

  let next = () => token = tokens.pop()
  let peek = () => tokens[tokens.length - 1] || 0

  function parse (tokens, out = []) {
    inline_output = InlineLexer(tokens.links, options)
    // use an InlineLexer with a TextRenderer to extract pure text
    inline_text_output = InlineLexer(
      tokens.links,
      merge({}, options, { renderer: new TextRenderer() })
    )
    tokens = tokens.reverse()

    while (next()) {
      out.push(tok())
    }

    return out
  }

  let parseText = (body = token.text) => {
    while (peek().type === 'text') {
      body += '\n' + next().text
    }

    return inline_output(body)
  }

  function tok () {
    let body
    let token = token
    let type = token.type
    if (type === 'space') {
      return ''
    } else if (type === 'hr') {
      return renderer.hr()
    } else if (type === 'heading') {
      return renderer.heading(
        inline_output(token.text),
        token.depth,
        inline_text_output(token.text),
        slugger
      )
    } else if (type === 'code') {
      return renderer.code(token.text,
        token.lang,
        token.escaped)
    } else if (type === 'link') {
      return renderer.link[token.prefix](token.href, token.title, token.text)
    } else if (type === 'table') {
      return ((header = [], cells = [], i, j, row, cell = []) => {
        // header
        for (i = 0; i < token.header.length; i++) {
          cell.push(renderer.tablecell(
            inline_output(token.header[i]),
            { header: true, align: token.align[i]}
          ))
        }

        header.push(renderer.tablerow(cell))
        for (i = 0; i < token.cells.length; i++) {
          row = token.cells[i]

          cell = []
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
      })()
    } else if (type === 'blockquote_start') {
      return ((body = []) => {
        while (next().type !== 'blockquote_end') {
          body.push(tok())
        }

        return renderer.blockquote(body)
      })()
    } else if (type === 'list_start') {
      return ((body = []) => {
        const { ordered, start } = token

        while (next().type !== 'list_end') {
          body.push(tok())
        }

        return renderer.list(body, ordered, start)
      })()
    } else if (type === 'list_item_start') {
      return ((body = []) => {
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
      })()
    } else if (type === 'paragraph') {
      return renderer.paragraph(inline_output(token.text))
    } else if (type === 'text') {
      return renderer.paragraph(parseText())
    } else {
      error('Token with "' + token.type + '" type was not found.')
    }
  }

  return parse
}
