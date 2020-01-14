import PushStream from '@hyper/streams/push'

export default class ValueStream extends PushStream {
  constructor (values) {
    this._i = 0
    this._values = values
    this.paused = true
    this.sink = null // no source, because this is the source.
  }

  resume () {
    while(!this.sink.paused && !(this.ended || (this.ended = this._i) >= this._values.length))
    this.sink.write(this._values[this._i++])

    if (this.ended && !this.sink.ended)
      this.sink.end()
  }

  abort (err) {
    this.sink.end(this.ended = err || true)
  }
}
