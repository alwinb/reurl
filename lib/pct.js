const wtf8 = require ('wtf-8')
const log = console.log.bind (console)

// UTF8 coding
// -----------

const [h2, h3, h4, h5] = [ 0b10<<6, 0b110<<5, 0b1110<<4, 0b11110<<3  ]
const [t6, t5, t4, t3] = [ ~(-1<<6), ~(-1<<5),  ~(-1<<4),   ~(-1<<3) ]

const utf8 = {
  
  decode (code) {
    if (code < 0x80) return [code]
    else if (code < 0x800) {
      const [c1, c2] = [code >> 6, code & t6]
      return [h3|(t5 & c1), h2|(t6 & c2)]
    }
    else if (code < 0x10000) {
      const [c1, c2, c3] = [code >> 12, code >> 6, code & t6]
      return [h4|(t4 & c1), h2|(t6 & c2), h2|(t6 & c3)]
    }
    else {
      const [c1, c2, c3, c4] = [code >> 18, code >> 12, code >> 6, code & t6]
      return [h5|(t3 & c1), h2|(t6 & c2), h2|(t6 & c3), h2|(t6 & c4)]
    }
  }

}

// Percent Coding
// --------------

// The set of characters to be encoded depends on the property-key and
// on the 'mode'. The mode is computed from the structure of the URL. 

const modes =
  { regular: 0b100, special: 0b101, relative: 0b010 }

// Lookup tables
// I'm using bitmasks for the modes, and offsets for the keys.
// There are 5 keys times three mode-bits, 
// thus 15 bits of info per character to encode the escape sets. 

const _offsets =
  { user:12, pass:12, host:9, dir:6, file:6, query:3, hash:0 }

function charInfo (c) {
  // Escape C0 controls, C1 controls and DEL
  if (c <= 31 || 127 <= c && c < 160) return ~0
  // Lookup tables for 32-39, 47, 58-64, 91-96, 123-126
  if (32 <= c && c <= 39) return t32 [c - 32]
  if (c === 47) return t47 [c-47]
  if (58 <= c && c <= 64) return t58 [c - 58]
  if (91 <= c && c <= 96) return t91 [c - 91]
  if (123 <= c && c <= 126) return t123 [c - 123]
  // Escape surrogate halves and non-characters
  if (0xD800 <= c && c <= 0xDFFF) return ~0
  if (0xFDD0 <= c && c <= 0xFDEF || (c <= 0x10FFFF && ((c >> 1) & 0x7FFF) === 0x7FFF)) return ~0
  // Don't escape anything else
  return 0
}

const t32 = [
/*  32 ( ) */ 0b111111101111111,
/*  33 (!) */ 0,
/*  34 (") */ 0b111000101111111,
/*  35 (#) */ 0b111111111111000,
/*  36 ($) */ 0,
/*  37 (%) */ 0b111111111111111,
/*  38 (&) */ 0,
/*  39 (') */ 0b000000000001000 ]

const t47 = [
/*  47 (/) */ 0b111111111000000 ]

const t58 = [
/*  58 (:) */ 0b111111000000000,
/*  59 (;) */ 0b111000000000000,
/*  60 (<) */ 0b111111101111111,
/*  61 (=) */ 0b111000000000000,
/*  62 (>) */ 0b111000101111111,
/*  63 (?) */ 0b111111111000000,
/*  64 (@) */ 0b111111000000000 ]

const t91 = [
/*  91 ([) */ 0b111111000000000,
/*  92 (\) */ 0b111001001000000,
/*  93 (]) */ 0b111111000000000,
/*  94 (^) */ 0b111111000000000,
/*  95 (_) */ 0,
/*  96 (`) */ 0b111000101000111 ]

const t123 = [
/* 123 ({) */ 0b111000101000000,
/* 124 (|) */ 0b111000000000000,
/* 125 (}) */ 0b111000101000000,
/* 126 (~) */ 0b000000000000000 ]


const utf8decode = utf8.decode
const toHex = n => 
  String.fromCharCode((n < 10 ? 48 : 55) + n)


class Encoder {

  constructor ({ ascii=false, percentCoded=false, special=false, relative=false } = { }) {
    this.ascii = ascii
    this.percentCoded = percentCoded
    this.mode = relative ? modes.relative : special ? modes.special : modes.regular
  }

  encode (value, key = 'dir') {
    if (!(key in _offsets))
      return value

    const { ascii, percentCoded } = this
    const mask = this.mode << _offsets[key]
    let out = ''

    for (const char of value) {
      const c = char.codePointAt (0)
      const escape = percentCoded && c === 0x25 ? false : ascii && c > 127 || charInfo (c) & mask
      if (escape) for (let byte of utf8decode (c))
        out += ('%' + toHex (byte >> 4) + toHex (byte & 0b1111))
      else
        out += (char)
    }
    return out
  }
  
}

// Percent Decoding
// ----------------

const PERCENT = /%([0-9a-fA-F]{2})/g
const _dont = { scheme:1, port:1, drive:1, root:1 }

function decode (value, k) {
  if (value == null) return null
  if (k === 'dirs') return value.map (_ => decode (_, 'dir'))
  if (k in _dont) return value
  value = wtf8 .encode (value) .replace (PERCENT, pct => String.fromCharCode (parseInt (pct.substr(1), 16)))
  value = wtf8 .decode (value)
  return value
}

const encode = options => (value, key) => {
  const coder = new Encoder (options)
  if (value == null) return null
  if (key === 'dirs') return value.map (_ => coder.encode (_, 'dir'))
  else return coder.encode (String (value), key)
}


// Exports
// -------

module.exports = { utf8, Encoder, encode, decode }