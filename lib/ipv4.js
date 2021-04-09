const log = console.log.bind (console)

const _ip4num = /(?:0[xX]([0-9A-Fa-f]*)|(0[0-7]*)|([1-9][0-9]*))([.]?)/yg

function parse (input) {
  _ip4num.lastIndex = 0
  let addr = 0, count = 0
  let match, err = false

  while ((match = _ip4num.exec (input))) {
    count ++
    const num
      = match[1] ? parseInt (match[1]||'0', 16)
      : match[2] ? parseInt (match[2], 8)
      : parseInt (match[3], 10)

    if (_ip4num.lastIndex === input.length) {
      const rest = 5 - count
      if (err || (num >= 256**rest))
        throw new RangeError (`Invalid IPv4 address: <${input}>`)
      return (addr << 8 * rest) + num
    }
    else {
      if (count === 4 || !match[4]) throw new Error ()
      err = err || (num > 255)
      addr = (addr << 8) + num
    }
  }
  throw new Error ()
}

function print (num) {
  let r = ''
  for (let i=3; i; i--) r += ((num >>> 8*i) & 255) + '.'
  return r + (num & 255)
}

function normalize (input) {
  return print (parse (input))
}

module.exports = { parse, print, normalize }