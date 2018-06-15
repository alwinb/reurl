"use strict"
module.exports = percentEncode


// IDEA use a regexp to do it quicky/ in chunks?
// Hmm, almost like a tiny-lexer then

const pair = /[\ud800-\udbff][\udc00-\udfff]/
const lead = /[\ud800-\udbff]/
const trail = /[\udc00-\udfff]/
const twobyte = /[\u0080-\ud7ff\ue000-\uffff]/


// This isn't all too elegant. 
// I shall rewrite it some time :)

function percentEncode (string) {
  const offset = 0x10000 - (0xD800 << 10) - 0xDC00
  let lead = 0, result = ''

  for (let i=0, l=string.length; i<l; i++) {
    const c = string.charCodeAt (i)

    if (lead) {
      // Trailing surrogate (0xDC00 <= c < 0xE000)
      if (0xDC00 <= c && c < 0xE000) {
        let cp = (lead << 10) + c + offset
        lead = 0
        // Octal 200000-4177777 (hex 10000-10FFFF) shall be coded with four bytes
        // in octal: wxxyyzz will be 36w 2xx 2yy 2zz.
        let b1 = 0o360 + ((c >> 18))
        let b2 = 0o200 + ((c >> 12) & 0x3F)
        let b3 = 0o200 + ((c >> 6) & 0x3F)
        let b4 = 0o200 + (c & 0x3F)
        result += (b1 > 0xf ? '%' : '%0') + b1.toString (16) .toUpperCase ()
        result += (b2 > 0xf ? '%' : '%0') + b2.toString (16) .toUpperCase ()
        result += (b3 > 0xf ? '%' : '%0') + b3.toString (16) .toUpperCase ()
        result += (b4 > 0xf ? '%' : '%0') + b4.toString (16) .toUpperCase ()
        continue
      }
      else {
        warn ('Ill-formed UTF16 string, standalone leading surrogate.')
        const b1 = lead >> 8
        const b2 = lead & 0x00ff
        lead = 0
        result += (b1 > 0xf ? '%' : '%0') + b1.toString (16) .toUpperCase ()
        result += (b2 > 0xf ? '%' : '%0') + b2.toString (16) .toUpperCase ()
      }
    }
    
    if (c < 0x80) {
      // c is already a codepoint
      result += string[i]
    }

    else if (c < 0x800) {
      // c is already a codepoint
      // <000 00y yyyy xxx xxx> ==> <110y yyyy> <10xx xxxx>
      const b1 = 0o300 + (c >> 6)   // <11000000> + the first ten bits of c
      const b2 = 0o200 + (c & 0o77) // <10000000> + the last six bits of c
      result += (b1 > 0xf ? '%' : '%0') + b1.toString (16) .toUpperCase ()
      result += (b2 > 0xf ? '%' : '%0') + b2.toString (16) .toUpperCase ()
    }

    else if (c < 0xD800 || c >= 0xE000) {
      // c is already a codepoint
      // <zzzz yyy yyy xxx xxx> ==> <1110 zzzz> <10yy yyyy> <10xx xxxx>
      const b1 = 0o340 + (c >> 12)       // <11100000> + <zzzz>
      const b2 = 0o200 + ((c >> 6) & 0o77) // <10000000> + <yy yyyy>
      const b3 = 0o200 + (c & 0o77)      // <10000000> + <xx xxxx>
      result += (b1 > 0xf ? '%' : '%0') + b1.toString (16) .toUpperCase ()
      result += (b2 > 0xf ? '%' : '%0') + b2.toString (16) .toUpperCase ()
      result += (b3 > 0xf ? '%' : '%0') + b3.toString (16) .toUpperCase ()
    }

    // Leading surrogate (0xD800 <= c < 0xDC00)
    else if (c < 0xDC00) {
      lead = c
    }

    // Trailing surrogate (0xDC00 <= c < 0xE000)
    else if (c < 0xE000) {
      warn ('Ill-formed UTF16 string, standalone trailing surrogate.')
      const b1 = c >> 8
      const b2 = c & 0x00ff
      result += (b1 > 0xf ? '%' : '%0') + b1.toString (16) .toUpperCase ()
      result += (b2 > 0xf ? '%' : '%0') + b2.toString (16) .toUpperCase ()
    }

  }
  
  
  if (lead) {
    warn ('Ill-formed UTF16 string, last byte is a leading surrogate.')
    const b1 = lead >> 8
    const b2 = lead & 0x00ff
    result += (b1 > 0xf ? '%' : '%0') + b1.toString (16) .toUpperCase ()
    result += (b2 > 0xf ? '%' : '%0') + b2.toString (16) .toUpperCase ()
  }

  return result
}



const warn = console.warn.bind (console)


//
// Test
// 

//const log = console.log.bind (console)
//var sample = 'abc' + String.fromCharCode(0xD845) + 'abcd'
//var sample = 'abc' + String.fromCharCode(0xDC88) + 'abcd'
//var sample = 'abc' + String.fromCharCode(0xD845) + String.fromCharCode(0xDC88) + 'abcd'

//var r = []
//for (var i = 0; i < sample.length; i++) {
//  r[i] = sample.charCodeAt(i)
//}
//
//log (sample, r)
//log (percentEncode (sample))
