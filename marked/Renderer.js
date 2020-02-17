import { defaults } from './defaults.js'
import { cleanUrl, unescape } from './helpers.js'

import { each } from '@hyper/utils'
import { parseQS, stringifyQS } from '@hyper/router-utils'

// import { mergeDeep as merge } from '@hyper/utils'




function youtube_id (url) {
  let cap = /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#&?]*).*/.exec(url)
  return cap && cap[7].length === 11 ? cap[7] : url;
}

function vimeo_id (url) {
  const cap = /https?:\/\/(?:www\.|player\.)?vimeo.com\/(?:channels\/(?:\w+\/)?|groups\/([^/]*)\/videos\/|album\/(\d+)\/video\/|)(\d+)(?:$|\/|\?)/.exec(url)
  return cap && typeof cap[3] === 'string' ? cap[3] : url;
}

function vine_id (url) {
  const cap = /^http(?:s?):\/\/(?:www\.)?vine\.co\/v\/([a-zA-Z0-9]{1,13}).*/.exec(url)
  return cap && cap[1].length === 11 ? cap[1] : url;
}

function prezi_id (url) {
  const cap = /^https:\/\/prezi.com\/(.[^/]+)/.exec(url)
  return cap ? cap[1] : url;
}

function osf_id (url) {
  const cap = /^http(?:s?):\/\/(?:www\.)?mfr\.osf\.io\/render\?url=http(?:s?):\/\/osf\.io\/([a-zA-Z0-9]{1,5})\/\?action=download/.exec(url)
  return cap ? cap[1] : url;
}

let services = {
  youtube: (href) => {
    // ...
    let url = new URL(href)
    let id = youtube_id(url)
    let start = 0
    // let params = url.search.split(/[#?&]/).reduce((params, p, kv) => {
    //   kv = p.split('=')
    //   if (kv.length > 1) params[kv[0]] = kv[1]
    //   return params
    // }, {})
    let params = parseQS(url.search)
    delete params.v

    if (params.t) {
      let parts = /[0-9]+/g.exec(params.t)
      start = parts.reverse().reduce((start, p, i) => {
        return start + ((p*1) * Math.pow(60, i))
      }, 0)
      if (start) params.start = start
      delete params.t
    }

    // console.log(url, id, start, params)
    // console.log(`https://${url.host}/embed/${id}${stringifyQS(params)}`)
    return `https://youtube.com/embed/${id}${stringifyQS(params)}`
  },

  // generic embed
  embed: (url) => cleanUrl(url),

  vimeo: (url) => {
    // ...
  },

  vine: (url) => {
    // ...
  },

  prezi: (url) => {
    // ...
  },

  osf: (url) => {
    // ...
  },
}

/**
 * Renderer
 */
export default function Renderer (G, options = {}) {
  let { h } = G

  function link (href, title, text) {
    // debugger
    return !(href = cleanUrl(options.baseUrl, href))
      ? text
      : h('a', {href, title}, text)
  }

  // link, reflink, nolink
  link[''] = link // itself. no prefix

  // image, refimage
  link['!'] = function (src, title, text) {
    return !(src = cleanUrl(options.baseUrl, src))
      ? text
      : h('img', {src, title, alt: text}, text)
  }

  // embed service (youtube, vimeo, vine, etc.)
  link['@'] = function (href, title, service, get_url) {
    return h('.block-embed service-'+service,
      (get_url = services[service])
        ? h('iframe', {src: get_url(href), type: 'text/html', frameBorder: 0, allow: 'accelerometer;autoplay;encrypted-media;gyroscope;picture-in-picture', allowFullscreen: 1})
        : h(0, `embed service '${service}' not supported`)
    )
  }

  return {
    link,
    code (code, infostring, escaped) {
      const lang = (infostring || '').match(/\S*/)[0]
      if (options.highlight) {
        const out = options.highlight(code, lang)
        if (out != null && out !== code) {
          escaped = true
          code = out
        }
      }

      return h('pre',
        h('code', {
          c: lang ? options.langPrefix + lang : '',
          html: escaped ? code : escape(code),
        })
      )
    },

    // el (tag, params) {
    //   return h(tag, params)
    // },

    blockquote (quote) {
      return h('blockquote', quote)
    },

    heading (text, level, raw, slugger) {
      return options.headerIds
        ? h('h'+level, {id: options.headerPrefix + slugger(h(0, raw).textContent)}, text)
        : h('h'+level, text)
    },

    hr () {
      return h('hr')
    },

    list (body, ordered, start) {
      return h(ordered ? 'ol' : 'ul', {start: ordered && start !== 1 ? start : undefined}, body)
    },

    // listitem (text) {
    listitem (body, task, checked) {
      // console.log('listitem', task, checked)
      return h('li', {c: task && 'task'}, body)
    },

    checkbox (checked) {
      return h('input', {type: 'checkbox', checked, disabled: 1})
    },

    paragraph (text) {
      return h('p', text)
    },

    table (header, body) {
      return h('table',
        h('thead', header),
        body ? h('tbody', body) : body,
      )
    },

    tablerow (content) {
      return h('tr', content)
    },

    tablecell (content, flags) {
      return h(flags.header ? 'th' : 'td', {align: flags.align}, content)
    },

    // span level renderer
    strong (text) {
      return h('strong', text)
    },

    em (text) {
      return h('em', text)
    },

    codespan (text) {
      return h('code', text)
    },

    br () {
      return h('br')
    },

    del (text) {
      return h('del', text)
    },

    text (text) {
      return text
    },
  }
}
