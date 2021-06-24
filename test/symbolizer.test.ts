import { exp } from '../src/symbolizer'
import assert from 'assert'
import baretest from 'baretest'

test = baretest("symbolizer")

test('exp',async () => {
    let result = exp(1.4,[[5,1.5],[11,4],[16,30]])(5)
    assert.equal(result,1.5)
    result = exp(1.4,[[5,1.5],[11,4],[16,30]])(11)
    assert.equal(result,4)
    result = exp(1.4,[[5,1.5],[11,4],[16,30]])(16)
    assert.equal(result,30)
    result = exp(1,[[5,1.5],[11,4],[13,6]])(12)
    assert.equal(result,5)
})

export default test