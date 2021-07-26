// @ts-ignore
import Point from '@mapbox/point-geometry'

import { ZxySource, PmtilesSource, TileCache } from '../tilecache'
import { View } from '../view'
import { Rule, painter } from '../painter'
import { LabelRule, Labeler } from '../labeler'
import { light } from '../default_style/light'
import { dark } from '../default_style/dark'
import { paintRules , labelRules } from '../default_style/style'

let R = 6378137
let MAX_LATITUDE = 85.0511287798
let MAXCOORD = R * Math.PI

let project = (latlng:number[]) => {
    let d = Math.PI / 180
    let constrained_lat = Math.max(Math.min(MAX_LATITUDE, latlng[0]), -MAX_LATITUDE)
    let sin = Math.sin(constrained_lat * d)
    return new Point(R*latlng[1]*d,R*Math.log((1+sin)/(1-sin))/2)
}

export class Static {
    paint_rules:Rule[]
    label_rules:LabelRule[]
    view:View
    debug:string
    scratch:any

    constructor(options:any) {
        let theme = options.dark ? dark : light
        this.paint_rules = options.paint_rules || paintRules(theme,options.shade)
        this.label_rules = options.label_rules || labelRules(theme,options.shade,options.language1,options.language2)

        let source
        if (options.url.url) {
            source = new PmtilesSource(options.url,false)
        } else if (options.url.endsWith(".pmtiles")) {
            source = new PmtilesSource(options.url,false)
        } else {
            source = new ZxySource(options.url,false)
        }
        let cache = new TileCache(source,1024)
        this.view = new View(cache,14,2)
        this.debug = options.debug || false
    }

    async drawContext(ctx:any,width:number,height:number,latlng:Point,display_zoom:number) {
        let center = project(latlng)
        let normalized_center = new Point((center.x+MAXCOORD)/(MAXCOORD*2),1-(center.y+MAXCOORD)/(MAXCOORD*2))

        // the origin of the painter call in global Z coordinates
        let origin = normalized_center.clone().mult((1 << display_zoom) * 256).sub(new Point(width/2,height/2))

        // the bounds of the painter call in global Z coordinates
        let bbox = {minX:origin.x,minY:origin.y,maxX:origin.x+width,maxY:origin.y+height}

        let prepared_tiles = await this.view.getBbox(display_zoom,bbox)

        let start = performance.now()
        let labeler = new Labeler(display_zoom,ctx,this.label_rules,undefined) // because need ctx to measure
        for (var prepared_tile of prepared_tiles) {
            await labeler.add(prepared_tile)
        }

        let p = painter(ctx,prepared_tiles,labeler.index,this.paint_rules,bbox,origin,true,this.debug)

        if (this.debug) {
            ctx.save()
            ctx.translate(-origin.x,-origin.y)
            for (var prepared_tile of prepared_tiles) {
                ctx.strokeStyle = "black"
                ctx.strokeRect(prepared_tile.origin.x,prepared_tile.origin.y,prepared_tile.dim,prepared_tile.dim)
            }
            ctx.restore()
        }
        return performance.now() - start
    }

    async drawCanvas(canvas:any,latlng:Point,display_zoom:number,options:any = {}) {
        let dpr = window.devicePixelRatio
        let width = canvas.clientWidth
        let height = canvas.clientHeight
        if (!canvas.sizeSet) {
            canvas.width = width * dpr
            canvas.height = height * dpr
            canvas.sizeSet = true
        }
        canvas.lang = options.lang
        let ctx = canvas.getContext('2d')
        ctx.setTransform(dpr,0,0,dpr,0,0)
        return this.drawContext(ctx,width,height,latlng,display_zoom)
    }
}
