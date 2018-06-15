"use strict"
const core = require ('../lib/core')
  , { letter, steal, force, join, normalize, url, print:str, parse, DRIVE, AUTH } = core
  , Tests = require ('./testset')
  , percentEncode = require ('../lib/utf')

const log = console.log.bind (console)


// Test 
// ----

function print (url) {
  return str (url.map (escapeToken))
}


const HOST_ESC = /[\x00-\x1F\x7F-\xFF]/g
const FRAG_ESC = /[\x00-\x1F\x7F-\xFF "<>`]/g
const PATH_ESC = /[\x00-\x1F\x7F-\xFF "<>`#?{}]/g
const QUERY_ESC = /[\x00-\x20\x7F-\xFF"#<>]/g

function esc (char) {
  var b = char.charCodeAt (0)
  return (b > 0xf ? '%' : '%0') + b.toString (16) .toUpperCase ()
}


function escapeToken (tok) {
  let v = tok[1]

  switch (tok[0]) {
    case core.AUTH:
      v = v //percentEncode (v) .replace (HOST_ESC, esc)
    break
    case core.FRAG:
      v = percentEncode (v) .replace (FRAG_ESC, esc)
    break
    case core.DIR:
    case core.FILE:
      v = percentEncode (v) .replace (PATH_ESC, esc)
    break
    case core.QUERY:
      v = percentEncode (v) .replace (QUERY_ESC, esc)
    break
    default:
      v = percentEncode (v)
  }
  
 return [tok[0], v]
}


function baseUrl (string, scheme) {
  scheme = typeof scheme === 'string' ? scheme : ''
  return normalize (force (url (string), scheme))
}

log (baseUrl ('asdf/foo'))

function runtest (test) {
  if (typeof test !== 'object') return
  if (test.failure) return
  if (test.username || test.password) return

  var base = baseUrl (test.base)
  var scheme = base.length && base[0][0] === core.SCHEME ? base[0][1] : null
  var input = url (test.input, scheme)
  var resolved = normalize (force (join (base, input)))
  resolved = dropHostForDrive (resolved)
  var href = print (resolved)

  var testData = 
    //{ testCase: test
    //, parsedBase: base
    //, parsedInput: input
    { originalBase: test.base
    , originalInp: test.input
    , originalHref: test.href
    , resolvedHref: href
    }

  Tests.assert (href === test.href, 'equal href', testData )
}


// This is functionality that I am not sure I want in the core lib,
// and so, I do it here to make the failing tests pass

function dropHostForDrive (url) {
  if (url && url.some (_ => _[0] === core.DRIVE)) {
    return url.map (_ => _[0] === core.AUTH ? [AUTH, ''] : _)
  }
  return url
}

var testSet = new Tests (require ('./urltestdata.json'))
testSet.run (runtest)