"use strict"
import { Url, RawUrl } from '../lib/index.js'
import Tests from './test-runner.js'
const log = console.log.bind (console)

// Test 
// ----

const file = await Deno.readTextFile ('test/run/urltestdata.json')
const testData = JSON.parse (file)

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

  .assert ('equal scheme', (input, output, error) => {
    return input.failure || input.protocol === (output.scheme ?  output.scheme + ':' : '')
  })

  .assert ('equal host', (input, output, error) => {
    return input.failure || input.hostname === (output.host ?? '')
  })

  .assert ('equal port', (input, output, error) => {
    return input.failure || input.port === String (output.port ?? '')
  })


function runTest (test) {
  const baseUrl = new RawUrl (test.base)
  const url = new RawUrl (test.input, { parser:baseUrl.scheme })
  return url.forceResolve (baseUrl) .normalise () .percentEncode ()
}

export default testSet