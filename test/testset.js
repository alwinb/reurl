module.exports = Tests
const log = console.log.bind (console)


function AssertionFailure (message, data) {
  this.message = message
  this.data = data
}

function assert (bool, message, testData) {
  if (bool !== true) {
    var err = new AssertionFailure (message, testData)
    throw err
  }
}

function Tests (tests) {
  this.tests = tests
}

Tests.assert = assert

Tests.prototype.run = function (fn) {
  log ('\n======== '+fn.name+' ========')
  var fail = 0, pass = 0
  for (var i=0,l=this.tests.length; i<l; i++) {
    try { 
      fn (this.tests[i])
      pass++
    }
    catch (e) {
      if (e instanceof AssertionFailure) {
        fail++
        log ('\n-------- Test failed --------\n', e.data, '\n-----------------------------\n'+e.message, '\n')
      }
      else {
        fail++
        log ('\n-------- Test threw --------\n', this.tests[i], '\n-----------------------------\n'+e.message, '\n')
        throw e
      }
    }
  }
  var total = fail+pass
  log ('-------- '+fn.name+' results --------\npassed '+pass+' of '+total+' tests\nfailed '+fail+' of '+total+' tests\npass rate '+Math.floor(pass/total*100)+'%')
  
  
}


