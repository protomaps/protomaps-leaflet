import Point from '@mapbox/point-geometry'
import { GeomType } from './tilecache'
import { Transform } from './view'
import polylabel from 'polylabel'
import { TextSpec, FontSpec, linebreak, isCjk } from './text'
import { simpleLabel } from './line'

export interface PaintSymbolizer {
    before(ctx:any,z:number):any
    draw(ctx:any,feature:any,transform:Transform):void
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

    public draw(ctx,feature,transform:Transform) {
        ctx.beginPath()
        for (var poly of feature.geom) {
            for (var p = 0; p < poly.length-1; p++) {
                let pt = poly[p].mult(transform.scale).add(transform.translate)
                if (p == 0) ctx.moveTo(pt.x,pt.y)
                else ctx.lineTo(pt.x,pt.y)
            }
        }
        ctx.fill()
    }
}

export function arr(base,a):number {
    return z => {
        let b = z - base
        if (b >= 0 && b < a.length) {
            return a[b]
        }
        return 0
    }
}

export function exp(base:number,stops):number {
    return z => {
        if (z <= stops[0][0]) return stops[0][1]
        if (z >= stops[stops.length-1][0]) return stops[stops.length-1][1]
        let idx = 0
        while (stops[idx+1][0] < z) idx++
        let normalized_x = (z-stops[idx][0]) / (stops[idx+1][0] - stops[idx][0])
        let normalized_y = Math.pow(normalized_x,base)
        return stops[idx][1] + normalized_y * (stops[idx+1][1] - stops[idx][1])
    }
}

function isFunction(obj) {
  return !!(obj && obj.constructor && obj.call && obj.apply);
}

function polyLongerThan(mls,minimum) {
    for (let ls of mls) {
        let totalLen = 0
        for (var i = 1; i < ls.length; i++) {
            var c = ls[i]
            var pc = ls[i-1]
            var dx = pc.x - c.x
            var dy = pc.y - c.y
            totalLen += Math.sqrt(dx*dx+dy*dy)
            if (totalLen > minimum) return true
        } 
    }
    return false
}

function maxLsLen(mls) {
    var maxLen = 0
    for (let ls of mls) {
        let totalLen = 0
        for (var i = 1; i < ls.length; i++) {
            var c = ls[i]
            var pc = ls[i-1]
            var dx = pc.x - c.x
            var dy = pc.y - c.y
            totalLen += Math.sqrt(dx*dx+dy*dy)
        } 
        if (totalLen > maxLen) maxLen = totalLen
    }
    return maxLen
}

export class LineSymbolizer implements PaintSymbolizer {
    color:string
    width:any
    opacity:number
    skip:boolean
    dash:any
    dashColor:string

    constructor(options) {
        this.color = options.color || "#000000"
        this.width = options.width || 1
        this.opacity = options.opacity || 1
        this.skip = false
        this.dash = options.dash
        this.dashColor = options.dashColor || "black"
        this.dashWidth = options.dashWidth || 1
    } 

    public before(ctx,z:number) {
        ctx.strokeStyle = this.color
        ctx.globalAlpha = this.opacity

        if (isFunction(this.width) && this.width.length == 1) {
            let width = this.width(z)
            this.skip = (width === 0)
            ctx.lineWidth = width
        } else {
            ctx.lineWidth = this.width
        }
    }

    public draw(ctx,feature,transform:Transform) {
        if (this.skip) return
        ctx.beginPath()
        for (var ls of feature.geom) {
            for (var p = 0; p < ls.length; p++) {
                let pt = ls[p].mult(transform.scale).add(transform.translate)
                if (p == 0) ctx.moveTo(pt.x,pt.y);
                else ctx.lineTo(pt.x,pt.y);
            }
        }
        ctx.stroke()

        if (this.dash) {
            ctx.save()
            ctx.lineWidth = this.dashWidth
            ctx.strokeStyle = this.dashColor
            ctx.setLineDash(this.dash)
            ctx.stroke()
            ctx.restore()
        }
    }
}

export class IconSymbolizer implements LabelSymbolizer {
    constructor(options) {
        this.sprites = options.sprites
        this.name = options.name
    } 

    public stash(scratch,feature,zoom) {
        let pt = feature.geom[0]
        let anchor = new Point(feature.geom[0][0].x,feature.geom[0][0].y)
        let bbox = {
            minX:-32, 
            minY:-32,
            maxX:32,
            maxY:32
        }

        let draw = (ctx,a) => {
            ctx.globalAlpha = 1
            let r = this.sprites.get(this.name)
            ctx.drawImage(r.canvas,r.x,r.y,r.w,r.h,a.x-8,a.y-8,r.w/4,r.h/4)
        }
        return {anchor:anchor,bbox:bbox,draw:draw}
    }
}

export class CircleSymbolizer implements LabelSymbolizer {
    constructor(options) {
        this.radius = options.radius || 3
        this.fill = options.fill || "black"
        this.stroke = options.stroke || "white"
        this.width = options.width || 0
    } 

    public stash(scratch,feature,zoom) {
        let pt = feature.geom[0]
        let anchor = new Point(feature.geom[0][0].x,feature.geom[0][0].y)
        let bbox = {
            minX:-20, 
            minY:-20,
            maxX:20,
            maxY:20
        }

        let draw = (ctx,a) => {
            ctx.globalAlpha = 1

            if (this.width > 0) {
                ctx.fillStyle = this.stroke
                ctx.beginPath()
                ctx.arc(a.x,a.y, this.radius + this.width, 0, 2* Math.PI)
                ctx.fill()
            }

            ctx.fillStyle = this.fill
            ctx.beginPath()
            ctx.arc(a.x,a.y, this.radius, 0, 2* Math.PI)
            ctx.fill()
        }
        return {anchor:anchor,bbox:bbox,draw:draw}
    }
}

export class FlowSymbolizer implements LabelSymbolizer {

}

const mergeBbox = (b1,b2) => {
    return { 
        minX:Math.min(b1.minX,b2.minX),
        minY:Math.min(b1.minY,b2.minY),
        maxX:Math.max(b1.maxX,b2.maxX),
        maxY:Math.max(b1.maxY,b2.maxY),
    }
}

export class GroupSymbolizer implements LabelSymbolizer {
    constructor(list) {
        this.list = list
    }

    public stash(scratch, feature, zoom):LabelStash | undefined {
        var result = this.list[0].stash(scratch,feature,zoom)
        let anchor = result.anchor
        let bbox = result.bbox
        let draws = [result.draw]

        for (let i = 1; i < this.list.length; i++) {
            result = this.list[i].stash(scratch,feature,zoom)
            if (!result) return null
            bbox = mergeBbox(bbox,result.bbox)
            draws.push(result.draw)
        }
        let draw = (ctx,a) => {
            draws.forEach(d => d(ctx,a))
        }

        return {anchor:anchor,bbox:bbox,draw:draw}
    }
}

export class TextSymbolizer implements LabelSymbolizer {
    font: FontSpec
    text: TextSpec
    fill: string
    stroke: number
    width: number
    align: string
    offset: number

    constructor(options) {
        this.font = new FontSpec(options)
        this.text = new TextSpec(options)

        this.fill = options.fill 
        this.property = options.property || "name"
        this.stroke = options.stroke || "black"
        this.width = options.width || 0
        this.align = options.align || "left"
        this.offset = options.offset || 0
        this.textTransform = options.textTransform
    }

    public stash(scratch, feature, zoom):LabelStash | undefined {
        if (feature.geomType == GeomType.Point) {
            let anchor = new Point(feature.geom[0][0].x,feature.geom[0][0].y)
            let font = this.font.str(zoom,feature.properties)
            let property = this.text.str(zoom,feature.properties)
            if (!property) return null
            scratch.font = font
            let metrics = scratch.measureText(property)
            let p = 2

            let width = metrics.width
            let ascent = metrics.actualBoundingBoxAscent
            let descent = metrics.actualBoundingBoxDescent
            let offset = this.offset

            let bbox = {
                minX:offset*4, 
                minY:(-offset-ascent)*4,
                maxX:(offset+width)*4,
                maxY:(-offset+descent)*4
            }

            // centering
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
                    ctx.strokeText(property,a.x+textX+offset,a.y-offset)
                }

                ctx.fillStyle = this.fill
                ctx.fillText(property,a.x+textX+offset,a.y-offset)

            }
            return {anchor:anchor,bbox:bbox,draw:draw}
        }
    }
}

export class LineLabelSymbolizer implements LabelSymbolizer {
    font: FontSpec
    text: TextSpec

    fill: string
    stroke: string
    width: number

    constructor(options) {
        this.font = new FontSpec(options)
        this.text = new TextSpec(options)

        this.fill = options.fill || "black"
        this.stroke = options.stroke || "black"
        this.width = options.width || 0
    } 

    public stash(scratch,feature, zoom): LabelStash | undefined {
        let font = this.font.str(zoom,feature.properties)
        let name = this.text.str(zoom,feature.properties)
        if (!name) return null

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
    font:FontSpec
    text:TextSpec
    fill:string
    stroke: string
    width: number

    constructor(options) {
        this.font = new FontSpec(options)
        this.text = new TextSpec(options)

        this.fill = options.fill || "black"
        this.stroke = options.stroke || "black"
        this.width = options.width || 0
    }

    public stash(scratch, feature, zoom):LabelStash | undefined {
        let fbbox = feature.bbox
        let area = (fbbox[3] - fbbox[1]) * (fbbox[2]-fbbox[0]) // needs to be based on zoom level
        if (area < 200000) return undefined

        let property = this.text.str(zoom,feature.properties)
        if (!property) return null

        let first_poly = feature.geom[0]
        let found = polylabel([first_poly.map(c => [c.x,c.y])])
        let anchor = new Point(found[0],found[1])
        let font = this.font.str(zoom,feature.properties)

        scratch.font = font

        let lines = linebreak(property)

        let lineHeight = 14

        var longestLine
        var longestLineLen = 0 
        for (let line of lines) {
            if (line.length > longestLineLen) {
                longestLineLen = line.length
                longestLine = line
            }
        }

        let metrics = scratch.measureText(longestLine)
        let width = metrics.width
        let bbox = {
            minX:-width*4/2, 
            minY:-metrics.actualBoundingBoxAscent*4,
            maxX:width*4/2,
            maxY:(lineHeight*lines.length-metrics.actualBoundingBoxAscent)*4
        }

        let fill = this.fill

        let draw = (ctx,a) => {
            ctx.globalAlpha = 1

            ctx.font = font

            var y = 0
            for (let line of lines) {
                if (this.width) {
                    ctx.lineWidth = this.width
                    ctx.strokeStyle = this.stroke
                    ctx.strokeText(line,a.x-width/2,a.y+y)
                }
                ctx.fillStyle = fill
                ctx.fillText(line,a.x-width/2,a.y+y)
                y += lineHeight
            }
        }
        return {anchor:anchor,bbox:bbox,draw:draw}
    }
}