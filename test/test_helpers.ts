import { Zxy, TileSource, Feature } from "../src/tilecache";

export class StubSource implements TileSource {
  public async get(c: Zxy): Promise<Map<string, Feature[]>> {
    return new Map();
  }
}
