import { ZxySource, TileCache } from '../tilecache'
import { Superview } from '../view'
import { Rule, painter } from '../painter'
import { Superlabeler } from '../labeler'
import { paint_style, label_style } from '../default_style/light'

export class Static {
    paint_style:Rule[]
    label_style:Rule[]
    view:Superview
    debug:boolean
    scratch:any

    constructor(options) {
        this.paint_style = options.paint_style || paint_style
        this.label_style = options.label_style || label_style
        let cache = new TileCache(new ZxySource(options.url))
        this.view = new Superview(cache,14,4096)
        this.debug = options.debug || false
    }

    async draw(ctx) {
        let labeler = new Superlabeler(this.view, 1, ctx, this.label_style)
        let paint_datas = await this.view.get()
        let label_data = await labeler.get()

        for (let paint_data of paint_datas) {
            let p = painter({ctx:ctx},"key",paint_data,label_data,this.paint_style,false)
        }
    }
}
