import Point from '@mapbox/point-geometry'
import { Zxy, TileCache, Feature } from './tilecache'

/* 
 * PreparedTile
 * For a given display Z:
 * layers: map of names-> features with coordinates in CSS pixel units.
 * translate: how to get layers coordinates to global Z coordinates.
 * data_tile: the Z,X,Y of the data tile.
 * window? if present, use as bounding box or canvas clipping area.
 */
export interface PreparedTile {
    z: number // the display zoom level that it is for
    origin: Point // the top-left corner in global CSS pixel coordinates
    data: Map<string,Feature[]> // return a map to Iterable
    scale: number // over or underzooming scale
    dim: number // the effective size of this tile on the zoom level
    data_tile: Zxy // the key of the raw tile
    clip?: number[]
}

export interface TileTransform {
    data_tile:data_zxy
    origin:Point
    scale:number
}

/* 
 * @class View
 * expresses relationship between canvas coordinates and data tiles.
 */
export class View {
    levelDiff: number
    tileCache: TileCache
    maxDataLevel: number

    constructor(tileCache:TileCache, maxDataLevel:number, levelDiff:number) {
        this.tileCache = tileCache
        this.maxDataLevel = maxDataLevel
        this.levelDiff = levelDiff
    }

    public getCenterBbox(normalized_center:Point,zoom:number,width:number,height:number) {
        let center_tile = normalized_center.mult(1 << zoom)
        let width_tiles = width / 1024
        let height_tiles = height / 1024
        return {
            minX:(center_tile.x-width_tiles/2)*4096,
            maxX:(center_tile.x+width_tiles/2)*4096,
            minY:(center_tile.y-height_tiles/2)*4096,
            maxY:(center_tile.y+height_tiles/2)*4096
        }
    }

    public getCenterTranslate(normalized_center:Point,zoom:number,width:number,height:number) {
        let center_tile = normalized_center.mult(1 << zoom)
        let width_tiles = width / 1024
        let height_tiles = height / 1024
        return new Point(
            -(center_tile.x-width_tiles/2)*1024,
            -(center_tile.y-height_tiles/2)*1024
        )
    }

    // width and height in css pixels
    // assume a tile is 1024x1024 css pixels
    public async getCenter(normalized_center:Point,zoom:number,width:number,height:number):Promise<Array<PreparedTile>> {
        let center_tile = normalized_center.mult(1 << zoom)

        let width_tiles = width / 1024
        let height_tiles = height / 1024
        let mintile_x = Math.floor(center_tile.x - width_tiles / 2)
        let maxtile_x = Math.floor(center_tile.x + width_tiles / 2)
        let mintile_y = Math.floor(center_tile.y - height_tiles / 2)
        let maxtile_y = Math.floor(center_tile.y + height_tiles / 2)
        let needed = []
        for (var tx = mintile_x; tx <= maxtile_x; tx++) {
            for (var ty = mintile_y; ty <= maxtile_y; ty++) {
                needed.push({z:zoom,x:tx,y:ty})
            }
        }

        let result = await Promise.all(needed.map(n => this.tileCache.get(n)))
        return result.map((data,i) => { 
            let data_tile = needed[i]
            let translate = center_tile.sub(new Point(data_tile.x,data_tile.y)).mult(-1024).add(new Point(width/2,height/2))
            return {
                data:data as Map<string,Feature[]>,
                bbox:[0,0,4096,4096],
                transform: {scale:0.25,translate:translate},
                data_tile:data_tile,
                z:zoom,
                clip:[translate.x,translate.y,1024,1024],
                scale:1
            } 
        })
    }

    public covering(display_level:number,data_zxy:Zxy,data_bbox:any) {
        let res = 256
        let f = 1 << (display_level - data_zxy.z)

        let top_left = {x:data_bbox.minX/res,y:data_bbox.minY/res}
        let d_top_left = {x:Math.floor(top_left.x*f),y:Math.floor(top_left.y*f)} 

        let bottom_right = {x:data_bbox.maxX/res,y:data_bbox.maxY/res}
        let d_bottom_right = {x:Math.floor(bottom_right.x*f),y:Math.floor(bottom_right.y*f)} 

        let retval = []
        for (let x = d_top_left.x; x <= d_bottom_right.x; x++) {
            for (let y = d_top_left.y; y <= d_bottom_right.y; y++) {
                if (Math.floor(x/f) == data_zxy.x && Math.floor(y/f) == data_zxy.y) {
                    // do nothing
                } else {
                    retval.push({z:display_level,x:x,y:y})
                }
            }
        }
        return retval
    }

    public dataTileForDisplayTile(display_tile: Zxy):TileTransform {
        var data_tile:Zxy
        var scale = 1
        var dim = this.tileCache.tileSize
        var origin:Point
        if (display_tile.z < this.levelDiff) {
            data_tile = {z:0,x:0,y:0}
            scale = 1 / (1 << (this.levelDiff - display_tile.z))
            origin = new Point(0,0)
            dim = dim * scale
        } else if (display_tile.z <= this.levelDiff + this.maxDataLevel) {
            let f = 1 << this.levelDiff
            data_tile = {
                z:display_tile.z-this.levelDiff,
                x:Math.floor(display_tile.x/f),
                y:Math.floor(display_tile.y/f)
            }
            origin = new Point(data_tile.x * (1 << this.levelDiff) * 256,data_tile.y * (1 << this.levelDiff) * 256)
        } else {
            scale = 1 << (display_tile.z - this.maxDataLevel)
            data_tile = {
                z:this.maxDataLevel,
                x:Math.floor(display_tile.x/scale),
                y:Math.floor(display_tile.y/scale)
            }
            origin = new Point(data_tile.x * scale * 256,data_tile.y * scale * 256)
            dim = dim * scale
        }
        return {data_tile:data_tile,scale:scale,origin:origin,dim:dim}
    }

    public async getDisplayTile(display_tile: Zxy):Promise<PreparedTile> {
        let tt = this.dataTileForDisplayTile(display_tile)
        const data = await this.tileCache.get(tt.data_tile)
        return {
            data_tile: tt.data_tile,
            scale:tt.scale,
            data:data,
            z:display_tile.z,
            origin:tt.origin
        }
    } 
}

