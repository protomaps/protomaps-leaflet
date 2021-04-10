import { Zxy, TileCache, TileSource } from '../src/tilecache'
import { StubSource } from './test_helpers'

var cache = new TileCache(new StubSource())

test('basic', () => {
    // cache.get({z:0,x:0,y:0}).then(f => {
    //     console.log(f)
    // })
})