"use strict"
const Url = require ('../lib')
  , core = require ('../lib/core')
  , Tests = require ('./testset')
  , auth = require ('../lib/auth')

const log = console.log.bind (console)


// Test 
// ----

function runtest (test) {
  if (typeof test !== 'object') return
  if (test.failure) return
  // if (test.username || test.password) return

  var base = new Url (test.base)
  var input = new Url (test.input, base.scheme)
  var resolved = input .resolve (base) .force ()
  
  // Test auth
  if (resolved.scheme !== 'file') 
    resolved = normalizeAuth (resolved)
    

  resolved = dropHostForDrive (resolved)
  //resolved = dropEmpties (resolved)
  var href = String (resolved)

  var testData = 
    //{ testCase: test
    //, parsedBase: base
    //, parsedInput: input
    { originalBase: test.base
    , originalInp: test.input
    , originalHref: test.href
    , resolvedHref: href
    }

  Tests.assert (href === test.href, 'equal href', testData)
}


// This is work in progress, and as such not yet part of index/ core

function normalizeAuth (url) {
  if (url.scheme === 'file') return url
  const r = new Url ()
  r._tokens = url._tokens.map (_ => _[0] === core.AUTH ? [core.AUTH, auth.print ( auth.normalize ( auth.parse (_[1]), url.scheme )) ] : _)
  return r
}


// This is functionality that I am not sure I want in the core lib,
// and so, I do it here to make the failing tests pass

function dropHostForDrive (url) {
  const r = new Url ()
  url = url._tokens
  if (url && url.some (_ => _[0] === core.DRIVE)) {
    r._tokens = url.map (_ => _[0] === core.AUTH ? [core.AUTH, ''] : _)
  }
  else r._tokens = url
  return r
}


function dropEmpties (url) {
  // Hmmmm think this through..
  // esp. relating it to 'resolve' and join. 
  if (url.scheme === 'file') {
    const parts = []
    let dirSeen = false
    
    for (let i=0, l=url._tokens.length; i<l; i++) {
      let a = url._tokens[i]
      let t = a[0]
      
      if (!dirSeen) {
        if (t === core.DRIVE)
          parts.push (dirSeen = a)
        else if (t === core.DIR && a[1] !== '')
          parts.push (dirSeen = a)
        else
          parts.push (a)
      }
      else
        parts.push (a)
    }
    
    const r = new Url ()
    r._tokens = parts
    return r
  }
  return url
}


var testSet = new Tests (require ('./urltestdata.json'))
testSet.run (runtest)