import Point from '@mapbox/point-geometry'
import { ZxySource, PmtilesSource, TileCache } from '../tilecache'
import { Superview } from '../view'
import { Rule, painter } from '../painter'
import { LabelRule, Superlabeler } from '../labeler'
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
    view:Superview
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
        this.view = new Superview(cache,14,4096)
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
        let paint_datas = await this.view.get(normalized_center,zoom,width,height)
        // let labeler = new Superlabeler(this.view, 1, ctx, this.label_rules)
        // let label_data = await labeler.get()

        let p = painter({ctx:ctx},"key",paint_datas,{},this.paint_rules,false)

        if (this.debug) {
            for (var paint_data of paint_datas) {
                ctx.strokeStyle = "black"
                ctx.strokeRect(paint_data.transform.translate.x,paint_data.transform.translate.y,1024,1024)
            }
        }
    }
}
