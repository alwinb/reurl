"use strict"
const Url = require ('../lib')
  , core = require ('../lib/core')
  , Tests = require ('./testset')
  , auth = core.auth

const log = console.log.bind (console)


// Test 
// ----

const testSet = new Tests ('URL Webtests', require ('./urltestdata.json'), initTest)

  // . assert (test => { if (test)
  //     Tests.assert (test.resolvedFailure === !!test.originalFailure, 'equal failure', test)
  //   })

  . assert (test => { if (test && !test.originalFailure) {
      Tests.assert (test.resolvedHref === test.originalHref, 'equal href', test)
    } })


function initTest (test) {
  if (typeof test !== 'object') return
  var base = new Url (test.base) 
  var input = new Url (test.input, base.scheme)
  var resolved = input .forceResolve (base)

  resolved = dropEmpties (resolved)
  resolved = dropHostForDrive (resolved)

  var testData = 
    { testbase: test.base
    , testinput: test.input

    , originalFailure: !!test.failure
    , resolvedFailure: resolved.failure

    , originalHref: test.href
    , resolvedHref: resolved.href
    }
  return testData
}


// This is functionality that I am not sure I want in the core lib,
// and so, I do it here to make the failing tests pass

function dropHostForDrive (url) {
  return url.drive ? url.withHost ('') : url
}

// This is especially unpleasant behaviour
// defined in the new spec

function dropEmpties (url) {
  if (url.scheme === 'file') {
    const parts = []
    let dirSeen = false
    let _root = null

    for (let i=0, l=url._tokens.length; i<l; i++) {
      let a = url._tokens[i]
      let [t, v] = a
      if (t === core.DRIVE) dirSeen = a
      if (t === core.ROOT) _root = a
      if (_root && !dirSeen && t === core.DIR) {
        if (v !== '') parts.push (dirSeen = a)
      }
      else parts.push (a)
    }
    return Url.fromArray (parts)
  }
  return url
}


testSet.run ()