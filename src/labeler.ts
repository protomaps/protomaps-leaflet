import Point from '@mapbox/point-geometry'
import { PreparedTile, transformGeom } from './view'
import { Zxy, toIndex, Bbox } from './tilecache'
import RBush from 'rbush'
import { LabelSymbolizer } from './symbolizer'

type TileInvalidationCallback = (tiles:Set<string>)=>void

export interface Label {
    anchor:Point
    bboxes:Bbox[]
    draw:(ctx:any)=>void
}

export interface IndexedLabel {
    anchor:Point
    bboxes:Bbox[]
    draw:(ctx:any)=>void
    order:number
    tileKey:string
}

export interface Layout {
    index:Index
    order:number
    scratch:any
    zoom:number
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

export class Index {
    tree: RBush 
    current:Map<string,Set<IndexedLabel>>

    constructor() {
        this.tree = new RBush()
        this.current = new Map()
    }

    public has(tileKey:string):boolean {
        return this.current.has(tileKey)
    }

    public size():number {
        return this.current.size
    }

    public keys() {
        return this.current.keys()
    }

    public searchBbox(bbox:Bbox,order:number):Set<IndexedLabel> {
        let labels = new Set<IndexedLabel>()
        for (let match of this.tree.search(bbox)) {
            if (match.indexed_label.order <= order) {
                labels.add(match.indexed_label)
            }
        }
        return labels
    }

    public searchLabel(label:Label,order:number):Set<IndexedLabel> {
        let labels = new Set<IndexedLabel>()
        for (let bbox of label.bboxes) {
            for (let match of this.tree.search(bbox)) {
                if (match.indexed_label.order <= order) {
                    labels.add(match.indexed_label)
                }
            }
        }
        return labels
    }

    public bboxCollides(bbox:Bbox,order:number):boolean {
        for (let match of this.tree.search(bbox)) {
            if (match.indexed_label.order <= order) return true
        }
        return false
    }

    public labelCollides(label:Label,order:number):boolean {
        for (let bbox of label.bboxes) {
            for (let match of this.tree.search(bbox)) {
                if (match.indexed_label.order <= order) return true
            }
        }
        return false
    }

    public insert(label:Label,order:number,tileKey:string):void {
        let indexed_label = {
            anchor:label.anchor,
            bboxes:label.bboxes,
            draw:label.draw,
            order:order,
            tileKey:tileKey
        }
        if (!this.current.has(tileKey)) {
            let newSet = new Set<IndexedLabel>()
            newSet.add(indexed_label)
            this.current.set(tileKey,newSet)
        } else {
            this.current.get(tileKey).add(indexed_label)
        }
        for (let bbox of label.bboxes) {
            var b:any = bbox
            b.indexed_label = indexed_label
            this.tree.insert(b)
        }
    }

    public prune(keyToRemove:string):void {
        let indexed_labels = this.current.get(keyToRemove)
        let entries_to_delete = []
        for (let entry of this.tree.all()) {
            if (indexed_labels.has(entry.indexed_label)) {
                entries_to_delete.push(entry)
            }
        }
        entries_to_delete.forEach(entry => {
            this.tree.remove(entry)
        })
        this.current.delete(keyToRemove)
    }

    public removeLabel(labelToRemove:IndexedLabel):void {
        let entries_to_delete = []
        for (let entry of this.tree.all()) {
            if (labelToRemove == entry.indexed_label) {
                entries_to_delete.push(entry)
            }
        }
        entries_to_delete.forEach(entry => {
            this.tree.remove(entry)
        })
        this.current.get(labelToRemove.tileKey).delete(labelToRemove)
    }
}

// TODO support deduplicated Labeling
export class Labeler {
    index: Index
    z: number
    scratch: any
    labelRules: LabelRule[]
    callback: TileInvalidationCallback

    constructor(z:number,scratch,labelRules:LabelRule[],callback:TileInvalidationCallback) {
        this.index = new Index()
        this.z = z
        this.scratch = scratch
        this.labelRules = labelRules
        this.callback = callback
    }

    private layout(pt:PreparedTile):number {
        let start = performance.now()
        let key = toIndex(pt.data_tile)

        let tiles_invalidated = new Set<string>()
        for (let [order, rule] of this.labelRules.entries()) {
            if (rule.visible == false) continue
            if (rule.minzoom && this.z < rule.minzoom) continue
            if (rule.maxzoom && this.z > rule.maxzoom) continue
            let layer = pt.data.get(rule.dataLayer)
            if (layer === undefined) continue

            let feats = layer
            if (rule.sort) feats.sort((a,b) => rule.sort(a.properties,b.properties))

            let layout = {
                index:this.index,
                zoom:this.z,
                scratch:this.scratch,
                order:order
            }
            for (let feature of feats) {
                if (rule.filter && !rule.filter(feature.properties)) continue
                let transformed = transformGeom(feature.geom,pt.scale,pt.origin)
                let labels = rule.symbolizer.place(layout, transformed,feature)
                if (!labels) continue

                for (let label of labels) {
                    var label_added = false
                    // does the label collide with anything?
                    if (this.index.labelCollides(label,Infinity)) {
                        if (!this.index.labelCollides(label,order)) {
                            let conflicts = this.index.searchLabel(label, Infinity)
                            for (let conflict of conflicts) {
                                this.index.removeLabel(conflict) 
                                for (let bbox of conflict.bboxes) {
                                    this.findInvalidatedTiles(tiles_invalidated,pt.dim,bbox,key)
                                }
                            }
                            this.index.insert(label,order,key)
                            label_added = true
                        }
                        // label not added.
                    } else {
                        this.index.insert(label,order,key)
                        label_added = true
                    }

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
        if (tiles_invalidated.size > 0 && this.callback) {
            this.callback(tiles_invalidated)
        }
        return performance.now() - start
    }

    private findInvalidatedTiles(tiles_invalidated:Set<string>,dim:number,bbox:Bbox,key:string) {
        let touched = covering(this.z,dim,bbox)
        for (let s of touched) {
            if (s.key != key && this.index.has(s.key)) {
                tiles_invalidated.add(s.display)
            }
        }
    }

    private pruneCache(added:PreparedTile) {
        if (this.index.size() > 16) {
            let max_key = undefined
            let max_dist = 0
            for (let key of this.index.keys()) {
                let split = key.split(':')
                let dist = Math.sqrt(Math.pow(+split[0]-added.data_tile.x,2) + Math.pow(+split[1]-added.data_tile.y,2))
                if (dist > max_dist) {
                    max_dist = dist
                    max_key = key
                }
            }
            this.index.prune(max_key)
        }
    }

    public add(prepared_tile:PreparedTile):number {
        let idx = toIndex(prepared_tile.data_tile)
        if(this.index.has(idx)) {
            return 0
        } else {
            let timing = this.layout(prepared_tile)
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