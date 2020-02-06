// knicked from from https://github.com/Rich-Harris/roadtrip
// based on v0.5.1
//  - allow for multiple router instantiation
//  - few changes to optimise for my setup
//  - if base is '/xxx', then: /xxx/my/route, /xxx/, and /xxx are all valid starting paths. previously, '/xxx/' (trailing slash) was invalid
//  - 404 route

import { win, location, origin, base_path } from '@hyper/dom/dom-base'
import { href_pathname, href_query, href_hash } from '@hyper/dom/dom-base'
import { lookup_parent_with_attr } from '@hyper/dom/dom-base'
import { on, off, prevent_default } from '@hyper/dom/dom-base'
import { noop, slasher, which, error } from '@hyper/utils'
import isEqual from '@hyper/isEqual'

const QUERYPAIR_REGEX = /^([\w\-]+)(?:=([^&]*))?$/
const SEGMENT_PARAM_REGEX = /^:([\w\-]+)\??$/
const HANDLERS = [ 'beforeenter', 'enter', 'leave', 'update' ]

function get_internal_link_element (event) {
  let el = event.composed ? event.composedPath()[0] : event.target
  while (el && el.nodeName !== 'A') el = el.parentNode

  return (
      !el ||
      el.hasAttribute('download') ||
      el.getAttribute('rel') === 'external' ||
      ~el.href.indexOf('mailto:') ||
      el.target ||
      !sameOrigin(el.href) // TODO: x-origin navigation function (which can do tracking or cancel the event)
    ) ? null : el
}

// @Cleanup: why is this necessary?? seems like the same data structure could be made more succinctly
class RouteData {
  constructor ({ route, pathname, params, query, hash, scrollX, scrollY, isInitial }) {
    this._route = route
    this.pathname = pathname
    this.params = params
    this.query = query
    this.hash = hash
    this.isInitial = isInitial
    this.scrollX = scrollX
    this.scrollY = scrollY
  }

  matches (href) {
    return this._route.matches(href)
  }
}


class Route {
  constructor (path, options, ctx) {
    this.path = path
    this.ctx = ctx || this

    if (typeof options === 'function') {
      options = { enter: options }
    }

    for (let handler of HANDLERS) {
      // only set the update function if we're given it
      if (handler !== 'update' || typeof options[handler] === 'function') {
        this[handler] = (route, other) => {
          let value, fn

          if (typeof (fn = options[handler]) === 'function') {
            value = fn.call(this.ctx, route, other)
          }

          return Promise.resolve(value)
        }
      }
    }
  }

  set path (_path) {
    let path = slasher(_path, 1)
    this._path = path
    this.segments = path.split('/')
  }

  get path () {
    return this._path
  }

  matches (href) {
    return segmentsMatch(slasher(href_pathname(href), 1).split('/'), this.segments)
  }

  exec (target, isInitial, is404) {
    let href = target.href
    let pathname = slasher(href_pathname(href), 1)
    let segments = pathname.split('/')
    let _segments = this.segments
    let params = {}

    if (!is404) {
      if (segments.length > _segments.length) {
        return false
      }

      for (let i = 0; i < segments.length; i++) {
        let segment = segments[i], matches
        let segment_to_match = _segments[i]

        if (segment_to_match[0] === ':') {
          matches = SEGMENT_PARAM_REGEX.exec(segment_to_match)
          params[matches[1]] = segment
        } else if (segment !== segment_to_match) {
          return false
        }
      }
    }

    const query = {}
    const queryPairs = href_query(href)

    for (let i = 0; i < queryPairs.length; i++) {
      const match = QUERYPAIR_REGEX.exec(queryPairs[i])

      if (match) {
        const key = match[1]
        const value = decodeURIComponent(match[2])

        if (query.hasOwnProperty(key)) {
          if (!Array.isArray(query[key])) {
            query[key] = [ query[key] ]
          }

          query[key].push(value)
        } else {
          query[key] = value
        }
      }
    }

    return new RouteData({
      route: this,
      isInitial,
      pathname,
      params,
      query,
      hash: href_hash(href),
      scrollX: target.scrollX,
      scrollY: target.scrollY
    })
  }
}

function segmentsMatch (a, b) {
  if (a.length > b.length) return

  let i = a.length
  while (i--) {
    if ((a[i] !== b[i]) && (b[i][0] !== ':')) {
      return false
    }
  }

  return true
}


const sameOrigin = (href) => typeof href === 'string' && href.indexOf(origin) === 0
const isSameRoute = (routeA, routeB, dataA, dataB) => (
  routeA === routeB &&
  dataA.hash === dataB.hash &&
  isEqual(dataA.params, dataB.params) &&
  isEqual(dataA.query, dataB.query)
)

export default class RoadTrip {
  constructor (base = '', container_el) {
    let self = this
    self.routes = []
    self.transitioning = null
    self.uniqueID = self.currentID = 1
    self.scrollHistory = {}
    self.cur_data = {}
    self.cur_route = {
      enter: () => Promise.resolve(),
      leave: () => Promise.resolve()
    }

    if (base[0] !== '/') error("base must begin with a '/'")
    let bl = base.length - 1
    self.base = base[bl] === '/' ? base.substr(0, bl) : base

    if (!container_el) container_el = win
    let parent = lookup_parent_with_attr(container_el, 'roadtrip')
    if (parent) {
      if (DEBUG) console.info('parent:', parent)
      error('parent element is already on a roadtrip!')
    } else {
      container_el.roadtrip = self
    }
  }

  add (path, options, ctx = this) {
    if (path == 404) this._404 = new Route(path, options, ctx)
    else this.routes.push(new Route(this.base + (path === '/' ? '' : path), options, ctx))
    return this
  }

  start (options = {}) {
    // TODO: maybe put a base detector here..
    // it would get basePath and then split it into segments.
    // first get the max segments length
    // next, for all routes which match
    // eg. if the current path is 4 segments long, and the longest route is 2 segments, then we can assume that for /xxx/xxx/yyy/yyy, /xxx/xxx is the base, and /yyy/yyy is the route (where /yyy/yyy matches one of the routes)

    // changed to pathname
    const start_href = location.pathname // location.href
    const href = this.routes.some(route => route.matches(start_href)) ?
      start_href :
      options.fallback || this.base

    this.initial = true
    return this.goto(href, {
      replace: true,
      scrollX: win.scrollX,
      scrollY: win.scrollY
    })
  }

  goto (href = '/', options = {}) {
    this.scrollHistory[this.currentID] = {
      x: win.scrollX,
      y: win.scrollY
    }

    if (href[0] === '/' && this.base && href.indexOf(this.base) !== 0) {
      href = this.base + href
    }

    let target
    if ((href = slasher(href)) === this.base) {
      // the base dir should always end with a slash.
      // if for example the base is '/lala' and it does not have a trailing slash,
      // instaed of loading '/lala/lib.js', it'll attempt to load '/lib.js'
      // so, it must be set in the browser history as '/lala/' so it doesn't get
      // confused.
      //
      //               -kenny 12-01-2020
      href += '/'
    }
    const promise = new Promise((fulfil, reject) => {
      target = this._target = {
        href,
        scrollX: options.scrollX || 0,
        scrollY: options.scrollY || 0,
        options,
        fulfil,
        reject
      }
    })

    target.promise = promise

    // only if we're not transitioning, will we goto the target
    if (this.transitioning === null) this.goto_target(target)

    return promise
  }

  goto_target (target) {
    let cur_data = this.cur_data
    let cur_route = this.cur_route
    let new_route
    let new_data
    let promise

    if (target.options.code === 404) {
      if (new_route = this._404) new_data = new_route.exec(target, this.initial, true)
      else error('no handler for 404 is present')
    } else {
      for (let route of this.routes) {
        if (new_data = route.exec(target, this.initial)) {
          new_route = route
          this.initial = false
          break
        }
      }

      // 404's don't replace state
      if (isSameRoute(new_route, cur_route, new_data, cur_data)) {
        target.options.replace = true
      }
    }

    if (!new_route) {
      // this can only happen if a 404 is not defined
      return this.goto(this.base + '/')
    }

    this.scrollHistory[ this.currentID ] = {
      x: (cur_data.scrollX = win.scrollX),
      y: (cur_data.scrollY = win.scrollY)
    }

    this.transitioning = target

    promise =
      new_route === cur_route && typeof new_route.update === 'function' ?
        new_route.update(new_data, cur_data)
      : cur_route.leave(cur_data, new_data)
        .then(() => new_route.beforeenter(new_data, cur_data))
        .then(() => new_route.enter(new_data, cur_data))
        .catch((err) => {
          // @Incomplete: better error message reporting
          error(err)
        })

    promise
      .then((val) => {
        this.cur_route = new_route
        this.cur_data = new_data
        this.transitioning = null

        // if the user navigated while the transition was taking
        // place, we need to do it all again
        if (this._target !== target) {
          this.goto_target(this._target)
          this._target.promise.then(target.fulfil, target.reject)
        } else {
          target.fulfil(val)
        }
      })
      .catch(target.reject)

    const { replace, invisible, code } = target.options

    if (target.popstate || invisible) return

    const uid = replace ? this.currentID : ++this.uniqueID
    if (DEBUG) console.info(replace ? 'replace' : 'new', 'location:', target.href)
    win.history[ replace ? 'replaceState' : 'pushState' ]({ uid, code }, '', target.href)

    this.currentID = uid
    this.scrollHistory[ this.currentID ] = {
      x: target.scrollX,
      y: target.scrollY
    }

    return promise
  }
}

// Adapted from https://github.com/visionmedia/page.js
// MIT license https://github.com/visionmedia/page.js#license
// further modification from https://github.com/Rich-Harris/roadtrip/blob/master/src/utils/watchLinks.js
//  - added link detection in custom elements
//  - allow the link watching to be contained to an element (workaround for document level passive listeners)

export function watchLinks (roadtrip, container_el) {
  let cancel_event_and_goto = (event, path, options) => {
    // preventDefault on document level ecents is no longer possible starting with chrome 56
    // (all document level event listeners are considered passive by default)
    // https://www.chromestatus.com/feature/5093566007214080
    // this, is why container_el is given as an option. however, if none is given,
    // it will still install a (performance limiting) non-passive handler.

    prevent_default(event)
    return roadtrip.goto(path, options)
  }

  let click_handler = (event) => {
    // TODO: hopefully uglify merges the return statements into one statement. if not, merge them reducing the number of return statements
    let w  = which(event), el, path, goto_path
    if (
        (w !== 1 && w !== 0) ||
        (event.metaKey || event.ctrlKey || event.shiftKey) ||
        (event.defaultPrevented) ||
        !(el = get_internal_link_element(event))
      ) return

    // rebuild path
    path = el.pathname + el.search + (el.hash || '')

    // same page
    goto_path = path

    if (roadtrip.base) {
      if (path.indexOf(roadtrip.base) === 0) path = path.substr(roadtrip.base.length)
      if (goto_path === path) {
        path = roadtrip.base + path
        if (roadtrip.routes.some(route => route.matches(path))) goto_path = path
        else return cancel_event_and_goto(event, path, {code: 404})
      }
    }

    // no match? allow navigation if roadtrip._404 isn't set
    if (!roadtrip.routes.some(route => route.matches(goto_path)) && !roadtrip._404) {
      return cancel_event_and_goto(event, goto_path, {code: 404})
    }

    cancel_event_and_goto(event, goto_path, {code: 200})
  }

  let popstate_handler = (event) => {
    let state = event.state
    let scroll = roadtrip.scrollHistory[state.uid]
    if (state) {
      // hashchange, or otherwise outside roadtrip's control
      roadtrip._target = {
        href: location.href,
        scrollX: scroll.x || 0,
        scrollY: scroll.y || 0,
        popstate: true, // so we know not to manipulate the history
        options: state,
        fulfil: noop,
        reject: noop
      }

      roadtrip.goto_target(roadtrip._target)
      roadtrip.currentID = event.state.uid
    }
  }

  // watch history & clicks
  // if chrome complains about document level listeners now being passive,
  // (and as a result, preventDefault no longer works so navigation takes place anyway...)
  // to fix this, pass `watchLinks` an element which frames your content

  // there is another solution: when a like is clicked, have the click handler add
  // click_hakdler to the link if it's not already added. use a WeakMap to check
  // its existance. before doing this work, need to check to see if it's actually
  // not a passive listener
  //
  //         -kenny 12-01-2020

  let is_passive = { passive: false, capture: true }
  on(container_el, 'click', click_handler, is_passive)
  on(container_el, 'touchstart', click_handler, is_passive)
  on(win, 'popstate', popstate_handler, { passive: true })

  // return a remove function
  return () => {
    off(container_el, 'click', click_handler, is_passive)
    off(container_el, 'touchstart', click_handler, is_passive)
    off(win, 'popstate', popstate_handler, { passive: true })
  }
}
