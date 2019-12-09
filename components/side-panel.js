
import open_close from '@hyper/dom/open-close'

import './side-panel.css'

export default function side_panel_setup (G, side_panel_style, title, content) {
  const {h} = G
  let closer = open_close()

  let side_panel =
  h('.side-panel.closed', {
    boink: closer.toggle,
    assign: closer,
    style: side_panel_style,
  },h('.side-panel-title', {style: {width: side_panel_style.height}},
      h('span', title)), // @Incomplete: add a right/left open/close arrow
    h('.content', content)
  )

  return side_panel
}
