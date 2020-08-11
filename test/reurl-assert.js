const { Url, RawUrl } = require ('../lib')
const log = console.log.bind (console)
const samples = require ('./data/samples')
const Tests = require ('./test-runner')

// Set up tests

const init = test => {
  let output
  if (typeof test.url === 'function') {
    test._url = test.url + ''
    output = test.url ()
    output._href = output.href
  }
  else if (typeof test.url === 'string')
    output = new Url (test.url)
  else output = test.url
  return output
}

//

const keys = ['href', 'scheme', 'user', 'pass', 'host', 'port', 'drive', 'root', 'file', 'percentCoded' ]

const equalKey = key => (test, output, error) =>
  key in test ? output[key] === test[key] : true
  
const equalPort = (test, output) =>
  'port' in test ? output.port === test.port : true

const equalDirs = (test, output) => {
  if (!('dirs' in test)) return true
  return (test.dirs === null) === (output.dirs === null) ||
    output.dirs.length === test.dirs.length && test.dirs.reduce ((r, x, i) => r && output.dirs[i] === x, true)
}

const equalError = (test, output, error) =>
  !test.error || error && error.message === test.error

//

const testset = new Tests (samples, init)
  .assert ('equal failure',  equalError)
  .assert ('equal dirs',   equalDirs)
  for (const key of keys)
    testset .assert ('equal ' + key, equalKey (key))

testset.compactInput = function (inp) {
  var url = inp.url
  return url instanceof Url ? url.href : url + ''
}

testset.compactOutput = function (out) {
  return JSON.stringify (String (out))
}

module.exports = testset
