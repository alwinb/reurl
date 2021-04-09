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

  .assert ('equal failure', (input, output, error) =>
    !!input.failure === !!error )

  .assert ('equal href', (input, output, error) => {
    return input.failure || input.href === output.href
  })


function runTest (test) {
  let resolved = RawUrl.parseAndResolve (test.input, test.base)
  resolved._href = resolved.href
  return resolved
}

// TODO validate 'dirs' to be iterable
// And.. also make a defensive copy?
// var r = new Url ('file:///foo').set ({ dirs:1 })
// log (r)

module.exports = testSet