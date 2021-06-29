import Point from '@mapbox/point-geometry'
import { GeomType, Feature } from './tilecache'
import polylabel from 'polylabel'
import { TextSpec, FontSpec, linebreak, isCjk } from './text'
import { simpleLabel } from './line'

export interface PaintSymbolizer {
    before(ctx:any,z:number):any
    draw(ctx:any,geom:Array<Array<Point>>,properties:any):void
}

export interface LabelStash {
    anchor:Point
    bbox:any
    draw:(ctx:any)=>void
}

export interface LabelSymbolizer {
    stash(ctx:any,geom:Array<Array<Point>>,feature:Feature,zoom:number):LabelStash | undefined
}

export const createPattern = (width,height, fn) => {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    canvas.width = width
    canvas.height = height
    fn(canvas,ctx)
    return canvas
}

export class PolygonSymbolizer implements PaintSymbolizer {
    fill: string
    opacity: number
    pattern: any // FIXME

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

    public draw(ctx,geom,properties) {
        ctx.beginPath()
        for (var poly of geom) {
            for (var p = 0; p < poly.length-1; p++) {
                let pt = poly[p]
                if (p == 0) ctx.moveTo(pt.x,pt.y)
                else ctx.lineTo(pt.x,pt.y)
            }
        }
        ctx.fill()
    }
}

export function arr(base,a):((z:number)=>number) {
    return z => {
        let b = z - base
        if (b >= 0 && b < a.length) {
            return a[b]
        }
        return 0
    }
}

export function exp(base:number,stops) : ((z:number) => number) {
    return z => {
        if (z <= stops[0][0]) return stops[0][1]
        if (z >= stops[stops.length-1][0]) return stops[stops.length-1][1]
        let idx = 0
        while (stops[idx+1][0] < z) idx++
        let difference = stops[idx+1][0] - stops[idx][0]
        let progress = z-stops[idx][0]
        var factor
        if (difference === 0) factor = 0
        else if (base === 1) factor = progress/difference
        else factor = (Math.pow(base,progress)-1)/(Math.pow(base,difference)-1)
        return factor * (stops[idx+1][1] - stops[idx][1]) + stops[idx][1]
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
    dashWidth:number

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

    public draw(ctx,geom,properties) {
        if (this.skip) return
        ctx.beginPath()
        for (var ls of geom) {
            for (var p = 0; p < ls.length; p++) {
                let pt = ls[p]
                if (p == 0) ctx.moveTo(pt.x,pt.y);
                else ctx.lineTo(pt.x,pt.y);
            }
        }

        if (this.dash) {
            ctx.save()
            ctx.lineWidth = this.dashWidth
            ctx.strokeStyle = this.dashColor
            ctx.setLineDash(this.dash)
            ctx.stroke()
            ctx.restore()
        } else {
            ctx.stroke()
        }
    }
}

export class IconSymbolizer implements LabelSymbolizer {
    sprites: any // FIXME
    name: string

    constructor(options) {
        this.sprites = options.sprites
        this.name = options.name
    } 

    public stash(scratch,geom,feature,zoom) {
        let pt = geom[0]
        let a = new Point(geom[0][0].x,geom[0][0].y)
        let bbox = {
            minX:a.x-32, 
            minY:a.y-32,
            maxX:a.x+32,
            maxY:a.y+32
        }

        let draw = ctx => {
            ctx.globalAlpha = 1
            let r = this.sprites.get(this.name)
            ctx.drawImage(r.canvas,r.x,r.y,r.w,r.h,-8,-8,r.w,r.h)
        }
        return {anchor:a,bbox:bbox,draw:draw}
    }
}

export class CircleSymbolizer implements LabelSymbolizer {
    radius: number
    fill: string
    stroke: string
    width: number

    constructor(options) {
        this.radius = options.radius || 3
        this.fill = options.fill || "black"
        this.stroke = options.stroke || "white"
        this.width = options.width || 0
    } 

    public stash(scratch,geom,feature,zoom) {
        let pt = geom[0]
        let a = new Point(geom[0][0].x,geom[0][0].y)
        let bbox = {
            minX:a.x-20, 
            minY:a.y-20,
            maxX:a.x+20,
            maxY:a.y+20
        }

        let draw = ctx => {
            ctx.globalAlpha = 1

            if (this.width > 0) {
                ctx.fillStyle = this.stroke
                ctx.beginPath()
                ctx.arc(0,0, this.radius + this.width, 0, 2* Math.PI)
                ctx.fill()
            }

            ctx.fillStyle = this.fill
            ctx.beginPath()
            ctx.arc(0,0, this.radius, 0, 2* Math.PI)
            ctx.fill()
        }
        return {anchor:a,bbox:bbox,draw:draw}
    }
}

// export class FlowSymbolizer implements LabelSymbolizer {

// }

const mergeBbox = (b1,b2) => {
    return { 
        minX:Math.min(b1.minX,b2.minX),
        minY:Math.min(b1.minY,b2.minY),
        maxX:Math.max(b1.maxX,b2.maxX),
        maxY:Math.max(b1.maxY,b2.maxY),
    }
}

export class GroupSymbolizer implements LabelSymbolizer {
    list: LabelSymbolizer[]

    constructor(list) {
        this.list = list
    }

    public stash(scratch, geom, feature, zoom):LabelStash | undefined {
        var result = this.list[0].stash(scratch,geom, feature,zoom)
        let anchor = result.anchor
        let bbox = result.bbox
        let draws = [result.draw]

        for (let i = 1; i < this.list.length; i++) {
            result = this.list[i].stash(scratch,geom, feature,zoom)
            if (!result) return null
            bbox = mergeBbox(bbox,result.bbox)
            draws.push(result.draw)
        }
        let draw = ctx => {
            draws.forEach(d => d(ctx))
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
    textTransform: string
    property: string

    constructor(options) {
        this.font = new FontSpec(options)
        this.text = new TextSpec(options)

        this.fill = options.fill 
        this.property = options.property || "name"
        this.stroke = options.stroke || "black"
        this.width = options.width || 0
        this.align = options.align || "center"
        this.offset = options.offset || 0
        this.textTransform = options.textTransform
    }

    public stash(scratch, geom, feature, zoom) {
        if (feature.geomType == GeomType.Point) {
            let a = new Point(geom[0][0].x,geom[0][0].y)
            let font = this.font.str(zoom,feature.properties)
            let property = this.text.str(zoom,feature.properties)
            if (!property) return null
            scratch.font = font
            let metrics = scratch.measureText(property)
            let p = 2 // padding

            let width = metrics.width
            let ascent = metrics.actualBoundingBoxAscent
            let descent = metrics.actualBoundingBoxDescent
            let offset = this.offset

            let bbox = {
                minX:a.x+offset, 
                minY:a.y+(-offset-ascent),
                maxX:a.x+(offset+width),
                maxY:a.y+(-offset+descent)
            }

            // centering
            let textX = 0
            if (this.align == "center") {
                bbox = {
                    minX:a.x-width/2, 
                    minY:a.y-ascent,
                    maxX:a.x+width/2,
                    maxY:a.y+descent
                }
                textX = -width/2
            }

            // inside draw, the origin is the anchor
            let draw = ctx => {
                ctx.globalAlpha = 1
                ctx.font = font

                if (this.width) {
                    ctx.lineWidth = this.width * 2 // centered stroke
                    ctx.strokeStyle = this.stroke
                    ctx.strokeText(property,textX+offset,-offset)
                }

                ctx.fillStyle = this.fill
                ctx.fillText(property,textX+offset,-offset)

            }
            return {anchor:a,bbox:bbox,draw:draw}
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

    public stash(scratch, geom, feature, zoom) {
        let font = this.font.str(zoom,feature.properties)
        let name = this.text.str(zoom,feature.properties)
        if (!name) return null

        let fbbox = feature.bbox
        let area = (fbbox[3] - fbbox[1]) * (fbbox[2]-fbbox[0]) // needs to be based on zoom level
        if (area < 100) return undefined

        scratch.font = this.font
        let metrics = scratch.measureText(name)
        let width = metrics.width

        let result = simpleLabel(geom,width)
        if (!result) return undefined
        let dx = result.end.x - result.start.x
        let dy = result.end.y - result.start.y

        let a = new Point(result.start.x,result.start.y)

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
        let bbox = {minX:a.x+bboxMinX,minY:a.y+bboxMinY,maxX:a.x+bboxMaxX,maxY:a.y+bboxMaxY}

        let draw = ctx => {
            ctx.globalAlpha = 1
            ctx.rotate(Math.atan2(dy, dx))
            if (dx < 0) ctx.scale(0,-1)
            ctx.font = font
            if (this.width > 0) {
                ctx.strokeStyle = this.stroke
                ctx.lineWidth = this.width
                ctx.strokeText(name,0,0)
            }
            ctx.fillStyle = this.fill
            ctx.fillText(name,0,0)
        }

        return {anchor:a,bbox:bbox,draw:draw}
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

    public stash(scratch, geom, feature, zoom) {
        let fbbox = feature.bbox
        let area = (fbbox[3] - fbbox[1]) * (fbbox[2]-fbbox[0]) // TODO needs to be based on zoom level/overzooming
        if (area < 200000) return undefined

        let property = this.text.str(zoom,feature.properties)
        if (!property) return null

        let first_poly = geom[0]
        let found = polylabel([first_poly.map(c => [c.x,c.y])])
        let a = new Point(found[0],found[1])
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
            minX:a.x-width/2, 
            minY:a.y-metrics.actualBoundingBoxAscent,
            maxX:a.x+width/2,
            maxY:a.y+(lineHeight*lines.length-metrics.actualBoundingBoxAscent)
        }

        let fill = this.fill

        let draw = ctx => {
            ctx.globalAlpha = 1

            ctx.font = font

            var y = 0
            for (let line of lines) {
                if (this.width) {
                    ctx.lineWidth = this.width
                    ctx.strokeStyle = this.stroke
                    ctx.strokeText(line,-width/2,y)
                }
                ctx.fillStyle = fill
                ctx.fillText(line,-width/2,y)
                y += lineHeight
            }
        }
        return {anchor:a,bbox:bbox,draw:draw}
    }
}