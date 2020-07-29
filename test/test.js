const Url = require ('../lib')
const log = console.log.bind (console)
const samples = require ('./samples')
const Tests = require ('./testset')

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

const checkKey = key => (test, output, error) =>
  key in test ? output[key] == test[key] : true
  
const checkPort = (test, output) =>
  'port' in test ? output.port == test.port : true

const checkDirs = (test, output) => {
  if (!('dirs' in test)) return true
  return (test.dirs === null) === (output.dirs === null) ||
    output.dirs.length === test.dirs.length && test.dirs.reduce ((r, x, i) => r && output.dirs[i] === x, true)
}

const checkError = (test, output, error) =>
  !test.error || error && error.message === test.error

//

const testset = new Tests (samples, init)
  .assert ('checkError',  checkError)
  .assert ('checkDirs',   checkDirs)
  for (const key of keys)
    testset .assert ('check ' + key, checkKey (key))

testset.compactInput = function (inp) {
  var url = inp.url
  return url instanceof Url ? url.href : url + ''
}

if (testset.run () !== true)
  process.exit (1)
