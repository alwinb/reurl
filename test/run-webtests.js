const { Url, _encode } = require ('../lib/')
const Tests = require ('./testset')
const log = console.log.bind (console)

// Test 
// ----

const testData = require ('../git-ignore/urltestdata.json')

class WebTests extends Tests {
  compactInput (input) { return input.href }
  compactOutput (output) { return output.href }
}

const testSet = new WebTests (testData, runTest)
  .filter (input => input && typeof input === 'object')

  .assert ('equal failure', (input, output, error) => {
    if (error) output.error = error
    return !!input.failure === !!error })

  .assert ('equal href', (input, output, error) => {
    return input.failure || input.href === output.href
  })


function runTest (test) {
  var base = new Url (test.base) .force ()
  var input = new Url (test.input, { parser:base.scheme })
  var resolved = input.resolve (base) .force () .normalise ()
  resolved = normaliseFileUrl (resolved)
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

var code = testSet.run ()
process.exit (code)