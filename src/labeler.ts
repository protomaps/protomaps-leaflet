import Point from '@mapbox/point-geometry'
import { PreparedTile, transformGeom } from './view'
import { Zxy, toIndex } from './tilecache'
import RBush from 'rbush'
import { LabelSymbolizer } from './symbolizer'

type TileInvalidationCallback = (tiles:Set<string>)=>void

export interface Bbox {
    minX:number,
    minY:number,
    maxX:number,
    maxY:number
}

export interface LabelRule {
    minzoom?:number
    maxzoom?:number
    dataLayer:string 
    symbolizer: LabelSymbolizer
    filter?:(properties:any)=>boolean
    visible?:boolean
    sort?:(a:any,b:any)=>number
}

// support deduplicated Labeling
export class Labeler {
    tree: RBush
    z: number
    scratch: any
    labelRules: LabelRule[]
    current: Set<string>
    callback: TileInvalidationCallback

    constructor(z:number,scratch,labelRules:LabelRule[],callback:TileInvalidationCallback) {
        this.tree = new RBush()
        this.z = z
        this.scratch = scratch
        this.labelRules = labelRules
        this.callback = callback
        this.current = new Set<string>()
    }

    // TODO the symbolizer should return a set of bboxes and a draw callback
    // or it should return null
    // approximated by a series of bboxes...
    private layout(pt:PreparedTile):number {
        let start = performance.now()

        let tiles_invalidated = new Set<string>()
        for (var [order, rule] of this.labelRules.entries()) {
            if (rule.visible == false) continue
            if (rule.minzoom && this.z < rule.minzoom) continue
            if (rule.maxzoom && this.z > rule.maxzoom) continue
            let layer = pt.data.get(rule.dataLayer)
            if (layer === undefined) continue

            let feats = layer
            if (rule.sort) {
                feats.sort((a,b) => rule.sort(a.properties,b.properties))
            }
            for (let feature of feats) {
                if (rule.filter) {
                    if (!rule.filter(feature.properties)) continue
                }
                // TODO ignore those that don't "belong" to us
                let transformed = transformGeom(feature.geom,pt.scale,pt.origin)
                let stash = rule.symbolizer.stash(this.scratch, transformed,feature, this.z)
                if (!stash) continue
                let anchor = stash.anchor
                let bbox = stash.bbox
                let collisions = this.tree.search(bbox)
                if (collisions.length == 0) {
                    let entry = {
                        anchor: anchor,
                        draw:stash.draw,
                        order: order,
                        key:toIndex(pt.data_tile)
                    }
                    this.tree.insert(Object.assign(entry,bbox))
                    // determine the display tiles that this invalidates
                    // these are the display tiles that don't belong to this data tile
                    // also consider "current"

                    if (bbox.maxX > (pt.origin.x+pt.dim)|| bbox.minX < pt.origin.x || bbox.minY < pt.origin.y || bbox.maxY > (pt.origin.y+pt.dim)) {
                        this.findInvalidatedTiles(tiles_invalidated,pt.data_tile,bbox)
                    }
                } else {
                    let override = true
                    for (let collision of collisions) {
                        if (order >= collision.order) {
                            override = false
                        }
                    }
                    if (override) {
                        for (let collision of collisions) {
                            // remove all collided bboxes, and knock out
                            this.findInvalidatedTiles(tiles_invalidated,pt.data_tile,collision)
                            this.tree.remove(collision)
                        }
                        let entry = {
                            anchor: anchor,
                            draw:stash.draw,
                            order: order
                        }
                        this.tree.insert(Object.assign(entry,bbox))
                    }
                }
            }
        }
        if (tiles_invalidated.size > 0) {
            this.callback(tiles_invalidated)
        }

        return performance.now() - start
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

    private findInvalidatedTiles(tiles_invalidated,c,bbox) {
        let spillovers = this.covering(this.z,c,bbox)
        for (let s of spillovers) {
            let s_idx = toIndex({z:s.z-2,x:Math.floor(s.x/4),y:Math.floor(s.y/4)})
            if (this.current.has(s_idx)) {
                tiles_invalidated.add(toIndex(s))
            }
        }
    }

    private pruneCache(added:PreparedTile) {
        if (this.current.size > 16) {
            let max_key = undefined
            let max_dist = 0
            for (let key of this.current) {
                let split = key.split(':')
                let dist = Math.sqrt(Math.pow(+split[0]-added.data_tile.x,2) + Math.pow(+split[1]-added.data_tile.y,2))
                if (dist > max_dist) {
                    max_dist = dist
                    max_key = key
                }
            }

            this.current.delete(max_key)
            let to_delete = []
            for (let entry of this.tree.all()) {
                if (entry.key === max_key) {
                    to_delete.push(entry)
                }
            }
            to_delete.forEach(t => {
                this.tree.remove(t)
            })
        }
    }

    public add(prepared_tile:PreparedTile):number {
        let idx = toIndex(prepared_tile.data_tile)
        if(this.current.has(idx)) {
            return 0
        } else {
            let timing = this.layout(prepared_tile)
            this.current.add(idx)
            this.pruneCache(prepared_tile)
            return timing
        }
    }
}

export class Labelers {
    labelers: Map<number,Labeler>
    scratch: any
    labelRules: LabelRule[]
    callback: TileInvalidationCallback

    constructor(scratch: any, labelRules:LabelRule[], callback:TileInvalidationCallback) {
        this.labelers = new Map<number,Labeler>()
        this.scratch = scratch 
        this.labelRules = labelRules
        this.callback = callback
    }

    public add(prepared_tile:PreparedTile):number {
        if (!this.labelers.get(prepared_tile.z)) {
            this.labelers.set(prepared_tile.z,new Labeler(prepared_tile.z,this.scratch,this.labelRules,this.callback))
        }
        return this.labelers.get(prepared_tile.z).add(prepared_tile)
    }

    public getTree(z:number):RBush {
        return this.labelers.get(z).tree
    }
}