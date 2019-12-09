import { extend, after } from '@hyper/utils'



export default function open_close (opts = {}) {
  opts = extend({
    autoclose: 'autoclose',
    open: 'open',
    closed: 'closed',
    is_open: false,
    pinned: false
  }, opts)

  return {
    open_briefly: function (sec, cb) {
      return (!opts.pinned && this.classList.contains(opts.closed) ? (after(sec, () => {
          if (this.classList.contains(opts.autoclose)) this.close()
          cb && cb()
        }), this.classList.add(opts.autoclose), this.open())
      : false)
    },
    toggle: function () { return this.classList.toggle(opts.closed), opts.is_open = this.classList.toggle(opts.open) },
    open: function () { return this.classList.add(opts.open), this.classList.remove(opts.closed), opts.is_open = true },
    close: function () { return this.classList.remove(opts.autoclose, opts.open), this.classList.add(opts.closed), opts.is_open = false },
    pin: function () { return this.classList.remove(opts.autoclose), opts.pinned = !opts.pinned },
    is_open: () => opts.is_open,
  }
}
