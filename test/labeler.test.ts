import Point from '@mapbox/point-geometry'
import { covering, Index } from '../src/labeler'
import assert from 'assert'
import baretest from 'baretest'

let test = baretest("labeler")

test('covering', async () => {
    let result = covering(3,1024,{minX:256,minY:256*2,maxX:256+1,maxY:256*2+1})
    assert.deepEqual(result,[{display:"1:2:3",key:"0:0:1"}])
})

test('inserting label into index', async () => {
   let index = new Index()
   index.insert({anchor:new Point(100,100),bbox:[{minX:100,minY:100,maxX:200,maxY:200}],draw:c=>{}})
   let result = index.search({minX:90,maxX:110,minY:90,maxY:110})
   assert.equal(result.size,1)
})

test('label with multiple bboxes', async () => {
   let index = new Index()
   index.insert({anchor:new Point(100,100),bbox:[{minX:100,minY:100,maxX:110,maxY:200},{minX:110,minY:100,maxX:120,maxY:200}],draw:c=>{}})
   let result = index.search({minX:90,maxX:130,minY:90,maxY:110})
   assert.equal(result.size,1)

})

export default test