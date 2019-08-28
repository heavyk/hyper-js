import './modal.css'

export default function modal (G, opts = {}) {
  const {h, v, t} = G
  opts.title = v(opts.title || null) // null so that it gets a value. if it remains undefined, the obv won't init.
  opts.close = function close (ev) { ev.target === this && el.rm() }
  opts.content = v(opts.content)
  opts.footer = v(opts.footer)

  // @Incomplete: needs to know about its parent element, so that it can append itself into it
  // @Incomplete: if there is a modal which already exists in the parent element, should it overtake the other one?
  // @Incomplete: switch the close button from text content to use the i.close element instead

  let el =
  h('.modal-background', {boink: opts.close},
    h('.modal',
      t(opts.title, (title) => title ?
        h('h1.header', opts.title,
          h('.modal-close', {boink: opts.close}, h('i.close'))
        ) :
        h('.headerless',
          h('.modal-close', {boink: opts.close}, h('i.close'))
        )
      ),
      h('.modal-content', opts.content),
      t(opts.footer, (foot) => foot ?
        h('.modal-footer', opts.footer) : null
      )
    )
  )

  return el
}
