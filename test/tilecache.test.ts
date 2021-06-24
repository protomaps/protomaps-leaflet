import { Zxy, TileCache, TileSource } from '../src/tilecache'
import { StubSource } from './test_helpers'
import assert from 'assert'
import baretest from 'baretest'

test = baretest("Tilecache")

var cache = new TileCache(new StubSource())

test('basic', async () => {
    // cache.get({z:0,x:0,y:0}).then(f => {
    //     console.log(f)
    // })
})

export default test