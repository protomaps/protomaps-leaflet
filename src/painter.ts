import Point from '@mapbox/point-geometry'
import { Zxy } from './tilecache'
import { PaintData } from './view'
import { LabelData } from './labeler'
import { PaintSymbolizer } from './symbolizer'

export interface Rule {
   dataLayer: string
   symbolizer: PaintSymbolizer
   filter?(properties:any): boolean
}

// make this not depend on element?
export async function painter(state,key,paint_data:PaintData,label_data:LabelData,rules:Rule[],debug) {
    let start = performance.now()
    let ctx
    if (!state.ctx) {
        ctx = state.element.getContext('2d',{alpha:false})
        state.ctx = ctx
    } else {
        ctx = state.ctx
    }
    // the element might not match the coordinate anymore...
    if (state.element && state.element.key != key) {
        return
    }
    ctx.setTransform(state.tile_size/256,0,0,state.tile_size/256,0,0)
    ctx.save()
    ctx.fillStyle = "rgba(0,0,0,1)"
    ctx.globalCompositeOperation = "destination-out"
    ctx.fillRect(0,0,256,256)
    ctx.restore()
    ctx.miterLimit = 1

    for (var rule of rules) {
        var layer = paint_data.data[rule.dataLayer]
        if (layer === undefined) continue
        rule.symbolizer.before(ctx,paint_data.z)
        for (var feature of layer) {
            var fbox = feature.bbox
            var vbox = paint_data.bbox
            if (fbox[2] < vbox[0] || fbox[0] > vbox[2] || fbox[1] > vbox[3] || fbox[3] < vbox[1]) {
                continue
            }
            if (rule.filter) {
                if (!rule.filter(feature.properties)) continue
            }
            await rule.symbolizer.draw(ctx,feature.geom,paint_data.transform)
        }
    }

    let matches = label_data.data.search(label_data.bbox)
    for (var label of matches) {
        label.draw(ctx,label.anchor.clone().mult(label_data.transform.scale).add(label_data.transform.translate))
        if (debug) {
            ctx.lineWidth = 1
            ctx.strokeStyle = "black"
            ctx.fillStyle = "black"
            ctx.globalAlpha = 1
            let tl = new Point(label.minX,label.minY).mult(label_data.transform.scale).add(label_data.transform.translate)
            let br = new Point(label.maxX,label.maxY).mult(label_data.transform.scale).add(label_data.transform.translate)
            let anchor = label.anchor.clone().mult(label_data.transform.scale).add(label_data.transform.translate)
            ctx.strokeRect(tl.x,tl.y,br.x-tl.x,br.y-tl.y)
            ctx.fillRect(anchor.x-2,anchor.y-2,4,4)
        }
    }
    return performance.now() - start
}