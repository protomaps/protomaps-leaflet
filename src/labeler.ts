import Point from '@mapbox/point-geometry'
import { PreparedTile, View, transformGeom } from './view'
import { Zxy, toIndex } from './tilecache'
import RBush from 'rbush'
import { LabelSymbolizer } from './symbolizer'

type Listener = (tiles:Set<string>)=>void

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
    view: View
    z: number
    scratch: any
    labelStyle: LabelRule[]
    current: Set<string>
    listener: Listener

    constructor(view:View,z:number,scratch,label_style:LabelRule[],listener:Listener) {
        this.tree = new RBush()
        this.view = view
        this.z = z
        this.scratch = scratch
        this.labelStyle = label_style
        this.listener = listener
        this.current = new Set<string>()
    }

    // TODO the symbolizer should return a set of bboxes and a draw callback
    // or it should return null
    // approximated by a series of bboxes...
    private layout(pt:PreparedTile):boolean {
        let start = performance.now()

        let knockouts = new Set<string>()
        for (var [order, rule] of this.labelStyle.entries()) {
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
                        this.findSpills(knockouts,pt.data_tile,bbox)
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
                            this.findSpills(knockouts,pt.data_tile,collision)
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
        if (knockouts.size > 0) {
            this.listener(knockouts)
        }

        return true
        // console.log("Layout: ", performance.now() - start)
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

    private findSpills(knockouts,c,bbox) {
        let spillovers = this.covering(this.z,c,bbox)
        for (let s of spillovers) {
            let s_idx = toIndex({z:s.z-2,x:Math.floor(s.x/4),y:Math.floor(s.y/4)})
            if (this.current.has(s_idx)) {
                knockouts.add(toIndex(s))
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

    public add(prepared_tile:PreparedTile) {
        let idx = toIndex(prepared_tile.data_tile)
        if(this.current.has(idx)) {
            return this.tree
        } else {
            this.layout(prepared_tile)
            this.current.add(idx)
            this.pruneCache(prepared_tile)
            return this.tree
        }
    }
}

export class Labelers {
    labelers: Map<number,Labeler>
    view: View
    scratch: any
    labelStyle: any
    listener: Listener

    constructor(view:View,scratch: any, label_style:any, listener:Listener) {
        this.labelers = new Map<number,Labeler>()
        this.view = view
        this.scratch = scratch 
        this.labelStyle = label_style
        this.listener = listener
    }

    public add(prepared_tile:PreparedTile) {
        if (!this.labelers.get(prepared_tile.z)) {
            this.labelers.set(prepared_tile.z,new Labeler(this.view,prepared_tile.z,this.scratch,this.labelStyle,this.listener))
        }
        return this.labelers.get(prepared_tile.z).add(prepared_tile)
    }
}