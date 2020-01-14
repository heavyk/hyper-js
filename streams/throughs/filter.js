import PushStream from '@hyper/streams/push'

export default class FilterStream extends ThroughStream {
  constructor (fn) {
    this.fn = fn
  }

  write (data) {
    if (this.fn(data)) this.sink.write(data)
    this.paused = this.sink.paused
  }
}
