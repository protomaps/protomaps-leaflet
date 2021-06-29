import { covering } from '../src/labeler'
import assert from 'assert'
import baretest from 'baretest'

let test = baretest("labeler")

test('covering', async () => {
    let result = covering(3,1024,{minX:256,minY:256*2,maxX:256+1,maxY:256*2+1})
    assert.deepEqual(result,[{display:"1:2:3",key:"0:0:1"}])
})

export default test