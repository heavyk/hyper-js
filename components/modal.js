import { new_ctx } from '@hyper/dom/hyper-ctx'

import './modal.css'

export default function modal (frame, opts = {}) {

  // @Incomplete: needs to know about its parent element, so that it can append itself into it

  let el = new_ctx(undefined, function (G) {
    let {h, v, t} = G
    opts.title = v(opts.title || null) // null so that it gets a value. if it remains undefined, the obv won't init.
    opts.content = v(opts.content(G))
    opts.footer = v(opts.footer)
    let no_close_button = opts.close_button == 0

    let el =
    h('.modal-background', {boink: (ev) => { ev.target === el && !opts.no_background_close && opts.close() }},
      h('.modal',
        t(opts.title, (title) => title ?
          h('h1.header', opts.title,
            no_close_button ? null : {style: {paddingRight: '40px'}},
            no_close_button ? null :
              h('.modal-close', {boink: opts.close}, h('i.close'))
          ) :
          h('.headerless',
            no_close_button ? null :
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
  })

  el.close = opts.close = () => { el.rm() }  // rm both cleans and removes the element
  frame.aC(el)
  return el
}
