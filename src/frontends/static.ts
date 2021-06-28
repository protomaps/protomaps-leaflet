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
        let cache = new TileCache(source)
        this.view = new View(cache,14,4096,2,256)
        this.debug = options.debug || false
    }

    async draw(canvas,latlng:Point,zoom:number) {
        let dpr = window.devicePixelRatio
        let width = canvas.clientWidth
        let height = canvas.clientHeight
        canvas.width = width * dpr
        canvas.height = height * dpr
        let ctx = canvas.getContext('2d')
        ctx.setTransform(dpr,0,0,dpr,0,0)
        let center = project(latlng)
        let normalized_center = new Point((center.x+MAXCOORD)/(MAXCOORD*2),1-(center.y+MAXCOORD)/(MAXCOORD*2))
        let prepared_tiles = await this.view.getCenter(normalized_center,zoom,width,height)

        let start = performance.now()
        let labeler = new Labeler(this.view,zoom,ctx,this.label_rules,null)
        for (var prepared_tile of prepared_tiles) {
            await labeler.add(prepared_tile)
        }

        let bbox = this.view.getCenterBbox(normalized_center,zoom,width,height)
        let translate = this.view.getCenterTranslate(normalized_center,zoom,width,height)
        let p = painter({ctx:ctx},"key",prepared_tiles,labeler.tree,this.paint_rules,bbox,translate,this.debug)

        if (this.debug) {
            for (var prepared_tile of prepared_tiles) {
                ctx.strokeStyle = "black"
                ctx.strokeRect(prepared_tile.transform.translate.x,prepared_tile.transform.translate.y,1024,1024)
            }
        }
        return start = performance.now()
    }
}
