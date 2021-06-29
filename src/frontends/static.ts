import Point from '@mapbox/point-geometry'
import { ZxySource, PmtilesSource, TileCache } from '../tilecache'
import { View } from '../view'
import { Rule, painter } from '../painter'
import { LabelRule, Labeler } from '../labeler'
import { paint_rules , label_rules } from '../default_style/light'

let R = 6378137
let MAX_LATITUDE = 85.0511287798
let MAXCOORD = R * Math.PI

let project = latlng => {
    let d = Math.PI / 180
    let constrained_lat = Math.max(Math.min(MAX_LATITUDE, latlng[0]), -MAX_LATITUDE)
    let sin = Math.sin(constrained_lat * d)
    return new Point(R*latlng[1]*d,R*Math.log((1+sin)/(1-sin))/2)
}

export class Static {
    paint_rules:Rule[]
    label_rules:LabelRule[]
    view:View
    debug:boolean
    scratch:any

    constructor(options) {
        this.paint_rules = options.paint_rules || paint_rules
        this.label_rules = options.label_rules || label_rules

        let source
        if (options.url.url) {
            source = new PmtilesSource(options.url)
        } else if (options.url.endsWith(".pmtiles")) {
            source = new PmtilesSource(options.url)
        } else {
            source = new ZxySource(options.url)
        }
        let cache = new TileCache(source,1024)
        this.view = new View(cache,14,2)
        this.debug = options.debug || false
    }

    async draw(canvas,latlng:Point,display_zoom:number) {
        let dpr = window.devicePixelRatio
        let width = canvas.clientWidth
        let height = canvas.clientHeight

        canvas.width = width * dpr
        canvas.height = height * dpr
        let ctx = canvas.getContext('2d')
        ctx.setTransform(dpr,0,0,dpr,0,0)

        let center = project(latlng)
        let normalized_center = new Point((center.x+MAXCOORD)/(MAXCOORD*2),1-(center.y+MAXCOORD)/(MAXCOORD*2))

        // the origin of the painter call in global Z coordinates
        let origin = normalized_center.clone().mult((1 << display_zoom) * 256).sub(new Point(width/2,height/2))

        // the bounds of the painter call in global Z coordinates
        let bbox = [origin.x,origin.y,origin.x+width,origin.y+height]

        let prepared_tiles = await this.view.getBbox(display_zoom,bbox)

        let start = performance.now()
        let labeler = new Labeler(display_zoom,ctx,this.label_rules,null)
        for (var prepared_tile of prepared_tiles) {
            await labeler.add(prepared_tile)
        }

        let p = painter({ctx:ctx},"key",prepared_tiles,labeler.tree,this.paint_rules,bbox,origin,true,this.debug)

        if (this.debug) {
            ctx.translate(-origin.x,-origin.y)
            for (var prepared_tile of prepared_tiles) {
                ctx.strokeStyle = "black"
                ctx.strokeRect(prepared_tile.origin.x,prepared_tile.origin.y,prepared_tile.dim,prepared_tile.dim)
            }
        }
        return performance.now() - start
    }
}
