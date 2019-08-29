import { extend } from '@lib/utils'



export default function open_close (opts = {}) {
  opts = extend({
    autoclose: 'autoclose',
    open: 'open',
    closed: 'closed',
    pinned: false
  }, opts)

  return {
    open_briefly: function (sec, cb) {
      return (!opts.pinned && this.classList.contains(opts.closed) ? (setTimeout(() => {
          if (this.classList.contains(opts.autoclose)) this.close()
          cb && cb()
        }, sec * 1000), this.classList.add(opts.autoclose), this.open())
      : false)
    },
    toggle: function () { return this.classList.toggle(opts.closed), this.classList.toggle(opts.open) },
    open: function () { return this.classList.add(opts.open), this.classList.remove(opts.closed) },
    close: function () { return this.classList.remove(opts.autoclose, opts.open), this.classList.add(opts.closed) },
    pin: function () { return opts.pinned = !opts.pinned}
  }
}
