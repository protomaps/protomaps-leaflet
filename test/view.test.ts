import { Zxy, TileCache, TileSource } from '../src/tilecache'
import { Subview } from '../src/view'
import { StubSource } from './test_helpers'
import assert from 'assert'
import baretest from 'baretest'

let test = baretest("view")

let cache = new TileCache(new StubSource())

test('basic', async () => {
    // let subview = new Subview(cache,14,4096,2,512)
    // let result = subview.dataTile({z:3,x:4,y:1})
    // expect(result.z).toEqual(1)
})

test('covering', async () => {
    let subview = new Subview(cache,2,100,2,100)
    let covering = subview.covering(4,{z:2,x:1,y:1},{minX:95,minY:100,maxX:150,maxY:110})
    assert.deepEqual(covering,[{z:4,x:3,y:4}])
})
test('covering between corners', () => {
    let subview = new Subview(cache,2,100,2,100)
    let covering = subview.covering(4,{z:2,x:1,y:1},{minX:95,minY:105,maxX:150,maxY:155})
    assert.equal(covering.length,3)
})

export default test