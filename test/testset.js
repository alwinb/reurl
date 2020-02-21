const util = require ('util')
const log = console.log.bind (console)

function Plain (str) {
  this.string = str }

function plain (string) {
  return new Plain (string) }


class Tests {

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

  assert (description, assert) {
    this.assertions.push ({ description, assert })
    return this
  }

  log (...args) {
    log (...args.map (x => x instanceof Plain ? x.string : util.inspect (x) ))
  }

  compactInput (x) {
    return String (x)
  }

  compactOutput (x) {
    return String (x)
  }

  compactError (e) {
    return e.message
  }

  inp (x) {
    this.log (plain (`  >`), this.compactInput (x))
    return x
  }

  out (x) {
    this.log (plain (`==>`), this.compactOutput (x))
  }

  err (x) {
    this.log (plain (`!!>`), this.compactError (x))
  }

  run (amount = Infinity) {
    var fail = 0, pass = 0, total = 0
    for (let input of this.tests) if (this._filter (input)) {
      total ++
      if (total > amount) return
      let output, error, assertionFailures = []
      try {
        output = this.runTest (input)
      }
      catch (e) { error = e; output = e }
    
      this.assertions.forEach (({ description, assert }) => {
        if (!assert (input, output, error))
        assertionFailures.push ({ description, input, output })
      })

      if (assertionFailures.length) {
        fail++
        log ('\n\n-------- Test failed --------')
        this.inp (input)
        if (error) this.err (error)
        else this.out (output)
        log (util.inspect (input, { depth:10 }))
        if (error) log (error)
        else log (util.inspect (output, { depth:10 }))
        log ('-----------------------------')
        assertionFailures.forEach (e => log (e.description))
      }
      else pass++
    }

    var total = fail + pass
    log ('\n\n-------- results --------\npassed ' + pass + ' of ' + total + ' tests')
    log ('failed ' + fail + ' of ' + total + ' tests')
    log ('pass rate ' + Math.floor(pass / total * 100) + '%')
    return total === 0
  }

}

module.exports = Tests