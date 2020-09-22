"use strict"
const { Url, RawUrl } = require ('../lib')
const Tests = require ('./test-runner')
const log = console.log.bind (console)

// Test 
// ----

const testData = require ('../test/data/urltestdata.json')

class WebTests extends Tests {
  compactInput (input) { return input.href }
  compactOutput (output) { return output.href }
}

const testSet = new WebTests (testData, runTest)
  .filter (input => input && typeof input === 'object')

  .assert ('equal failure', (input, output, error) => {
    return !!input.failure === !!error })

  .assert ('equal href', (input, output, error) => {
    return input.failure || input.href === output.href
  })


function runTest (test) {
  let base = new RawUrl (test.base) .force ()
  let input = new RawUrl (test.input, { parser:base.scheme })
  let resolved = input.resolve (base) .force () .normalise ()
  // let decoded = new Url (resolved)
  // resolved.set ({ host:decoded.host })

  // TODO this should be the same?
  // No because the cannot-be-base check is not done in 'goto'
  // SHould it?
  // var resolved = base.goto (test.input) .force() .normalise()

  resolved._href = resolved.href
  return resolved
}

// TODO validate 'dirs' to be iterable
// And.. also make a defensive copy?
// var r = new Url ('file:///foo').set ({ dirs:1 })
// log (r)

module.exports = testSet