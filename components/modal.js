import { new_ctx } from '@hyper/dom/hyper-ctx'

import './modal.css'

export default function modal (G, opts = {}) {
  let ctx = new_ctx(G)
  let {h, v, t} = ctx

  opts.title = v(opts.title || null) // null so that it gets a value. if it remains undefined, the obv won't init.
  opts.content = v(opts.content(ctx))
  opts.footer = v(opts.footer)
  let close = opts.close = () => {
    el.rm()
    ctx.cleanup()
  }

  // @Incomplete: needs to know about its parent element, so that it can append itself into it
  // @Incomplete: if there is a modal which already exists in the parent element, should it overtake the other one?
  // @Incomplete: switch the close button from text content to use the i.close element instead

  let el =
  h('.modal-background', {boink: (ev) => { ev.target === el && close() }},
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
  el.close = close

  return el
}
