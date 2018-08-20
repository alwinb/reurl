const log = console.log.bind(console)

function AssertionFailure (message, data) {
  this.message = message
  this.data = data
}


class Tests {

  constructor (tests, init) {
    this.tests = tests
    this.init = init
    this.assertions = []
  }

  static assert (bool, message, testData) {
    if (bool !== true) {
      var err = new AssertionFailure (message, testData)
      throw err
    }
  }

  add (fn) {
    this.assertions.push (fn)
    return this
  }

  run () {
    var fail = 0, pass = 0

    for (var i = 0, l = this.tests.length; i < l; i++) {
      let testData = this.tests[i]
      let errors = []
      try {
        testData = this.init (this.tests[i])
        this.assertions.forEach (fn => {
          try {
            fn (testData)
          }
          catch (e) {
            errors.push(e)
          }
        })
      }
      catch (e) {
        errors.push (e)
      }
    
      if (errors.length) {
        fail++
        log ('\n\n-------- Test failed --------')
        log (testData)
        log ('-----------------------------')
        errors.forEach (e => log (e.message))
      }
      else pass++
      
    }
    
    var total = fail + pass
    log('\n\n-------- results --------\npassed ' + pass + ' of ' + total + ' tests')
    log('failed ' + fail + ' of ' + total + ' tests')
    log('pass rate ' + Math.floor(pass / total * 100) + '%')
  
  }

}

module.exports = Tests
