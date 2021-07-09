import Point from '@mapbox/point-geometry'
import { Zxy, Bbox } from './tilecache'
import { PreparedTile, transformGeom } from './view'
import { PaintSymbolizer } from './symbolizer'
import { Index } from './labeler'

export interface Rule {
    id?:string
    minzoom:number
    maxzoom:number
    dataLayer: string
    symbolizer: PaintSymbolizer
    filter?(properties:any): boolean
}

// make this not depend on element?
export function painter(ctx:any,prepared_tiles:PreparedTile[],label_data:Index,rules:Rule[],bbox:Bbox,origin:Point,clip:boolean,debug:string) {
    let start = performance.now()
    ctx.save()
    ctx.miterLimit = 2

    for (var prepared_tile of prepared_tiles) {
        let po = prepared_tile.origin
        let ps = prepared_tile.scale
        ctx.save()
        if (clip) {
            ctx.beginPath()
            ctx.rect(po.x-origin.x,po.y-origin.y,prepared_tile.dim,prepared_tile.dim)
            ctx.clip()
        }
        ctx.translate(po.x-origin.x,po.y-origin.y)
        for (var rule of rules) {
            if (rule.minzoom && prepared_tile.z < rule.minzoom) continue
            if (rule.maxzoom && prepared_tile.z > rule.maxzoom) continue
            var layer = prepared_tile.data.get(rule.dataLayer)
            if (layer === undefined) continue
            rule.symbolizer.before(ctx,prepared_tile.z)

            for (var feature of layer) {
                let geom = feature.geom
                let fbox = feature.bbox
                if (fbox.maxX*ps+po.x < bbox.minX || fbox.minX*ps+po.x > bbox.maxX || fbox.minY*ps+po.y > bbox.maxY || fbox.maxY*ps+po.y < bbox.minY) {
                    continue
                }
                let properties = feature.properties
                if (rule.filter && !rule.filter(properties)) continue
                if (ps != 1) {
                    geom = transformGeom(geom,ps, new Point(0,0))
                }
                rule.symbolizer.draw(ctx,geom,properties)
            }
        }
        ctx.restore()
    }

    let matches = label_data.searchBbox(bbox,Infinity)
    for (var label of matches) {
        ctx.save()
        ctx.translate(label.anchor.x-origin.x,label.anchor.y-origin.y)
        label.draw(ctx)
        ctx.restore()
        if (debug) {
            ctx.lineWidth = 0.5
            ctx.strokeStyle = debug
            ctx.fillStyle = debug
            ctx.globalAlpha = 1
            ctx.fillRect(label.anchor.x-origin.x-2,label.anchor.y-origin.y-2,4,4)
            for (let bbox of label.bboxes) {
                ctx.strokeRect(bbox.minX-origin.x,bbox.minY-origin.y,bbox.maxX-bbox.minX,bbox.maxY-bbox.minY)
            }
        }
    }
    ctx.restore()
    return performance.now() - start
}