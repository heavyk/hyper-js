export default class CollectStream {
  constructor (cb) {
    this.paused = false
    this.buffer = []
    this._cb = cb
  }

  write (data) {
    this.buffer.push(data)
  }

  end (err) {
    if (err && err !== true) this._cb(err)
    else this._cb(null, this.buffer)
  }
}

// this is a writable so it doesn't have pipe or resume
