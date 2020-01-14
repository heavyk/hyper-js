import PushStream from '@hyper/streams/push'

export default class ThroughStream extends PushStream {
  constructor () {
    this.paused = true
    this.ended = false
    this.source = this.sink = null
  }

  resume () {
    if (!this.sink.paused) this.source.resume()
  }

  end (err) {
    this.ended = err || true
    return this.sink.end(err)
  }

  abort (err) {
    // should this check if the sink has already ended?
    this.ended = this.sink.ended
    return this.source.abort(err)
  }

  write (data) {
    this.sink.write(data)
  }
}
