export function print_error (message, node, id) {
  console.error('Error: ' + message)
  if (id) console.error('  in file: ' + id + (node.loc ? ':' + node.loc.start.line : ''))
}


export function error_context (id, loc, code) {
  let { start, end } = loc.start ? loc : { start: loc, end: loc }
  let { line, column } = start
  let out = ''
  if (id) out += 'in file: '+id+(line ? ':'+line+(column ? ':'+column : '') : '')+'\n'
  if (code) {
    let num_lines = 5
    let lines = code.toString().split(/\r?\n/)
    let index = line - 1
    let pre_lines = Math.ceil((num_lines - 1) / 2)
    let post_lines = Math.floor((num_lines - 1) / 2)

    let pre = lines.slice(Math.max(0, index - pre_lines), index)
    let post = lines.slice(index + 1, index + 1 + post_lines)

    let line_no_width = ((line + post_lines)+'').length + 2
    let line_no = line - pre_lines

    // out += pre.map(l => (line_no++)+': '+l).join('\n')
    // out += (line_no++)+': '+lines[index]
    // out += ' '.repeat(start.column + line_no_width) + '^'.repeat(end.column - start.column + 1)
    // out += post.map(l => (line_no++)+': '+l).join('\n')

    out +=
    pre.map(l => (line_no++)+': '+l).concat([
      (line_no++)+': '+lines[index],
      ' '.repeat(start.column + line_no_width) + '^'.repeat(end.column - start.column + 1)
    ], post.map(l => (line_no++)+': '+l)).join('\n')
  }

  return out
}
