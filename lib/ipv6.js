const log = console.log.bind (console)

function parse (input) {
  let parts = [], ip4parts = [], compress = null
  let p = 0, q = p, l = input.length
  let n = 0, r = 16

  if (input[input.length-1] === '.')
    throw new SyntaxError ('Invalid IPv6 address ' + input)

  while (p < l && parts.length <= 8 && ip4parts.length <= 4) { let c = input[p]
    if (r === 16 && 'a' <= c && c <= 'f')
      n = r * n + 10 + (c.charCodeAt(0) - 97 /* -a */)

    else if (r === 16 && 'A' <= c && c <= 'F')
      n = r * n + 10 + (c.charCodeAt(0) - 65 /* -A */)

    else if ('0' <= c && c <= '9')
      n = r * n + (c.charCodeAt(0) - 48 /* -'0' */)

    else if (p && c === '.') {
      if (r === 16) [p, r] = [q-1, 10]
      else ip4parts.push (n)
      n = 0
    }

    else if (r === 16 && c === ':') {
      if (p > q) parts.push (n)
      if (input[p+1] === ':') {
        if (compress !== null)
          throw new SyntaxError ('Invalid IPv6 address ' + input)
        compress = parts.length
        parts.push ('::')
        p++
      }
      [n, q] = [0, p+1]
    }
    else throw new SyntaxError ('Invalid IPv6 address ' + input)
    p++
  }
  // on eof, add the last 'unflushed' number to parts
  (r === 10 ? ip4parts : parts) .push (n)

  if (ip4parts.length) {
    if (ip4parts.length !== 4)
      throw new SyntaxError ('Invalid IPv6 address ' + input)
    let [n1, n2, n3, n4] = ip4parts
    parts.push (0x100 * n1 + n2, 0x100 * n3 + n4)
  }

  // log (parts, compress)
  if (compress !== null) {
    const l = 8 - (parts.length-1)
    const a = []
    for (i=0; i<l; i++) a.push (0)
    parts = [...parts.slice(0, compress), ...a, ...parts.slice (compress+1)]
  }
  
  if (parts.length !== 8)
    throw new SyntaxError ('Invalid ipv6 address.')
  return parts
}

function print (parts) {
  let s0 = 0, l0 = 0, s1 = 0; l1 = 0
  for (let i=0, l=parts.length; i<l; i++) {
    let n = parts[i]
    if (n === 0) [s1, l1] = [i, 0]
    while (n === 0 && i < l)
      [i, l1, n] = [i+1, l1+1, parts[i+1]]
    if (l1 > l0)
      [s0, l0] = [s1, l1]
  }
  parts = parts.map (n => n.toString (16))
  let c = s0 > 0 && s0 + l0 < 8 ? '' : s0 === 0 && l0 === 8 ? '::' : ':'
  if (l0 > 1) parts.splice (s0, l0, c)
  return parts.join (':')
}

const normalize = ip6 => 
  print (parse (ip6))

module.exports = { parse, print, normalize }