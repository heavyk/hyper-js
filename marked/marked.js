import Lexer from './Lexer.js'
import Parser from './Parser.js'
import Renderer from './Renderer.js'
import TextRenderer from './TextRenderer.js'
import InlineLexer from './InlineLexer.js'
import Slugger from './Slugger.js'

import { merge, error } from '@hyper/utils'

import { escape } from './helpers.js'

import { defaults } from './defaults.js'

/*
the main changes to marked are:
1. the utilisation of hyperscript for rendering the elements.
2. removal of escaping (not necessary when instantiating the element with hyperscript)
3. remove raw blocks (they're all raw now)
4. update to modern es6 syntax
5. most errors are thrown only in debug mode (and from the error function to prevent depotimisation)
6. gfm+breaks is now default. other flavours are disabled
7. remove:
  - opts.xhtml (not necessary)
  - opts.sanitize (was deprecated)
  - opts.sanitizer (was deprecated)
  - opts.pedantic (always false)
  - opts.breaks (always true)
  - opts.gfm (always true)
  - opts.silent (uses error() error handler now)
/**
 * Marked
 */
function marked (src, opt, callback) {
  // throw error in case of non string input
  if (DEBUG && typeof src === 'undefined' || src === null) {
    error('marked(): input parameter is undefined or null')
  }
  if (DEBUG && typeof src !== 'string') {
    error('marked(): input parameter is of type '
      + Object.prototype.toString.call(src) + ', string expected')
  }

  if (typeof opt === 'function') {
    callback = opt
    opt = null
  }

  if (callback) {
    opt = merge({}, defaults, opt || {})
    const highlight = opt.highlight
    let tokens, pending, i = 0

    try {
      tokens = Lexer.lex(src, opt)
    } catch (e) {
      return callback(e)
    }

    pending = tokens.length

    function done (err) {
      if (err) {
        opt.highlight = highlight
        return callback(err)
      }

      let out

      try {
        out = Parser.parse(tokens, opt)
      } catch (e) {
        err = e
      }

      opt.highlight = highlight

      return err
        ? callback(err)
        : callback(null, out)
    }

    if (!highlight || highlight.length < 3) {
      return done()
    }

    delete opt.highlight

    if (!pending) return done()

    for (; i < tokens.length; i++) {
      (function (token) {
        if (token.type !== 'code') {
          return --pending || done()
        }
        return highlight(token.text, token.lang, function (err, code) {
          if (err) return done(err)
          if (code == null || code === token.text) {
            return --pending || done()
          }
          token.text = code
          token.escaped = true
          --pending || done()
        })
      })(tokens[i])
    }

    return
  }
  try {
    opt = merge({}, defaults, opt || {})
    return Parser.parse(Lexer.lex(src, opt), opt)
  } catch (e) {
    // e.message += '\nPlease report this to https://github.com/markedjs/marked.'
    // if ((opt || defaults).silent) {
    //   return '<p>An error occurred:</p><pre>'
    //     + escape(e.message + '', true)
    //     + '</pre>'
    // }
    // throw e
    error(e)
  }
}

/**
 * Options
 */

marked.options = function (opt) {
  merge(defaults, opt)
  return marked
}


/**
 * Expose
 */

marked.Parser = Parser
marked.parser = Parser.parse

marked.Renderer = Renderer
marked.TextRenderer = TextRenderer

marked.Lexer = Lexer
marked.lexer = Lexer.lex

marked.InlineLexer = InlineLexer
marked.inlineLexer = InlineLexer.output

marked.Slugger = Slugger

marked.parse = marked

export default marked
