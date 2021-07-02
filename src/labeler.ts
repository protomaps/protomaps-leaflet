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

export interface Label {
    anchor:Point
    bboxes:Bbox[]
    draw:(ctx:any)=>void
}

export interface IndexedLabel {
    label:Label
    order:number
    parentKey:string
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

export const covering = (display_zoom:number,tile_width:number,bbox:Bbox) => {
    let res = 256
    let f = tile_width / res

    let minx = Math.floor(bbox.minX / res)
    let miny = Math.floor(bbox.minY / res)
    let maxx = Math.floor(bbox.maxX / res)
    let maxy = Math.floor(bbox.maxY / res)
    let leveldiff = Math.log2(f)

    let retval = []
    for (let x = minx; x <= maxx; x++) {
        for (let y = miny; y <= maxy; y++) {
            retval.push({
                display:toIndex({z:display_zoom,x:x,y:y}),
                key:toIndex({z:display_zoom-leveldiff,x:Math.floor(x/f),y:Math.floor(y/f)})
            })
        }
    }
    return retval
}

// order and key
export class Index {
    tree: RBush 
    labels: Label[]

    constructor() {
        this.tree = new RBush()
        this.labels = []
    }

    public searchBbox(bbox:Bbox) {
        let labels = new Set<Label>()
        for (let match of this.tree.search(bbox)) {
            labels.add(match.label)
        }
        return labels
    }

    public searchLabel(label:Label) {
        let labels = new Set<Label>()
        for (let bbox of label.bboxes) {
            for (let match of this.tree.search(bbox)) {
                labels.add(match.label)
            }
        }
        return labels
    }

    public bboxCollides(bbox:Bbox) {
        return this.tree.collides(bbox)
    }

    public labelCollides(label:Label) {
        for (let bbox of label.bboxes) {
            if (this.tree.collides(bbox)) return true
        }
        return false
    }

    public insert(label:Label):void {
        this.labels.push(label)
        for (let bbox of label.bboxes) {
            var b:any = bbox
            b.label = label
            this.tree.insert(b)
        }
    }

    // not done yet

    public all() {
        return this.tree.all()
    }

    public remove(obj) {
        return this.tree.remove(obj)
    }

}

// TODO support deduplicated Labeling
export class Labeler {
    index: Index
    z: number
    scratch: any
    labelRules: LabelRule[]
    current: Set<string>
    callback: TileInvalidationCallback

    constructor(z:number,scratch,labelRules:LabelRule[],callback:TileInvalidationCallback) {
        this.index = new Index()
        this.z = z
        this.scratch = scratch
        this.labelRules = labelRules
        this.callback = callback
        this.current = new Set<string>()
    }

    private layout(pt:PreparedTile):number {
        let start = performance.now()
        let key = toIndex(pt.data_tile)

        let tiles_invalidated = new Set<string>()
        for (var [order, rule] of this.labelRules.entries()) {
            if (rule.visible == false) continue
            if (rule.minzoom && this.z < rule.minzoom) continue
            if (rule.maxzoom && this.z > rule.maxzoom) continue
            let layer = pt.data.get(rule.dataLayer)
            if (layer === undefined) continue

            let feats = layer
            if (rule.sort) feats.sort((a,b) => rule.sort(a.properties,b.properties))
            for (let feature of feats) {
                if (rule.filter && !rule.filter(feature.properties)) continue
                let transformed = transformGeom(feature.geom,pt.scale,pt.origin)
                let labels = rule.symbolizer.stash(this.index, this.scratch, transformed,feature, this.z)
                if (!labels) continue

                for (let label of labels) {
                    var label_added = false
                    if (this.index.labelCollides(label)) {
                        // check order

                    } else {
                        this.index.insert(label)
                        label_added = true
                    }

                    // this.finalizeLabel(tiles_invalidated,label,order,key,pt)

                    if (label_added) {
                        for (let bbox of label.bboxes) {
                            if (bbox.maxX > (pt.origin.x+pt.dim)|| bbox.minX < pt.origin.x || bbox.minY < pt.origin.y || bbox.maxY > (pt.origin.y+pt.dim)) {
                                this.findInvalidatedTiles(tiles_invalidated,pt.dim,bbox,key)
                            }
                        }
                    }
                }
            }
        }
        if (tiles_invalidated.size > 0) {
            this.callback(tiles_invalidated)
        }

        return performance.now() - start
    }

    private finalizeLabel(tiles_invalidated:Set<string>,label:Label,order:number,key:string,pt:PreparedTile) {
        let anchor = label.anchor
        let collisions = this.index.searchLabel(label)
        if (collisions.size > 0) {
            let override = true
            for (let collision of collisions) {
                if (order >= collision.order) {
                    override = false
                }
            }
            if (override) {
                for (let collision of collisions) {
                    // remove all collided bboxes, and knock out
                    this.findInvalidatedTiles(tiles_invalidated,pt.dim,collision,key)
                    this.index.remove(collision) // TODO need to remove entire label: all bboxes
                }
            }
        }
    }

    private findInvalidatedTiles(tiles_invalidated:Set<string>,dim:number,bbox:Bbox,key:string) {
        let touched = covering(this.z,dim,bbox)
        for (let s of touched) {
            if (s.key != key && this.current.has(s.key)) {
                tiles_invalidated.add(s.display)
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
            for (let entry of this.index.all()) {
                if (entry.key === max_key) {
                    to_delete.push(entry)
                }
            }
            to_delete.forEach(t => {
                this.index.remove(t)
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

    public getIndex(z:number):RBush {
        return this.labelers.get(z).index
    }
}