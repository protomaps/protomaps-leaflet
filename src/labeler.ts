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
    dataLayer:string 
    symbolizer: LabelSymbolizer
    filter?(properties:any):boolean
    visible?:boolean
}

export class Labeler {
    tree: RBush
    view: View
    z: number
    scratch: any
    labelStyle: LabelRule[]
    active: boolean

    constructor(view:View,z:number,scratch,label_style:LabelRule[]) {
        this.tree = new RBush()
        this.view = view
        this.z = z
        this.scratch = scratch
        this.labelStyle = label_style
    }

    private layout(c:Zxy, data):boolean {
        let start = performance.now()
        // check the current Z of the map
        if (!this.active) {
            return false
        }

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
    active = true 

    constructor(view:View,z:number,scratch,label_style:LabelRule) {
        super(view,z,scratch,label_style)
    }

    public async get() {
        let datas = await this.view.get()
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

    private findSpills() {

    }

}

export class Sublabeler extends Labeler {
    current: Set<string>
    inflight: Map<string,any[]>
    active = false
    listener: Listener
    // support deduplicated Labeling

    constructor(view:View,z:number, scratch, label_style:LabelRule[], listener:Listener) {
        super(view,z,scratch,label_style)
        this.current = new Set<string>()

        // when current exceeds some number, prune the farthest away
        this.inflight = new Map<string,any[]>()
        this.listener = listener
    }

    private findSpills(knockouts,c,bbox) {
        let spillovers = this.view.covering(this.z,c,bbox)
        for (let s of spillovers) {
            let s_idx = toIndex({z:s.z-2,x:Math.floor(s.x/4),y:Math.floor(s.y/4)})
            if (this.current.has(s_idx)) {
                knockouts.add(toIndex(s))
            }
        }
    }

    private getTree(data_zxy:Zxy) {
        let idx = toIndex(data_zxy)

        return new Promise((resolve, reject) => { 
            if(this.current.has(idx)) {
                resolve(this.tree)
            } else if (this.inflight.get(idx)) {
                this.inflight.get(idx).push([resolve,reject])
            } else {
                this.inflight.set(idx,[])
                this.view.tileCache.get(data_zxy).then(tile => {
                    let success = this.layout(data_zxy,tile)
                    if (success) {
                        this.current.add(idx)
                        this.inflight.get(idx).forEach(f => f[0](this.tree))
                        this.inflight.delete(idx)
                        resolve(this.tree)

                        if (this.current.size > 16) {
                            let max_key = undefined
                            let max_dist = 0
                            for (let key of this.current) {
                                let split = key.split(':')
                                let dist = Math.sqrt(Math.pow(split[0]-data_zxy.x,2) + Math.pow(split[1]-data_zxy.y,2))
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
                    } else {
                        this.inflight.get(idx).forEach(f => f[1]("Cancel label"))
                        this.inflight.delete(idx)
                        reject("Cancel label")
                    }
                }).catch(reason => {
                    this.inflight.get(idx).forEach(f => f[1](reason))
                    this.inflight.delete(idx)
                    reject(reason)
                })
            }
        })
    }

    private bbox(display_tile:Zxy):Bbox {
        let f = this.view.dataResolution / (1 << this.view.levelDiff)
        return {minX: display_tile.x * f, minY: display_tile.y * f, maxX: (display_tile.x + 1) * f, maxY: (display_tile.y + 1) * f}  
    }

    private transform(display_tile:Zxy) {
        let f = this.view.dataResolution / (1 << this.view.levelDiff)
        if (display_tile.z < this.view.levelDiff) {
            if (display_tile.z == 0) return {scale:0.0625,translate:new Point(0,0)}
            if (display_tile.z == 1) return {scale:0.125,translate:new Point(display_tile.x * -this.view.displayResolution,display_tile.y * -this.view.displayResolution)}
        } else {
            return {scale:0.25,translate:new Point(-display_tile.x * f/4, -display_tile.y * f/4)}
        }
    }
    
    public async get(display_tile:Zxy) {
        let data_zxy = this.view.dataTile(display_tile)
        let tree = await this.getTree(data_zxy)
        return {
            data:tree,
            bbox:this.bbox(display_tile),
            transform:this.transform(display_tile)
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

    public async get(display_tile:Zxy) {
        this.labelers.forEach((v,k) => { v.active = false })
        if (!this.labelers.get(display_tile.z)) {
            this.labelers.set(display_tile.z,new Sublabeler(this.view,display_tile.z,this.scratch,this.labelStyle,this.listener))
        }
        this.labelers.get(display_tile.z).active = true
        return this.labelers.get(display_tile.z).get(display_tile)
    }
}