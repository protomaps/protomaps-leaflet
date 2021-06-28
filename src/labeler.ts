import Point from '@mapbox/point-geometry'
import { View, Transform } from './view'
import { Zxy, toIndex, Layer } from './tilecache'
import RBush from 'rbush'
import { LabelSymbolizer } from './symbolizer'

type Listener = (tiles:Set<string>)=>void

export interface Bbox {
    minX:number,
    minY:number,
    maxX:number,
    maxY:number
}

export interface LabelData {
    readonly data: RBush
    readonly transform: Transform
    readonly bbox: Bbox
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

export class Labeler {
    tree: RBush
    view: View
    z: number
    scratch: any
    labelStyle: LabelRule[]
    listener: Listener

    constructor(view:View,z:number,scratch,label_style:LabelRule[]) {
        this.tree = new RBush()
        this.view = view
        this.z = z
        this.scratch = scratch
        this.labelStyle = label_style
    }

    // by default, a noop
    // TODO move me to sublabeler
    protected findSpills(knockouts,c,bbox) {

    }

    protected layout(c:Zxy, data):boolean {
        let start = performance.now()

        let knockouts = new Set<string>()
        let multiplier = 1 << (this.z - c.z - this.view.levelDiff)
        let extent = this.view.dataResolution
        for (var [order, rule] of this.labelStyle.entries()) {
            if (rule.visible == false) continue
            if (rule.minzoom && this.z < rule.minzoom) continue
            if (rule.maxzoom && this.z > rule.maxzoom) continue
            let layer = data[rule.dataLayer]
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
                let stash = rule.symbolizer.stash(this.scratch, feature, this.z)
                if (!stash) continue
                let anchor = stash.anchor
                let bbox = stash.bbox
                let bbox_world = {
                    minX: (c.x* extent + anchor.x) * multiplier + bbox.minX,
                    minY: (c.y* extent + anchor.y) * multiplier + bbox.minY,
                    maxX: (c.x* extent + anchor.x) * multiplier + bbox.maxX,
                    maxY: (c.y* extent + anchor.y) * multiplier + bbox.maxY
                }
                let collisions = this.tree.search(bbox_world)
                if (collisions.length == 0) {
                    let entry = {
                        anchor: new Point(c.x*extent+anchor.x,c.y*extent+anchor.y).mult(multiplier),
                        draw:stash.draw,
                        order: order,
                        key:toIndex(c)
                    }
                    this.tree.insert(Object.assign(entry,bbox_world))
                    // determine the display tiles that this invalidates
                    // these are the display tiles that don't belong to this data tile
                    // also consider "current"

                    // find all the display tiles this label belongs to
                    let em = extent * multiplier
                    if ((bbox_world.maxX > (c.x+1)*em || bbox_world.minX < c.x*em || bbox_world.minY < c.y*em || bbox_world.maxY > (c.y+1)*em)) {
                        this.findSpills(knockouts,c,bbox_world)
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
                            this.findSpills(knockouts,c,collision)
                            this.tree.remove(collision)
                        }
                        let entry = {
                            anchor: new Point(c.x*extent+anchor.x,c.y*extent+anchor.y).mult(multiplier),
                            draw:stash.draw,
                            order: order
                        }
                        this.tree.insert(Object.assign(entry,bbox_world))
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

}

export class Superlabeler extends Labeler {
    constructor(view:View,z:number,scratch,label_style:LabelRule[]) {
        super(view,z,scratch,label_style)
    }

    public async get() {
        let datas = await this.view.getTile()
        // enforce labeling order
        for (let data of datas) {
            this.layout(data.tile,data.data)
        }
        return {
            data:this.tree,
            bbox:{minX:0, minY:0,maxX:16384,maxY:16384},
            transform:{scale:0.25,translate:new Point(-0,-0)}
        }
    }

}

export class Sublabeler extends Labeler {
    current: Set<string>
    inflight: Map<string,any[]>
    // support deduplicated Labeling

    constructor(view:View,z:number, scratch, label_style:LabelRule[], listener:Listener) {
        super(view,z,scratch,label_style)
        this.current = new Set<string>()

        // when current exceeds some number, prune the farthest away
        this.inflight = new Map<string,any[]>()
        this.listener = listener
    }

    protected findSpills(knockouts,c,bbox) {
        let spillovers = this.view.covering(this.z,c,bbox)
        for (let s of spillovers) {
            let s_idx = toIndex({z:s.z-2,x:Math.floor(s.x/4),y:Math.floor(s.y/4)})
            if (this.current.has(s_idx)) {
                knockouts.add(toIndex(s))
            }
        }
    }

    public add(prepared_tile:PreparedTile) {
        let idx = toIndex(prepared_tile.data_tile)

        if(this.current.has(idx)) {
            return this.tree
        } else {
            this.layout(prepared_tile.data_tile,prepared_tile.data)
            this.current.add(idx)

            // prune cache
            if (this.current.size > 16) {
                let max_key = undefined
                let max_dist = 0
                for (let key of this.current) {
                    let split = key.split(':')
                    let dist = Math.sqrt(Math.pow(+split[0]-prepared_tile.data_tile.x,2) + Math.pow(+split[1]-prepared_tile.data_tile.y,2))
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
            return this.tree
        }
    }
}

export class Labelers {
    labelers: Map<number,Sublabeler>
    view: View
    scratch: any
    labelStyle: any
    listener: Listener

    constructor(view:View,scratch: any, label_style:any, listener:Listener) {
        this.labelers = new Map<number,Sublabeler>()
        this.view = view
        this.scratch = scratch 
        this.labelStyle = label_style
        this.listener = listener
    }

    public add(prepared_tile:PreparedTile) {
        if (!this.labelers.get(prepared_tile.z)) {
            this.labelers.set(prepared_tile.z,new Sublabeler(this.view,prepared_tile.z,this.scratch,this.labelStyle,this.listener))
        }
        return this.labelers.get(prepared_tile.z).add(prepared_tile)
    }
}