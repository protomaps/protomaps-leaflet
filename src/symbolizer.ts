import Point from '@mapbox/point-geometry'
import { GeomType } from './tilecache'
import { Transform } from './view'
import polylabel from 'polylabel'
import { linebreak, isCjk } from './text'
import { simpleLabel } from './line'

export interface PaintSymbolizer {
    before(ctx:any,z:number):any
    draw(ctx:any,geom:any,transform:Transform):void
}

export interface LabelStash {
    anchor:Point
    bbox:any
    draw:any
}

export interface LabelSymbolizer {
    stash(ctx:any,feature:any):LabelStash | undefined
}

export const createPattern = (width,height, fn) => {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    canvas.width = width
    canvas.height = height
    fn(canvas,ctx)
    return canvas
}

export class FillSymbolizer implements PaintSymbolizer {
    fill: string
    opacity: number

    constructor(options) {
        this.fill = options.fill || "#000000"
        this.opacity = options.opacity || 1
        this.pattern = options.pattern

    }

    public before(ctx) {
        if (this.pattern) {
            ctx.fillStyle = ctx.createPattern(this.pattern, 'repeat')
        } else {
            ctx.fillStyle = this.fill
        }
        ctx.globalAlpha = this.opacity
        // ctx.imageSmoothingEnabled = false // broken on safari
    }

    public draw(ctx,geom,transform:Transform) {
        ctx.beginPath()
        for (var poly of geom) {
            for (var p = 0; p < poly.length-1; p++) {
                let pt = poly[p].mult(transform.scale).add(transform.translate)
                if (p == 0) ctx.moveTo(pt.x,pt.y)
                else ctx.lineTo(pt.x,pt.y)
            }
        }
        ctx.fill()
    }
}

export function exp(z:number,base:number,stops):number {
    if (z <= stops[0][0]) return stops[0][1]
    if (z >= stops[stops.length-1][0]) return stops[stops.length-1][1]
    let idx = 0
    while (stops[idx+1][0] < z) idx++
    let normalized_x = (z-stops[idx][0]) / (stops[idx+1][0] - stops[idx][0])
    let normalized_y = Math.pow(normalized_x,base)
    return stops[idx][1] + normalized_y * (stops[idx+1][1] - stops[idx][1])
}

function isFunction(obj) {
  return !!(obj && obj.constructor && obj.call && obj.apply);
}

export class LineSymbolizer implements PaintSymbolizer {
    color:string
    width:any
    opacity:number

    constructor(options) {
        this.color = options.color || "#000000"
        this.width = options.width || 1
        this.opacity = options.opacity || 1
    } 

    public before(ctx,z:number) {
        ctx.strokeStyle = this.color
        ctx.globalAlpha = this.opacity

        if (isFunction(this.width) && this.width.length == 1) {
            ctx.lineWidth = this.width(z)
        } else {
            ctx.lineWidth = this.width
        }
    }

    public draw(ctx,geom,transform:Transform) {
        ctx.beginPath()
        for (var ls of geom) {
            for (var p = 0; p < ls.length; p++) {
                let pt = ls[p].mult(transform.scale).add(transform.translate)
                if (p == 0) ctx.moveTo(pt.x,pt.y);
                else ctx.lineTo(pt.x,pt.y);
            }
        }
        ctx.stroke()
    }
}

export class IconSymbolizer implements PaintSymbolizer {

    constructor(options) {
        this.sprites = options.sprites
        this.name = options.name
    } 

    public before(ctx,z:number) {
    }

    public draw(ctx,geom,transform:Transform) {
        for (var mp of geom) {
            for (var p = 0; p < mp.length; p++) {
                let pt = mp[p].mult(transform.scale).add(transform.translate)
                let r = this.sprites.get(this.name)
                ctx.drawImage(r.canvas,r.x,r.y,r.w,r.h,pt.x,pt.y,r.w/2,r.h/2)
            }
        }
    }
}

export class TextSymbolizer implements LabelSymbolizer {
    fill: string
    font: string|(()=>string)
    property: string
    stroke: number
    width: number
    align: string

    constructor(options) {
        this.fill = options.fill 
        this.font = options.font
        this.property = options.property || "name"
        this.stroke = options.stroke || "black"
        this.width = options.width || 0
        this.align = options.align || "left"
    }

    public stash(scratch, feature, zoom):LabelStash | undefined {
        let property = feature.properties[this.property]
        if (!property) return null

        if (feature.geomType == GeomType.Point) {
            let anchor = new Point(feature.geom[0][0].x,feature.geom[0][0].y)

            let font = this.font
            if (isFunction(this.font)) {
                font = this.font(feature.properties,zoom)
            }

            scratch.font = font
            let metrics = scratch.measureText(property)
            let p = 2

            let width = metrics.width
            let ascent = metrics.actualBoundingBoxAscent
            let descent = metrics.actualBoundingBoxDescent

            let bbox = {
                minX:0, 
                minY:-ascent*4,
                maxX:width*4,
                maxY:descent*4
            }
            let b = [-p,-ascent-p,width+p*2,ascent+descent+p*2]
            let textX = 0
            if (this.align == "center") {
                bbox = {
                    minX:-width*4/2, 
                    minY:-ascent*4,
                    maxX:width*4/2,
                    maxY:descent*4
                }
                b = [-p-width/2,-ascent-p,width+p*2,ascent+descent+p*2]
                textX = -width/2
            }

            let draw = (ctx,a) => {
                ctx.globalAlpha = 1
                ctx.font = font

                // if (isCjk(property)) {
                //     ctx.fillStyle = "white"
                //     ctx.fillRect(a.x+b[0],a.y+b[1],b[2],b[3])
                // }

                if (this.width) {
                    ctx.lineWidth = this.width
                    ctx.strokeStyle = this.stroke
                    ctx.strokeText(property,a.x+textX,a.y)
                }

                ctx.fillStyle = this.fill
                ctx.fillText(property,a.x+textX,a.y)

            }
            return {anchor:anchor,bbox:bbox,draw:draw}
        }
    }
}

export class LineLabelSymbolizer implements LabelSymbolizer {
    fill: string
    stroke: number
    width: number
    font: string

    constructor(options) {
        this.fill = options.fill || "black"
        this.stroke = options.stroke || "black"
        this.width = options.width || 0
        this.font = options.font || "12px sans-serif"
    } 

    public stash(scratch,feature): LabelStash | undefined {
        let name = feature.properties["name"]
        if (!name) return undefined
        let fbbox = feature.bbox
        let area = (fbbox[3] - fbbox[1]) * (fbbox[2]-fbbox[0]) // needs to be based on zoom level
        if (area < 100) return undefined

        scratch.font = this.font
        let metrics = scratch.measureText(name)
        let width = metrics.width

        let result = simpleLabel(feature.geom,width)
        if (!result) return undefined
        let dx = result.end.x - result.start.x
        let dy = result.end.y - result.start.y

        let anchor = new Point(result.start.x,result.start.y)

        var bboxMinX = 0
        var bboxMaxX = dx
        var bboxMinY = 0
        var bboxMaxY = dy

        if (dx < 0) {
            bboxMinX = dx
            bboxMaxX = 0
        } if (dy < 0) {
            bboxMinY = dy
            bboxMaxY = 0
        }
        let bbox = {minX:bboxMinX*4,minY:bboxMinY*4,maxX:bboxMaxX*4,maxY:bboxMaxY*4}

        let draw = (ctx,a) => {
            ctx.beginPath()
            ctx.globalAlpha = 1
            ctx.moveTo(a.x,a.y)
            // ctx.strokeStyle = "red"
            // ctx.lineTo(a.x+dx,a.y+dy)
            // ctx.stroke()
            ctx.save()
            ctx.translate(a.x,a.y)
            ctx.rotate(Math.atan2(dy, dx))
            if (dx < 0) ctx.scale(0,-1)
            ctx.font = this.font
            if (this.stroke > 0) {
                ctx.strokeStyle = this.stroke
                ctx.lineWidth = this.width
                ctx.strokeText(name,0,0)
            }
            ctx.fillStyle = this.fill
            ctx.fillText(name,0,0)
            ctx.restore()
        }

        return {anchor:anchor,bbox:bbox,draw:draw}
    }
}

export class PolygonLabelSymbolizer implements LabelSymbolizer {
    fill:string
    font:string

    constructor(options) {
        this.fill = options.fill || "black"
        this.font = options.font || "16px sans-serif"
    }

    public stash(scratch, feature):LabelStash | undefined {
        let fbbox = feature.bbox
        let area = (fbbox[3] - fbbox[1]) * (fbbox[2]-fbbox[0]) // needs to be based on zoom level
        if (area < 200000) return undefined
        let property = feature.properties["name"]
        if (!property) return null

        let first_poly = feature.geom[0]
        let found = polylabel([first_poly.map(c => [c.x,c.y])])
        let anchor = new Point(found[0],found[1])
        scratch.font = this.font
        let metrics = scratch.measureText(property)
        let width = metrics.width
        let bbox = {
            minX:-width*4/2, 
            minY:-metrics.actualBoundingBoxAscent*4,
            maxX:width*4/2,
            maxY:metrics.actualBoundingBoxDescent*4
        }

        let fill = this.fill

        let draw = (ctx,a) => {
            ctx.globalAlpha = 1
            ctx.fillStyle = fill
            ctx.font = this.font
            ctx.fillText(property,a.x-width/2,a.y)

        }
        return {anchor:anchor,bbox:bbox,draw:draw}
    }
}