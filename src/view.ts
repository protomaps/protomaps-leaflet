import Point from '@mapbox/point-geometry'
import { Zxy, TileCache, Layer } from './tilecache'

export interface Transform {
    scale: number
    translate: Point
}

export interface PreparedTile {
    data: Map<string,Layer> // return a map to Iterable
    bbox: number[] // eliminate this, in the overzooming case do something different
    // but overzooming labeling is at the datatile level
    transform: Transform // this is only an affine, no scale
    z: number // the display zoom level that it is for
    data_tile: Zxy // the key of the raw tile
    clip?: number[]
}

/* 
 * @class View
 * expresses relationship between canvas coordinates and data tiles.
 */
export class View {
    // transform:(c:Zxy)=>Transform
    levelDiff: number
    dataResolution: number
    tileCache: TileCache
    maxDataLevel: number
    displayResolution: number // maybe make me subview-only

    constructor(tileCache:TileCache, maxDataLevel:number, dataResolution:number, levelDiff:number, displayResolution: number) {
        this.tileCache = tileCache
        this.maxDataLevel = maxDataLevel
        this.dataResolution = dataResolution
        this.levelDiff = levelDiff
        this.displayResolution = displayResolution
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
                data:data as Map<string,Layer>,
                bbox:[0,0,4096,4096],
                transform: {scale:0.25,translate:translate},
                data_tile:data_tile,
                z:zoom,
                clip:[translate.x,translate.y,1024,1024]
            } 
        })
    }

    public dataTile(display_tile: Zxy) {
        var data_tile:Zxy
        if (display_tile.z < this.levelDiff) {
            data_tile = {z:0,x:0,y:0}
        } else if (display_tile.z <= this.levelDiff + this.maxDataLevel) {
            let f = 1 << this.levelDiff
            data_tile = {
                z:display_tile.z-this.levelDiff,
                x:Math.floor(display_tile.x/f),
                y:Math.floor(display_tile.y/f)
            }
        } else {
            var p = 1 << (display_tile.z - this.maxDataLevel)
            data_tile = {
                z:this.maxDataLevel,
                x:Math.floor(display_tile.x/p),
                y:Math.floor(display_tile.y/p)
            }
        }
        return data_tile
    }

    public covering(display_level:number,data_zxy:Zxy,data_bbox:any) {
        let f = 1 << (display_level - data_zxy.z)
        let res = this.dataResolution

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

    // the source coordinate system is a 4096x4096 data tile
    // the target coordinates is 256x256 css pixels, which is 1/16 of the above tile
    public transform(display_tile: Zxy):Transform {
        let res = this.displayResolution
        if (display_tile.z < this.levelDiff) {
            if (display_tile.z == 0) {
                return {scale:0.0625,translate:new Point(0,0)}
            }
            if (display_tile.z == 1) {
               return {scale:0.125,translate:new Point(display_tile.x * -res,display_tile.y * -res)}
            }
        } else if (display_tile.z <= this.levelDiff + this.maxDataLevel) {
            let data_tile = this.dataTile(display_tile)
            let f = 1 << this.levelDiff
            return {scale:0.25,translate:new Point((display_tile.x-data_tile.x*f) * -res,(display_tile.y-data_tile.y*f) * -res)}
        } else {
            let data_tile = this.dataTile(display_tile)
            let overzooming = 1 << (display_tile.z - (this.maxDataLevel + this.levelDiff))
            let f = (1 << this.levelDiff) * overzooming
            return {scale:0.25 * overzooming,translate:new Point((display_tile.x-data_tile.x*f) * -res,(display_tile.y-data_tile.y*f) * -res)}
        }
    }

    // the source coordinate system is a 4096x4096 data tile
    // the target coordinates is 256x256 css pixels, which is 1/16 of the above tile
    public point(display_tile: Zxy,x:number,y:number) {
        let res = this.displayResolution
        if (display_tile.z < this.levelDiff) {
            if (display_tile.z == 0) {
            }
            if (display_tile.z == 1) {
            }
        } else if (display_tile.z <= this.levelDiff + this.maxDataLevel) {
            let data_tile = this.dataTile(display_tile)
            let f = 1 << this.levelDiff
            return new Point(((display_tile.x-data_tile.x*f)*res+x)*4,((display_tile.y-data_tile.y*f)*res+x)*4)
        } else {
            let data_tile = this.dataTile(display_tile)
            let overzooming = 1 << (display_tile.z - (this.maxDataLevel + this.levelDiff))
            let f = (1 << this.levelDiff) * overzooming
        }
    }

    // TODO fixme
    // purely in data coordinate system, doesn't care about display
    public bbox(display_tile: Zxy) {
        if (display_tile.z < this.levelDiff) {
            return [0,0,4096,4096]
        } else if (display_tile.z <= this.levelDiff + this.maxDataLevel) {
            let f = 1 << this.levelDiff
            let data_tile = this.dataTile(display_tile)
            let base_x = data_tile.x * f
            let base_y = data_tile.y * f
            let offset_x = display_tile.x - base_x 
            let offset_y = display_tile.y - base_y
            return [offset_x*1024,offset_y*1024,(offset_x+1)*1024,(offset_y+1)*1024]
        } else {
            let width = 1024 >> (display_tile.z - this.maxDataLevel - this.levelDiff)
            let data_tile = this.dataTile(display_tile)
            let f = (1 << (display_tile.z - this.maxDataLevel))
            let base_x = data_tile.x * f
            let base_y = data_tile.y * f
            let offset_x = display_tile.x - base_x
            let offset_y = display_tile.y - base_y
            return [offset_x*width,offset_y*width,(offset_x+1)*width,(offset_y+1)*width] // fixme
        }
    }

    public async getTile(display_tile: Zxy):Promise<PreparedTile> {
        let data_tile = this.dataTile(display_tile)
        const data = await this.tileCache.get(data_tile)
        return {
            data:data,
            transform:this.transform(display_tile),
            bbox:this.bbox(display_tile),
            z:display_tile.z,
            data_tile: data_tile
        }
    } 

    public async within(display_tile: Zxy, x:number, y:number) {
        let data_tile = this.dataTile(display_tile)
        const data = await this.tileCache.get(data_tile)

        let pt = this.point(display_tile,x,y)
        let retval = []

        for (let [layer_name,features] of Object.entries(data)) {
            for (let feature of features) {
                let fbox = feature.bbox
                if (fbox[0] < pt.x && fbox[1] < pt.y && fbox[2] > pt.x && fbox[3] > pt.y) {
                    retval.push([layer_name,feature])
                }
            }
        }

        return retval
    }
}

