import { Zxy, TileSource } from '../src/tilecache'

export class StubSource implements TileSource {
    public async get(c: Zxy) {
        return "foo"
    } 
}