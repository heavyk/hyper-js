import ThroughStream from './through'

export default class MapStream extends ThroughStream {
  construcmtor (fn) {
    this.fn = fn
  }

  write (data) {
    this.sink.write(this.fn(data))
    this.paused = this.sink.paused
  }
}
