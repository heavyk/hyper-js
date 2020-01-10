import Route from './route'
import { parents, assign, isEmpty } from '@hyper/utils'
import { parseUri, parseQS, stringifyQS, stringifyHash, joinPaths } from '@hyper/router-utils'
import { scrollTo } from '@hyper/dom/dom-base'

import EventEmitter from './drip/emitter'

export default class Router extends EventEmitter {
  constructor (options = {}, onnotfound, ondispatch) {
    super()
    let self = this
    self.globals = options.globals || []
    self.basePath = options.basePath || ''
    self.el = options.el
    self.data = options.data || function () { return {} }
    self.history = options.history || history
    // self.strictMode = !!options.strictMode
    self.linksWatcher = null
    self.stateWatcher = null
    self.route = null
    self.onnotfound = onnotfound || options.notfound
    self.ondispatch = ondispatch || options.dispatch
    self.afterdispatch = options.after
    self.routes = []
    self.uri = {}
  }

  addRoute (pattern, Handler, data, observe) {
    let route
    for (var i = 0; i < this.routes.length; i++) {
      if (this.routes[i].Handler === Handler) {
        route = this.routes[i]
        route.addPattern(pattern, data, observe)
      }
    }
    if (!route) {
      route = new Route(pattern, Handler, data, observe, this)
      this.routes.push(route)
    }
    return route
  }

  buildHash (mixIn) {
    var data = this.route.getState().hash

    return !isEmpty(data) || !mixIn
      ? stringifyHash(data)
      : mixIn
  }

  buildQS (mixIn) {
    return stringifyQS(assign.apply(null, [{}].concat(mixIn, this.route.getState().qs)))
  }

  dispatch (path, options) {
    options = options || {}
    // short circuit a path if necessary
    if (typeof this.ondispatch === 'function' && this.ondispatch.call(this, path, options) === false) return
    var uri = parseUri(path)
    var route = this.match(uri.path)
    var oldUri = this.uri

    // 404
    if (!route) {
      return typeof this.onnotfound === 'function' ? this.onnotfound(path)
        : this.redirect(path)
    }

    // prepare data
    var defaults = typeof this.data === 'function' ? this.data() : this.data
    var data = assign(defaults, options.state, options.hash, options.qs)
    // debugger

    if (route === this.route) {
      // don't save a back-button
      // if (options.history === void 9)
      //   options.history = false

      // emit `transition` event
      // can modify: uri, options, data
      this.emit('transition', uri, options, data)

      // update the view's data frov the route (path/qs/hash variables)
      this.uri = uri
      this.route.update(uri, data)
      if (IS_RACTIVE) this.route.view.fire('dispatch')
      this.emit('dispatch')
    } else if (options.reload || shouldDispatch(this.uri, uri, route)) {
      // destroy existing route
      if (this.route) {
        this.route.destroy()
      }

      // emit `transition` event
      // can modify: `uri`, `options`, `data`
      this.emit('transition', uri, options, data)

      // init new route
      this.uri = uri
      this.route = route.init(uri, data)
      if (IS_RACTIVE) this.route.view.fire('dispatch')

      // emit `route` event
      this.emit('route', route)
      this.emit('dispatch', route)
    }

    // will scroll to the top if there is no matching element
    scrollTo(uri.hash.substr(1))

    // update history
    return this.update(!oldUri.path || oldUri.path !== uri.path, options.history !== false, uri)
  }

  getUri () {
    return location.pathname.substr(this.basePath.length) + location.search + location.hash
  }

  init (options) {
    if (this.route) return
    return this.dispatch(this.getUri(), assign({ history: false }, options))
  }

  match (path) {
    var i = -1

    while (this.routes[++i]) {
      if (this.routes[i].match(path)) {
        return this.routes[i]
      }
    }

    return null
  }

  redirect (path) {
    location.pathname = joinPaths(this.basePath, path)
    return false
  }

  unwatchLinks () {
    if (this.linksWatcher) {
      document.body.removeEventListener('click', this.linksWatcher)
      this.linksWatcher = null
    }

    return this
  }

  unwatchState () {
    if (this.stateWatcher) {
      window.removeEventListener('popstate', this.stateWatcher)
      this.stateWatcher = null
    }

    return this
  }

  update (pathChange, history, uri) {
    if (!this.route) {
      return this
    }

    uri = uri || { qs: '', hash: '' }
    var path = joinPaths(this.basePath, this.uri.path)
    var qs = this.buildQS([ parseQS(uri.qs) ].concat(!pathChange ? [ parseQS(location.search) ] : []))
    var hash = this.buildHash(uri.hash)
    var newUri = path + qs + hash
    var oldUri = location.pathname + location.search + location.hash
    var state = this.route.getState().state
    this.uri.qs = qs
    this.uri.hash = hash

    if (history === true) {
      this.history.pushState(state, null, newUri)
    } else if (history === false) {
      this.history.replaceState(state, null, newUri)
    } else if (newUri !== oldUri) {
      this.history.pushState(state, null, newUri)
    }

    return this
  }

  watchLinks (pattern) {
    pattern = pattern || new RegExp('^((https?:)?\\/\\/' + location.hostname.replace(/\./g, '\\.') + '.*|((?!\\/\\/)[^:]+))$')
    var _this = this

    document.body.addEventListener('click', this.unwatchLinks().linksWatcher = function (e) {
      var el = parents(e.target, 'a')

      if (el) {
        var href = el.getAttribute('href') || el.getAttribute('data-href')

        if (href && !el.classList.contains('router-ignore') && pattern.test(href)) {
          var options = { state: {} }

          if (IS_RACTIVE && _this.route && _this.route.view) {
            for (let global of _this.globals) {
              options.state[global] = _this.route.view.get(global)
            }
          }

          _this.dispatch(href, options)

          e.preventDefault()
        }
      }
    })

    return this
  }

  watchState () {
    var _this = this

    window.addEventListener('popstate', this.unwatchState().stateWatcher = function (e) {
      if (e.state) {
        _this.init({ state: e.state })
      }
    })

    return this
  }
}

function shouldDispatch (oldUri, newUri, route) {
  return oldUri.path !== newUri.path
    || oldUri.qs !== newUri.qs
    || (decodeURIComponent(oldUri.hash) !== decodeURIComponent(newUri.hash) && (!route || route.observe.hash.length))
}
