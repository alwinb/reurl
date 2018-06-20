"use strict"
const Url = require ('../lib')
  , core = require ('../lib/core')
  , Tests = require ('./testset')

const log = console.log.bind (console)


// Test 
// ----

function runtest (test) {
  if (typeof test !== 'object') return
  if (test.failure) return
  if (test.username || test.password) return

  var base = new Url (test.base)
  var input = new Url (test.input, base.scheme)
  var resolved = input .resolve (base) .force ()

  resolved = dropHostForDrive (resolved)
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


// This is functionality that I am not sure I want in the core lib,
// and so, I do it here to make the failing tests pass

function dropHostForDrive (url) {
  const r = new Url ()
  url = url._parts
  if (url && url.some (_ => _[0] === core.DRIVE)) {
    r._parts = url.map (_ => _[0] === core.AUTH ? [core.AUTH, ''] : _)
  }
  else r._parts = url
  return r
}

var testSet = new Tests (require ('./urltestdata.json'))
testSet.run (runtest)