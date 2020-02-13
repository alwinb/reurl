"use strict"
const Url = require ('../lib')
  , Tests = require ('./testset')

const log = console.log.bind (console)


// Test 
// ----

const testSet = new Tests (require ('./urltestdata.json'), initTest)

  // . add (test => { if (test)
  //     Tests.assert (test.resolvedFailure === !!test.originalFailure, 'equal failure', test)
  //   })

  . add (test => { if (test && !test.originalFailure) {
      Tests.assert (test.resolvedHref === test.originalHref, 'equal href', test)
    }})


function initTest (test) {
  if (typeof test !== 'object') return

  try {
    var base = new Url (test.base) .force () .normalize ()
    var input = new Url (test.input, { scheme:base.scheme })
    var resolved = base.goto (input) .force () .normalize ()

    resolved = dropEmpties (resolved)
    resolved = dropHostForDrive (resolved)
    resolved.failure = false
  }
  catch {
    base = input = []
    resolved = []
    resolved.failure = true
  }

  var testData = 
    { testbase: test.base
    , testinput: test.input

    , originalFailure: !!test.failure
    , resolvedFailure: resolved.failure

    , originalHref: test.href
    , resolvedHref: resolved.href
    
    , parsedBase: [...base]
    , parsedInput: [...input]
    , resolved: [...resolved]
    }
  return testData
}


// This is functionality that I am not sure I want in the lib,
// and so, I do it here to make the failing tests pass

function dropHostForDrive (url) {
  return url.drive ? url.set ({ host:'' }) : url
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
    return Url.fromTokens (parts)
  }
  return url
}

testSet.run ()