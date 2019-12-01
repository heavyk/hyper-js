export function print_error (message, id, loc, code) {
  console.error(message || 'Unknown Error')
  if (code) console.error(error_context(id, loc, code))
  else if (id) console.error('  in: ' + id + (loc ? ':' + loc.start.line : ''))
}


export function error_context (id, loc, code, opts = {}) {
  let { start, end } = loc.start ? loc : { start: loc, end: loc }
  let { line, column } = start
  let out = ''
  if (id) out += '  in: '+id+(line ? ':'+line+(column ? ':'+column : '') : '')+'\n'
  if (code) {
    let num_lines = opts.lines === undefined ? 5 : opts.lines
    let lines = code.toString().split(/\r?\n/)
    let index = line - 1
    let pre_lines = Math.ceil((num_lines - 1) / 2)
    let post_lines = Math.floor((num_lines - 1) / 2)

    let pre = lines.slice(Math.max(0, index - pre_lines), index)
    let post = lines.slice(index + 1, index + 1 + post_lines)

    let line_num_width = ((line + post_lines)+'').length + 1
    let line_num = line - pre_lines

    // ----

    let ident = (s) => s

    let txt_line_num = opts.txtLineNumber || ident
    let txt_arrows = opts.txtArrows || ident
    let txt_spaces = opts.txtSpaces || ident
    let txt_before_highlight = opts.txtBeforeHighlight || ident
    let txt_highlight = opts.txtHighlight || ident
    let txt_after_highlight = opts.txtAfterHighlight || ident

    let line_txt = lines[index]
    let arrows = txt_arrows('^'.repeat(end.column - start.column + 1))
    let spaces = txt_spaces(' '.repeat(start.column + line_num_width))

    let before_highlight = txt_before_highlight(line_txt.substring(0, start.column))
    let highlight = txt_highlight(line_txt.substring(start.column, end.column))
    let after_highlight = txt_after_highlight(line_txt.substr(end.column))

    // ---

    out +=
    pre.map(line => txt_line_num((line_num++)+':') + ' '+line).concat([
      txt_line_num((line_num++)+':')+ ' '+(before_highlight + highlight + after_highlight),
      spaces + arrows
    ], post.map(line => txt_line_num((line_num++)+':')+' '+line)).join('\n')
  }

  return out
}
