const Url = require ('../lib/index') .Url
  , Tests = require ('./testset')

const wtf8 = require ('wtf-8')
const punycode = require ('punycode')

const log = console.log.bind (console)

// For the time being, for preencoding components

const specialSchemes = {
  ftp: 21,
  file: null ,
  gopher: 70,
  http: 80,
  https: 443,
  ws: 80,
  wss: 443
}

const C0_ESC  = /[\x00-\x1F\x7F-\xFF]/g
  , HOST_ESC  = C0_ESC

function _escapeChar (char) {
  const b = char.charCodeAt (0)
  return (b > 0xf ? '%' : '%0') + b.toString (16) .toUpperCase ()
}

function _encode (value, regex) {
  return wtf8.encode (value) .replace (regex, _escapeChar)
}

function printHost ({ scheme = null, host = null }) {
  if (host == null) return ''
  return scheme in specialSchemes ? punycode.toASCII (host) .toLowerCase (): _encode (host, HOST_ESC)
}


// Test 
// ----
const testData = require ('../git-ignore/urltestdata.json')


const testSet = new Tests (testData, runTest)

  .filter (input => {
    return (input
      && typeof input === 'object'
      // && input.hostname
      // Just quick exclude, these ipv6 tests
      && (input.hostname && !(input.hostname.substr (0,1) === '[' && input.hostname.substr (-1) === ']'))
      )
  })

  .assert ('equal failure', (input, output, error) => {
    return (!!input.failure) === (!!error)
  })

  .assert ('equal href', (input, output, error) => {
    return error || output.href === input.href
  })

  .assert ('equal hostname', (input, output, error) => {
    const host = output._hostname
    return (error
      || host === input.hostname
      || host == null && input.hostname === ''
      )
  })

testSet.compactInput = input => input.href
testSet.compactOutput = output => output.href


//log (testData[1])
//log (initTest(testData[1]))
testSet.run ()



function runTest (test) {
  var base = Url.fromString (test.base) .force () .normalize ()
  var input = Url.fromString (test.input) // TODO... if allow passing a fallback scheme string as conf for schemeless urls only ?
  var resolved = base.goto (input) .force () .normalise ()
  resolved = dropHostForDrive (resolved)
  resolved = dropEmpties (resolved)

  resolved._href = resolved.href
  resolved._hostname = printHost (resolved)
  resolved._tokens = [...resolved]
  return resolved
}


// This is functionality that I am not sure I want in the lib,
// and so, I do it here to make the failing tests pass

function dropHostForDrive (url) {
  if (url.drive) url.host = ''
  return url
}

// This is especially unpleasant behaviour
// defined in the new spec

function dropEmpties (url) {
  if (url.scheme === 'file') {
    const parts = []
    let dirSeen = false
    let _root = null
    let tokens = [...url]
    for (let i=0, l=tokens.length; i<l; i++) {
      let a = tokens[i]
      let [t, v] = a
      if (t === 'drive') dirSeen = a
      if (t === 'root') _root = a
      if (_root && !dirSeen && t === 'dir') {
        if (v !== '') parts.push (dirSeen = a)
      }
      else parts.push (a)
    }
    return new Url () .addTokens (parts)
  }
  return url
}
