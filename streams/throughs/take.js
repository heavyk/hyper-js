import ThroughStream from './through'

export default class TakeStream extends ThroughStream {
  constructor (fn, opts) {
    this.fn = fn
    this._includeLast = opts && opts.last
  }

  write (data) {
    var test = this.fn(data)
    if (test || this._includeLast) {
      this.sink.write(data)
      this.paused = this.sink.paused
    }
    if (test)
      this.source.abort()
  }
}
