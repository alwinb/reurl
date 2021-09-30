import util from 'util'
const log = console.log.bind (console)

// TestRunner
// ==========

// A very basic/ ad-hoc test runner. 
// - first argument is an array of objects.
// - second argument is a test function to be called for each 'input' object
// 'assertions' are functions that take objects
// { input, output, error } and return true for success; false for failure

class TestRunner {

  constructor (tests, runTest) {
    this.tests = tests
    this.runTest = runTest
    this._filter = () => true
    this.assertions = []
  }

  filter (pred) {
    this._filter = pred
    return this
  }

  assert (description, predicate) {
    this.assertions.push ({ description, predicate })
    return this
  }

  log (...args) {
    for (let item of args)
      process.stdout.write (String (item))
    process.stdout.write ('\n')
  }

  compactInput (x) {
    return String (x)
  }

  compactOutput (x) {
    return String (x)
  }

  compactError (e) {
    return String (e.message)
  }

  run (amount = Infinity) {
    const start = new Date ()
    let fail = 0, pass = 0, total = 0
    for (let input of this.tests) if (this._filter (input)) {
      total ++
      if (total > amount) return
      let output, error, assertionFailures = []
      try {
        output = this.runTest (input)
      }
      catch (e) { error = e; output = e }
    
      this.assertions.forEach (({ description, predicate }) => {
        if (!predicate (input, output, error))
          assertionFailures.push (description)
      })

      if (assertionFailures.length) {
        fail++
        log ('\n----------- Test failed ----------')
        this.log (this.compactInput (input))
        if (error) {
          this.log ('threw: ', this.compactError (error))
          log ('assert: ', assertionFailures, '\n')
          log (util.inspect ({ testCase: input, threw:error }, { depth:11 }))
        }
        else {
          this.log ('result: ', this.compactOutput (output))
          log ('assert: ', assertionFailures, '\n')
          log (util.inspect ({ testCase: input, returned:output }, { depth:11 }))
        }
        log ('\n')
      }
      else {
        // let prefix = error ? '\n-> ' : '\n=> '
        // this.log (
        //   ' > ', this.compactInput (input),
        // prefix, error ? this.compactError (error) : this.compactOutput (output), '\n')
        pass++
      }
    }

    const dt = new Date - start
    total = fail + pass
    log ('\n\n------------ Results -------------\npassed ' + pass + ' of ' + total + ' tests')
    log ('failed ' + fail + ' of ' + total + ' tests')
    log ('pass rate ' + Math.floor(pass / total * 100) + '%')
    log (`${dt/1000}s`)
    return fail === 0
  }

}

export default TestRunner