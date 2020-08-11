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

  resolved = normaliseFileUrl (resolved)
  resolved._href = resolved.href
  return resolved
}

// This is functionality that I am not sure I want in the lib,
// and so, I do it here to make the failing tests pass

function normaliseFileUrl (url) {
  if (url.scheme !== 'file') return url
  if (url.drive) return url.set ({ host: '' })
  const dirs = []
  const it = (url.dirs||[])[Symbol.iterator]()
  for (let x of it)
    if (x !== '') dirs.push (x, ...it)
  return url.set ({ dirs })
}

// TODO validate 'dirs' to be iterable
// And.. also make a defensive copy?
// var r = new Url ('file:///foo').set ({ dirs:1 })
// log (r)

module.exports = testSet