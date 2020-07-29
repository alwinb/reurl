const wtf8 = require ('wtf-8')
const log = console.log.bind (console)
const setProto = Object.setPrototypeOf

// Percent Coding
// ==============


// Escape Sets
// -----------

// TODO explain

const escapeSets =
  { user:1<<1, pass:1<<2, host:1<<3, port:1<<4, dir:1<<7, file:1<<8, query:1<<9, hash:1<<10 }

const _e = escapeSets
const creds = _e.user | _e.pass
const path = _e.dir | _e.file
const auth = creds | _e.host
const all = auth | path | _e.query | _e.hash

const symbolMap = {
 ' ': all,
 '<': all,
 '>': all,
 '/': auth | path,
 '?': auth | path,
 ':': auth, '@': auth, '[': auth, ']': auth, '^': auth, '\\': auth,
 '`': creds | path | _e.hash,
 '"': creds | path | _e.query | _e.hash,
 '#': creds | path | _e.query,
 '{': creds | path,
 '}': creds | path,
 ';': creds,
 '=': creds,
 '|': creds,
}

const specialSymbolMap = setProto ({
  "'": _e.query,
 '\\': auth | path,
}, symbolMap)

const nonBaseSymbolMap = setProto ({
 ' ': auth | _e.query | _e.hash,
 '<': auth | _e.query | _e.hash,
 '>': auth | _e.query | _e.hash,
 '`': creds | _e.hash,
 '"': creds | _e.query | _e.hash,
 '#': creds | _e.query,
 '{': creds,
 '}': creds,
}, symbolMap)

const _p = n => 
  String.fromCharCode((n < 10 ? 48 : 55) + n)

const _pct = byte =>
  `%${_p (byte >> 4)}${_p (byte & 0b1111)}`



// UTF8 encoding
// -------------

const [h2, h3, h4, h5] = [ 0b10<<6, 0b110<<5, 0b1110<<4, 0b11110<<3]
const [t6, t5, t4, t3] = [ ~(-1<<6), ~(-1<<5),  ~(-1<<4),   ~(-1<<3)]

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

const encode = ({ ascii=false, percentCoded=false, special=false, nonbase=false } = { }) => (v, k) => {
  const decode = utf8.decode
  if (v == null) return null
  const out = []
  const escapeSet = (k in escapeSets ? escapeSets [k] : 0)
  const symbolMap_ = nonbase ? nonBaseSymbolMap : special ? specialSymbolMap : symbolMap
  for (let char of String (v)) {
    let c = char.codePointAt (0)

    if (!percentCoded && char === '%')
      out.push (...(decode (c) .map (_pct)))

    else if (ascii && c > 127)
      out.push (...(decode (c) .map (_pct)))

    else {
      const basicLatin = 32 <= c && c <= 126
      const escape = basicLatin && (char in symbolMap_ ? symbolMap_[char] : 0)
      const c0_del_c1 = c <= 31 || c >= 127 && c <= 159
      const surrogate = 0xD800 <= c && c <= 0xDFFF
      const nonchar = 0xFDD0 <= c && c <= 0xFDEF || 
        (c <= 0x10FFFF && ((c >> 1) & 0x7FFF) === 0x7FFF)
      if (escape & escapeSet || c0_del_c1 || surrogate || nonchar)
        out.push (... (decode (c) .map (_pct)))
      else 
        out.push (char)
    }
  }
  return out.join ('')
}


// Percent Decoding
// ----------------

const PERCENT = /%([0-9a-fA-F]{2})/g
const _dont = { scheme:1, port:1, drive:1, root:1 }

function decode (value, k) {
  if (k in _dont) return value
  if (value == null) return null
  value = wtf8 .encode (value) .replace (PERCENT, pct => String.fromCharCode (parseInt (pct.substr(1), 16)))
  value = wtf8 .decode (value)
  return value
}


// Exports
// -------

module.exports = { utf8, decode, encode }