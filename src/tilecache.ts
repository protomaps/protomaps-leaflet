import { VectorTile } from '@mapbox/vector-tile'
import Protobuf from 'pbf'
import { PMTiles } from 'pmtiles'

export enum GeomType {
   Point = 1,
   Line = 2,
   Polygon = 3
}

export interface Feature {
    properties: any
    bbox: number[]
    geomType: GeomType
    geom: any
    vertices:number
}

export interface Layer {
    name: string
    extent: number
    features: Feature[]
}

export interface Zxy {
  readonly z: number
  readonly x: number
  readonly y: number
}

export function toIndex(c: Zxy) {
    return c.x + ":" + c.y + ":" + c.z
}

export interface TileSource {
    // takes a z,x,y, gets back a Tile
    get(c:Zxy) : any
}

function parseTile(buffer) {
    let v = new VectorTile(new Protobuf(buffer))
    let result = {}
    for (let [key,value] of Object.entries(v.layers)) {
        let features = []
        let layer = value as any
        for (let i = 0; i < layer.length; i++) {
            // yield
            let geom = layer.feature(i).loadGeometry()
            let vertices = 0
            for (let part of geom) {
                vertices+=part.length
            }
            features.push({
                geomType:layer.feature(i).type,
                geom:geom,
                vertices:vertices,
                bbox:layer.feature(i).bbox(),
                properties:layer.feature(i).properties
            })
        }
        result[key] = features
    }
    return result
}

export class PmtilesSource implements TileSource {
    p: PMTiles
    controllers: any[]

    constructor(url) {
        if (url.url) {
            this.p = url
        } else {
            this.p = new PMTiles(url)
        }
        this.controllers = []
    }

    public async get(c:Zxy) {
        this.controllers = this.controllers.filter(cont => {
            if (cont[0] != c.z) {
                cont[1].abort()
                return false
            }
            return true
        })
        let result = await this.p.getZxy(c.z,c.x,c.y)
        const controller = new AbortController()
        this.controllers.push([c.z,controller])
        const signal = controller.signal
        return new Promise((resolve,reject) => {
            fetch(this.p.url,{headers:{Range:"bytes=" + result[0] + "-" + (result[0]+result[1]-1)},signal:signal}).then(resp => {
               return resp.arrayBuffer()
            }).then(buffer => {
                let result = parseTile(buffer)
                resolve(result)
            }).catch( e => {
                reject(e)
            })
        })
    } 
}

export class ZxySource implements TileSource {
    url: string
    controllers: any[]

    constructor(url:string) {
        this.url = url
        this.controllers = []
    }

    public async get(c: Zxy) {
        this.controllers = this.controllers.filter(cont => {
            if (cont[0] != c.z) {
                cont[1].abort()
                return false
            }
            return true
        })
        let url = this.url.replace("{z}",c.z.toString()).replace("{x}",c.x.toString()).replace("{y}",c.y.toString())
        const controller = new AbortController()
        this.controllers.push([c.z,controller])
        const signal = controller.signal
        return new Promise((resolve,reject) => {
            fetch(url,{signal:signal}).then(resp => {
                return resp.arrayBuffer()
            }).then(buffer => {
                let result = parseTile(buffer)
                resolve(result)
            }).catch(e => {
                reject(e)
            })
        })
    } 
}

export interface CacheEntry {
    used: number
    data: Map<string,Layer>
}

export class TileCache {
    source: TileSource
    cache: Map<string,CacheEntry>
    inflight: Map<string,any[]>

    constructor(source: TileSource) {
        this.source = source
        this.cache = new Map()
        this.inflight = new Map()
    }

    public async get(c:Zxy) {
        const idx = toIndex(c)
        return new Promise((resolve, reject) => { 
            if (this.cache.has(idx)) {
                let entry = this.cache.get(idx)
                entry.used = performance.now()
                resolve(entry.data)
            } else if (this.inflight.has(idx)) {
                this.inflight.get(idx).push([resolve,reject])
            } else {
                this.inflight.set(idx,[])
                this.source.get(c).then(tile => {
                    this.cache.set(idx,{used:performance.now(),data:tile})
                    this.inflight.get(idx).forEach(f => f[0](tile))
                    this.inflight.delete(idx)
                    resolve(tile)

                    if (this.cache.size >= 64) {
                        let min_used = +Infinity
                        let min_key = undefined
                        this.cache.forEach((value,key) => {
                            if (value.used < min_used) min_key = key
                        })
                        this.cache.delete(min_key)
                    }
                }).catch(() => {
                    this.inflight.get(idx).forEach(f => f[1]("Cancel data " + idx))
                    this.inflight.delete(idx)
                    reject("Cancel data " + idx)
                })
            }
        })
    }
}
