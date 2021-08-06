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

let unproject = (point:Point) => {
    var d = 180 / Math.PI
    return {
        lat:(2*Math.atan(Math.exp(point.y/R)) - (Math.PI/2))*d,
        lng:point.x*d/R
    }
}

let instancedProject = (origin:Point,display_zoom:number) => {
    return (latlng:number[]) => {
        let projected = project(latlng)
        let normalized = new Point((projected.x+MAXCOORD)/(MAXCOORD*2),1-(projected.y+MAXCOORD)/(MAXCOORD*2))
        return normalized.mult((1 << display_zoom) * 256).sub(origin)
    }
}

let instancedUnproject = (origin:Point,display_zoom:number) => {
    return (point:Point) => {
        console.log(point)
        let normalized = new Point(point.x,point.y).add(origin).div((1 << display_zoom) * 256)
        let projected = new Point(normalized.x*(MAXCOORD*2)-MAXCOORD,(1-normalized.y)*(MAXCOORD*2)-MAXCOORD)
        return unproject(projected)
    }
}

export const getZoom = (degrees_lng:number,css_pixels:number):number => {
    let d = css_pixels * (360/degrees_lng)
    return Math.log2(d/256)
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

    async drawContext(ctx:any,width:number,height:number,latlng:number[],display_zoom:number) {
        let center = project(latlng)
        let normalized_center = new Point((center.x+MAXCOORD)/(MAXCOORD*2),1-(center.y+MAXCOORD)/(MAXCOORD*2))

        // the origin of the painter call in global Z coordinates
        let origin = normalized_center.clone().mult(Math.pow(2,display_zoom) * 256).sub(new Point(width/2,height/2))

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
                ctx.strokeStyle = this.debug
                ctx.strokeRect(prepared_tile.origin.x,prepared_tile.origin.y,prepared_tile.dim,prepared_tile.dim)
            }
            ctx.restore()
        }

        // TODO this API isn't so elegant
        return {
            elapsed:performance.now() - start,
            project:instancedProject(origin,display_zoom),
            unproject:instancedUnproject(origin,display_zoom)
        }
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

    async drawContextBounds(ctx:any,top_left:Point,bottom_right:Point,width:number,height:number) {
        let delta_degrees = bottom_right[0] - top_left[0]
        let center = [(top_left[1]+bottom_right[1])/2,(top_left[0]+bottom_right[0])/2]
        return this.drawContext(ctx,width,height,center,getZoom(delta_degrees,width))
    }

    async drawCanvasBounds(canvas:any,top_left:Point,bottom_right:Point,width:number,options:any = {}) {
        let delta_degrees = bottom_right[0] - top_left[0]
        let center = [(top_left[1]+bottom_right[1])/2,(top_left[0]+bottom_right[0])/2]
        return this.drawCanvas(canvas,center,getZoom(delta_degrees,width),options)
    }
}
