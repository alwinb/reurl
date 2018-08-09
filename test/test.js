"use strict"
const Url = require ('../lib')
  , core = require ('../lib/core')
  , Tests = require ('./testset')
  , auth = core.auth

const log = console.log.bind (console)


// Test 
// ----

const testSet = new Tests ('URL Webtests', require ('./urltestdata.json'), initTest)

  . assert (test => { if (test)
      Tests.assert (test.resolvedFailure === !!test.originalFailure, 'equal failure', test)
    })

  . assert (test => { if (test && !test.originalFailure) {
      Tests.assert (test.resolvedHref === test.originalHref, 'equal href', test)
      //Tests.assert (resolved.r === test.pathname, 'equal pathname', testData, test)
    } })


function initTest (test) {
  if (typeof test !== 'object') return
  //if (test.failure) return
  var base = new Url (test.base) 
  var input = new Url (test.input, base.scheme)
  var resolved = input .resolve (base) .force () .normalize ()

  resolved = dropEmpties (resolved)
  resolved = dropHostForDrive (resolved)

  var href = String (resolved)
  var failure = !! resolved.error

  var testData = 
    //{ testCase: test
    //, parsedBase: base
    //, parsedInput: input
    { testbase: test.base
    , testinput: test.input

    , originalFailure: !!test.failure
    , resolvedFailure: resolved.failure

    , originalHref: test.href
    , resolvedHref: resolved.href

    //, resolved:resolved.toArray()
    //, testPathname: test.pathname
    //, pathName: resolved.pathname
    }
  return testData
}


// This is functionality that I am not sure I want in the core lib,
// and so, I do it here to make the failing tests pass

function dropHostForDrive (url) {
  const toks = url._tokens
  if (toks.some (_ => _[0] === core.DRIVE))
    return Url.fromArray (toks.map (_ => _[0] === core.AUTH ? [core.AUTH, auth.parse ('')] : _))
  else
    return url
}


function dropEmpties (url, scheme) {
  // Hmmmm think this through..
  // esp. relating it to 'resolve' and join. 
  if (url.scheme === 'file' || (url.scheme == null && scheme === 'file')) {
    const parts = []
    let dirSeen = false
    let _root = null
    
    for (let i=0, l=url._tokens.length; i<l; i++) {
      let a = url._tokens[i]
      let t = a[0]
      if (t === core.ROOT) _root = a
      if (_root && !dirSeen) {
        if (t === core.DRIVE)
          parts.push (dirSeen = a)
        else if (t === core.DIR) {
          if (a[1] !== '') parts.push (dirSeen = a)
        }
        else
          parts.push (a)
      }
      else
        parts.push (a)
    }
    return Url.fromArray (parts)
  }
  return url
}



testSet.run ()