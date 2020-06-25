const log = console.log.bind (console)

function takeFrom (input) {
  let rest = input
  const take = (regex, fn) => {
    let result = null
    regex.lastIndex = 0
    rest = rest.replace (regex, (...args) => {
      result = fn ? fn (...args) : args
      return ''
    })
    return result
  }
  return { get eof () { return rest === '' }, take }
}

const NUM = new RegExp ('(?:\
0([0-7]+)\
|0[xX]([0-9a-fA-F]*)\
|(0|[1-9][0-9]*)\
)\
([.])?($)?')

function parseNums (input) {
  let x = takeFrom (input)
  let nums = []
  let dot = true
  while (!x.eof && nums.length < 4) {
    let chunk = x.take (NUM, (_,o,h,d,_dot) => { 
      dot = _dot
      let [n, r] = o != null ? [o, 8] : h != null ? [h||'0', 16] : [d, 10]
      nums.push (parseInt (n, r))
    })
    if (chunk === null) break
  }
  if (!x.eof) throw new SyntaxError ('Invalid IPv4 address')
  return nums
}

// 1 to 4 ip4numbers separated by '.' and an optional trailing '.'
// not an ip4 address otherwise
// invalid if the numbers are out of bounds

function parse (input) {
  if (!input) throw new SyntaxError ('Invalid IPv4 address')
  const numbers = parseNums (input)
  // const parts = parseParts (input)
  // const numbers = parts.map (parseNumber)
  const last = numbers.pop ()
  if (last >= 256 ** (4 - numbers.length))
    throw new RangeError ()
  let count = 0, address = last
  for (let n of numbers) {
    if (n > 255) throw new RangeError ('IPv4 component out of range: ' + n)
    address += n * 256 ** (3-count)
    count ++
  }
  return address
}

function parseParts (input) {
  const parts = input.split ('.')
  if (parts.length && parts[parts.length-1] === '') parts.pop () // optional last '.' is ignored
  if (parts.length > 4) throw new SyntaxError ('Invalid IPv4 address')
  for (let p of parts) if (p === '') throw new SyntaxError ('Invalid IPv4 address')
  return parts
}

const R_IP4NUM = new RegExp('^(?:\
(0|[1-9][0-9]*)\
|0[xX]([0-9a-fA-F]*)\
|0([0-7]*)\
)$')

function parseNumber (input) {
  const r = R_IP4NUM.exec (input)
  if (r == null) throw new SyntaxError ('Invalid IPv4 address')
  let i = 1; while (r[i] == null && i<3) i++
  const n = r[i] === '' ? 0 : parseInt (input, i === 1 ? 10 : i === 2 ? 16 : 8)
  return n
}

function print (address) {
  let out = '', n = address
  for (let i=1; i<4; i++) {
    out = `.${n % 256}${out}`
    n = Math.floor (n/256)
  }
  return `${n % 256}${out}`
}

function normalize (input) {
  return print ( parse (input))
}

module.exports = { parse, print, normalize }