const ip4 = require ('./ipv4')
const ip6 = require ('./ipv6')
const { utf8, encode, decode } = require ('./pct')
const punycode = require ('punycode')
const log = console.log.bind (console)


// Host parsing
// ============

// Just a small part of IDNA/ NamePrep
const tableB1 = /[\u00AD\u034F\u1806\uFEFF\u2060\u180B-\u180D\u200B-\u200D\uFE00-\uFE0F]/g
const tableC6 = /[\uFFF9-\uFFFD]/
const forbidden  = /[\x00\x09\x0A\x0D #%/:<>?@[\\\]^]/
const forbidden_ = /[\x00\x09\x0A\x0D #/:<>?@[\\\]^]/


function Host (type, value) {
  return Object.defineProperties (new String (value),
    { type: { value:type, enumerable:true }},
    { valueOf: { value: () => value }})
}

// NB parseHost preserves percent codes, unless
//  opaque == false and percentCoded == true

function parseHost (input, { percentCoded = false, opaque = true } = { }) {
  const l = input.length
  if (l === 0) return input

  if (input[0] === '[' && input[l-1] === ']')
    return Host ('ip6', `[${ ip6.normalize (input.substring(1, l-1)) }]`)

  else if (opaque) {
    forbidden_.lastIndex = forbidden.lastIndex = 0
    if ((percentCoded ? forbidden_ : forbidden) .test (input))
      throw new Error ('ERR_FORBIDDEN_HOST_CODEPOINT')
    else return Host ('opaque', input)
  }

  else {
    input = punycode.toUnicode (percentCoded ? decode (input) : input)
      . replace (tableB1, '')
      . normalize ('NFKC')

    if (input === '')
      throw new Error ('ERR_TOASCII_YIELDS_EMPTY')

    for (let c of input) { c = c.codePointAt(0)
      const nonchar = 0xFDD0 <= c && c <= 0xFDEF || 
        (c <= 0x10FFFF && ((c >> 1) & 0x7FFF) === 0x7FFF)
      if (nonchar)
        throw new Error ('ERR_NAMEPREP_PROHIBITED_CODEPOINT')
    }
        
    tableC6.lastIndex = 0
    if (tableC6 .test (input))
      throw new Error ('ERR_NAMEPREP_PROHIBITED_CODEPOINT')

    // This check is the same as on decoded opaque hosts
    // However it is still necessary here I think..
    forbidden.lastIndex = 0
    if (forbidden .test (input))
      throw new Error ('ERR_FORBIDDEN_HOST_CODEPOINT')

    try { return Host ('ip4', ip4.print (ip4.parse (input))) }
    catch (e) { if (e instanceof RangeError) throw e }
    // TODO how to store the 'parsedHost' metadata?
    return Host ('domain', input)
  }

}


module.exports = { parseHost }