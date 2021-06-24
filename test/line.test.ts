import { simpleLabel } from '../src/line'
import assert from 'assert'
import baretest from 'baretest'

test = baretest("Lines")

test('simple line labeler', async () => {
    let mls = [[{x:0,y:0},{x:100,y:0}]]
    let result = simpleLabel(mls,10)
    assert.deepEqual(result.start,{x:0,y:0})
    assert.deepEqual(result.end,{x:100,y:0})

    mls = [[{x:0,y:50},{x:0,y:0},{x:100,y:0},{x:200,y:5}]]
    result = simpleLabel(mls,10)
    assert.deepEqual(result.start,{x:0,y:0})
    assert.deepEqual(result.end,{x:200,y:5})
})

test('too small', async () => {
    let mls = [[{x:0,y:0},{x:10,y:0}]]
    let result = simpleLabel(mls,20)
    assert.equal(result,undefined)
})

export default test
