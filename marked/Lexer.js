import { defaults } from './defaults.js'
import { block } from './rules.js'
import { rtrim, unescapes } from './helpers.js'

import { error } from '@hyper/utils'

function splitCells (tableRow, count) {
  // ensure that every cell-delimiting pipe has a space
  // before it to distinguish it from an escaped pipe
  let row = tableRow.replace(/\|/g, (match, offset, str) => {
    let escaped = false,
      curr = offset
    while (--curr >= 0 && str[curr] === '\\') escaped = !escaped
    if (escaped) {
      // odd number of slashes means | is escaped
      // so we leave it alone
      return '|'
    } else {
      // add space before unescaped |
      return ' |'
    }
  })
  let cells = row.split(/ \|/)
  let i = 0

  if (cells.length > count) {
    cells.splice(count)
  } else {
    while (cells.length < count) cells.push('')
  }

  for (; i < cells.length; i++) {
    // leading or trailing whitespace is ignored per the gfm spec
    cells[i] = cells[i].trim().replace(/\\\|/g, '|')
  }
  return cells
}


/**
 * Block Lexer
 */
export default function Lexer (src, options = defaults) {
  let tokens = []
  tokens.links = Object.create(null)

  src = src
    .replace(/\r\n|\r/g, '\n')
    .replace(/\t/g, '    ')

  function token (src, top) {
    src = src.replace(/^ +$/gm, '')
    let next,
      loose,
      cap,
      bull,
      b,
      item,
      listStart,
      listItems,
      t,
      space,
      i,
      tag,
      l,
      isordered,
      istask,
      ischecked

    while (src) {
      // newline
      if (cap = block.newline.exec(src)) {
        src = src.substring(cap[0].length)
        if (cap[0].length > 1) {
          tokens.push({ type: 'space' })
        }
      }

      // code
      else if (cap = block.code.exec(src)) {
        const lastToken = tokens[tokens.length - 1]
        src = src.substring(cap[0].length)
        // An indented code block cannot interrupt a paragraph.
        if (lastToken && lastToken.type === 'paragraph') {
          lastToken.text += '\n' + cap[0].trimRight()
        } else {
          cap = cap[0].replace(/^ {4}/gm, '')
          tokens.push({
            type: 'code',
            codeBlockStyle: 'indented',
            text: rtrim(cap, '\n')
          })
        }
      }

      // fences
      else if (cap = block.fences.exec(src)) {
        src = src.substring(cap[0].length)
        tokens.push({
          type: 'code',
          lang: cap[2] ? cap[2].trim() : cap[2],
          text: cap[3] || ''
        })
      }

      // heading
      else if (cap = block.heading.exec(src)) {
        src = src.substring(cap[0].length)
        tokens.push({
          type: 'heading',
          depth: cap[1].length,
          text: cap[2]
        })
      }

      // table no leading pipe (gfm)
      else if (cap = block.nptable.exec(src)) {
        item = {
          type: 'table',
          header: splitCells(cap[1].replace(/^ *| *\| *$/g, '')),
          align: cap[2].replace(/^ *|\| *$/g, '').split(/ *\| */),
          cells: cap[3] ? cap[3].replace(/\n$/, '').split('\n') : []
        }

        if (item.header.length === item.align.length) {
          src = src.substring(cap[0].length)

          for (i = 0; i < item.align.length; i++) {
            if (/^ *-+: *$/.test(item.align[i])) {
              item.align[i] = 'right'
            } else if (/^ *:-+: *$/.test(item.align[i])) {
              item.align[i] = 'center'
            } else if (/^ *:-+ *$/.test(item.align[i])) {
              item.align[i] = 'left'
            } else {
              item.align[i] = null
            }
          }

          for (i = 0; i < item.cells.length; i++) {
            item.cells[i] = splitCells(item.cells[i], item.header.length)
          }

          tokens.push(item)
        } else if (DEBUG) {
          // @Incomplete: should never reach here. test to find out what happens if it does reach.
          debugger
        }
      }

      // hr
      else if (cap = block.hr.exec(src)) {
        src = src.substring(cap[0].length)
        tokens.push({ type: 'hr' })
      }

      // blockquote
      else if (cap = block.blockquote.exec(src)) {
        src = src.substring(cap[0].length)

        tokens.push({ type: 'blockquote_start' })

        cap = cap[0].replace(/^ *> ?/gm, '')

        // Pass `top` to keep the current
        // "toplevel" state. This is exactly
        // how markdown.pl works.
        token(cap, top)

        tokens.push({ type: 'blockquote_end' })
      }

      // link
      else if (cap = block.link.exec(src)) {
        src = src.substring(cap[0].length)
        tokens.push({
          type: 'link',
          prefix: cap[1] || '',
          text: cap[2],
          href: unescapes(cap[3].trim()),
          title: unescapes(cap[4] && cap[4].slice(1, -1))
        })
      }

      // list
      else if (cap = block.list.exec(src)) {
        src = src.substring(cap[0].length)
        bull = cap[2]
        isordered = bull.length > 1

        listStart = {
          type: 'list_start',
          ordered: isordered,
          start: isordered ? +bull : '',
          loose: false
        }

        tokens.push(listStart)

        // Get each top-level item.
        cap = cap[0].match(block.item)

        listItems = []
        next = false
        l = cap.length
        i = 0

        for (; i < l; i++) {
          item = cap[i]

          // Remove the list item's bullet
          // so it is seen as the next token.
          space = item.length
          item = item.replace(/^ *([*+-]|\d+\.) */, '')

          // Outdent whatever the
          // list item contains. Hacky.
          if (~item.indexOf('\n ')) {
            space -= item.length
            item = item.replace(new RegExp('^ {1,' + space + '}', 'gm'), '')
          }

          // Determine whether the next list item belongs here.
          // Backpedal if it does not belong in this list.
          if (i !== l - 1) {
            b = block.bullet.exec(cap[i + 1])[0]
            if (bull.length > 1 ? b.length === 1
                : (b.length > 1 || (options.smartLists && b !== bull))) {
              src = cap.slice(i + 1).join('\n') + src
              i = l - 1
            }
          }

          // Determine whether item is loose or not.
          // Use: /(^|\n)(?! )[^\n]+\n\n(?!\s*$)/
          // for discount behavior.
          loose = next || /\n\n(?!\s*$)/.test(item)
          if (i !== l - 1) {
            next = item.charAt(item.length - 1) === '\n'
            if (!loose) loose = next
          }

          if (loose) {
            listStart.loose = true
          }

          // Check for task list items
          istask = /^\[[ xX]\] /.test(item)
          ischecked = undefined
          if (istask) {
            ischecked = item[1] !== ' '
            item = item.replace(/^\[[ xX]\] +/, '')
          }

          t = {
            type: 'list_item_start',
            task: istask,
            checked: ischecked,
            loose: loose
          }

          listItems.push(t)
          tokens.push(t)

          // Recurse.
          token(item, false)

          tokens.push({ type: 'list_item_end' })
        }

        if (listStart.loose) {
          l = listItems.length
          i = 0
          for (; i < l; i++) {
            listItems[i].loose = true
          }
        }

        tokens.push({ type: 'list_end' })
      }

      // def
      else if (top && (cap = block.def.exec(src))) {
        src = src.substring(cap[0].length)
        if (cap[3]) cap[3] = cap[3].substring(1, cap[3].length - 1)
        tag = cap[1].toLowerCase().replace(/\s+/g, ' ')
        if (!tokens.links[tag]) {
          tokens.links[tag] = {
            href: cap[2],
            title: cap[3]
          }
        }
      }

      // table (gfm)
      else if (cap = block.table.exec(src)) {
        item = {
          type: 'table',
          header: splitCells(cap[1].replace(/^ *| *\| *$/g, '')),
          align: cap[2].replace(/^ *|\| *$/g, '').split(/ *\| */),
          cells: cap[3] ? cap[3].replace(/\n$/, '').split('\n') : []
        }

        if (item.header.length === item.align.length) {
          src = src.substring(cap[0].length)

          for (i = 0; i < item.align.length; i++) {
            if (/^ *-+: *$/.test(item.align[i])) {
              item.align[i] = 'right'
            } else if (/^ *:-+: *$/.test(item.align[i])) {
              item.align[i] = 'center'
            } else if (/^ *:-+ *$/.test(item.align[i])) {
              item.align[i] = 'left'
            } else {
              item.align[i] = null
            }
          }

          for (i = 0; i < item.cells.length; i++) {
            item.cells[i] = splitCells(
              item.cells[i].replace(/^ *\| *| *\| *$/g, ''),
              item.header.length)
          }

          tokens.push(item)
        } else if (DEBUG) {
          // @Incomplete: should never reach here. test to find out what happens if it does reach.
          debugger
        }
      }

      // lheading
      else if (cap = block.lheading.exec(src)) {
        src = src.substring(cap[0].length)
        tokens.push({
          type: 'heading',
          depth: cap[2].charAt(0) === '=' ? 1 : 2,
          text: cap[1]
        })
      }

      // top-level paragraph
      else if (top && (cap = block.paragraph.exec(src))) {
        src = src.substring(cap[0].length)
        tokens.push({
          type: 'paragraph',
          text: cap[1].charAt(cap[1].length - 1) === '\n'
            ? cap[1].slice(0, -1)
            : cap[1]
        })
      }

      // text
      else if (cap = block.text.exec(src)) {
        // Top-level should never reach here.
        src = src.substring(cap[0].length)
        tokens.push({
          type: 'text',
          text: cap[0]
        })
      }

      else if (src) {
        error('Infinite loop on byte: ' + src.charCodeAt(0))
      }
    }

    return tokens
  }

  return token(src, true)
}
