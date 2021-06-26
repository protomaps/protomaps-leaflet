import Point from '@mapbox/point-geometry'
import { ZxySource, PmtilesSource, TileCache } from '../tilecache'
import { Superview } from '../view'
import { Rule, painter } from '../painter'
import { LabelRule, Superlabeler } from '../labeler'
import { paint_rules , label_rules } from '../default_style/light'

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

    async draw(canvas,center:Point,zoom:number) {
        let dpr = window.devicePixelRatio
        canvas.width = canvas.clientWidth * dpr
        canvas.height = canvas.clientHeight * dpr
        let ctx = canvas.getContext('2d')
        ctx.setTransform(dpr,0,0,dpr,0,0)
        ctx.fillText("Test label",50,50)
        let labeler = new Superlabeler(this.view, 1, ctx, this.label_rules)
        let paint_datas = await this.view.get(center,zoom,canvas.clientWidth,canvas.clientHeight)
        let label_data = await labeler.get()

        for (let paint_data of paint_datas) {
            let p = painter({ctx:ctx},"key",paint_data,label_data,this.paint_rules,false)
        }
    }
}
