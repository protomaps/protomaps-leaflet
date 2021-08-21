// @ts-ignore
import Point from '@mapbox/point-geometry'
import { GeomType, Feature, Bbox } from './tilecache'
// @ts-ignore
import polylabel from 'polylabel'
import { TextSpec, FontSpec, linebreak, isCjk } from './text'
import { lineCells, simpleLabel } from './line'
import { Index, Label, Layout } from './labeler'

export interface PaintSymbolizer {
    before?(ctx:any,z:number):void
    draw(ctx:any,geom:Point[][],properties:any):void
}

export interface LabelSymbolizer {
    /* the symbolizer can, but does not need to, inspect index to determine the right position
     * if return undefined, no label is added
     * return a label, but if the label collides it is not added
     */
    place(layout:Layout,geom:Point[][],feature:Feature):Label[] | undefined
}

export const createPattern = (width:number,height:number, fn:((canvas:any,ctx:any)=>void)) => {
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

    constructor(options:any) {
        this.fill = options.fill || "#000000"
        this.opacity = options.opacity || 1
        this.pattern = options.pattern

    }

    public before(ctx:any) {
        if (this.pattern) {
            ctx.fillStyle = ctx.createPattern(this.pattern, 'repeat')
        } else {
            ctx.fillStyle = this.fill
        }
        ctx.globalAlpha = this.opacity
        // ctx.imageSmoothingEnabled = false // broken on safari
    }

    public draw(ctx:any,geom:Point[][],properties:any) {
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

export function arr(base:number,a:number[]):((z:number)=>number) {
    return z => {
        let b = z - base
        if (b >= 0 && b < a.length) {
            return a[b]
        }
        return 0
    }
}

export function exp(base:number,stops:number[][]) : ((z:number) => number) {
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

function isFunction(obj:any) {
  return !!(obj && obj.constructor && obj.call && obj.apply);
}

export class LineSymbolizer implements PaintSymbolizer {
    color:string
    width:any
    opacity:number
    skip:boolean
    dash:any
    dashColor:string
    dashWidth:number

    constructor(options:any) {
        this.color = options.color || "#000000"
        this.width = options.width || 1
        this.opacity = options.opacity || 1
        this.skip = false
        this.dash = options.dash
        this.dashColor = options.dashColor || "black"
        this.dashWidth = options.dashWidth || 1
    } 

    public before(ctx:any,z:number) {
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

    public draw(ctx:any,geom:Point[][],properties:any) {
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

    constructor(options:any) {
        this.sprites = options.sprites
        this.name = options.name
    } 

    public place(layout:Layout,geom:Point[][],feature:any) {
        let pt = geom[0]
        let a = new Point(geom[0][0].x,geom[0][0].y)
        let bbox = {
            minX:a.x-32, 
            minY:a.y-32,
            maxX:a.x+32,
            maxY:a.y+32
        }

        let draw = (ctx:any) => {
            ctx.globalAlpha = 1
            let r = this.sprites.get(this.name)
            ctx.drawImage(r.canvas,r.x,r.y,r.w,r.h,-8,-8,r.w,r.h)
        }
        return [{anchor:a,bboxes:[bbox],draw:draw}]
    }
}

export class CircleSymbolizer implements LabelSymbolizer {
    radius: number
    fill: string
    stroke: string
    width: number

    constructor(options:any) {
        this.radius = options.radius || 3
        this.fill = options.fill || "black"
        this.stroke = options.stroke || "white"
        this.width = options.width || 0
    } 

    public place(layout:Layout,geom:Point[][],feature:any) {
        let pt = geom[0]
        let a = new Point(geom[0][0].x,geom[0][0].y)
        let bbox = {
            minX:a.x-this.radius, 
            minY:a.y-this.radius,
            maxX:a.x+this.radius,
            maxY:a.y+this.radius
        }

        let draw = (ctx:any) => {
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
        return [{anchor:a,bboxes:[bbox],draw:draw}]
    }
}

export class ShieldSymbolizer implements LabelSymbolizer {
    font: FontSpec
    text: TextSpec
    background:string
    fill: string
    stroke: string
    padding: number

    constructor(options:any) {
        this.font = new FontSpec(options)
        this.text = new TextSpec(options)
        this.fill = options.fill || "black"
        this.stroke = options.stroke || "white"
        this.background = options.background || "white"
        this.padding = options.padding || 0
    } 

    public place(layout:Layout,geom:Point[][],feature:any) {
        let property = this.text.str(layout.zoom,feature.properties)
        if (!property) return undefined
        let font = this.font.str(layout.zoom,feature.properties)
        layout.scratch.font = font
        let metrics = layout.scratch.measureText(property)

        let width = metrics.width
        let ascent = metrics.actualBoundingBoxAscent
        let descent = metrics.actualBoundingBoxDescent

        let pt = geom[0]
        let a = new Point(geom[0][0].x,geom[0][0].y)
        let p = this.padding
        let bbox = {
            minX:a.x-width/2-p, 
            minY:a.y-ascent-p,
            maxX:a.x+width/2+p,
            maxY:a.y+descent+p
        }

        let draw = (ctx:any) => {
            ctx.globalAlpha = 1
            ctx.fillStyle = this.background
            ctx.fillRect(-width/2-p,-ascent-p,width+2*p,ascent+descent+2*p)
            ctx.fillStyle = this.fill
            ctx.font = font
            ctx.fillText(property,-width/2,0)
        }
        return [{anchor:a,bboxes:[bbox],draw:draw}]
    }
}

// TODO make me work with multiple anchors
export class FlexSymbolizer implements LabelSymbolizer {
    list: LabelSymbolizer[]

    constructor(list:LabelSymbolizer[], options:any) {
        this.list = list
    }

    public place(layout:Layout,geom:Point[][],feature:any) {
        var labels = this.list[0].place(layout,geom,feature)
        if (!labels) return undefined
        var label = labels[0]
        let anchor = label.anchor
        let bbox = label.bboxes[0]
        let height = bbox.maxY - bbox.minY
        let draws = [{draw:label.draw,translate:{x:0,y:0}}]

        let newGeom = [[{x:geom[0][0].x,y:geom[0][0].y+height}]]
        for (let i = 1; i < this.list.length; i++) {
            labels = this.list[i].place(layout,newGeom,feature)
            if (labels) {
                label = labels[0]
                bbox = mergeBbox(bbox,label.bboxes[0])
                draws.push({draw:label.draw,translate:{x:0,y:height}})
            }
        }

        let draw = (ctx:any) => {
            for (let sub of draws) {
                ctx.save()
                ctx.translate(sub.translate.x,sub.translate.y)
                sub.draw(ctx)
                ctx.restore()
            }
        }

        return [{anchor:anchor,bboxes:[bbox],draw:draw}]
    }
}

const mergeBbox = (b1:Bbox,b2:Bbox) => {
    return { 
        minX:Math.min(b1.minX,b2.minX),
        minY:Math.min(b1.minY,b2.minY),
        maxX:Math.max(b1.maxX,b2.maxX),
        maxY:Math.max(b1.maxY,b2.maxY),
    }
}

export class GroupSymbolizer implements LabelSymbolizer {
    list: LabelSymbolizer[]

    constructor(list:LabelSymbolizer[]) {
        this.list = list
    }

    public place(layout:Layout,geom:Point[][],feature:any) {
        let first = this.list[0]
        if (!first) return undefined
        var labels = first.place(layout,geom,feature)
        if (!labels) return undefined
        var label = labels[0]
        let anchor = label.anchor
        let bbox = label.bboxes[0]
        let draws = [label.draw]

        for (let i = 1; i < this.list.length; i++) {
            labels = this.list[i].place(layout,geom,feature)
            if (!labels) return undefined
            label = labels[0]
            bbox = mergeBbox(bbox,label.bboxes[0])
            draws.push(label.draw)
        }
        let draw = (ctx:any) => {
            draws.forEach(d => d(ctx))
        }

        return [{anchor:anchor,bboxes:[bbox],draw:draw}]
    }
}

export class CenteredTextSymbolizer implements LabelSymbolizer {
    font: FontSpec
    text: TextSpec
    fill: string
    stroke: number
    width: number

    constructor(options:any) {
        this.font = new FontSpec(options)
        this.text = new TextSpec(options)

        this.fill = options.fill 
        this.stroke = options.stroke || "black"
        this.width = options.width || 0
    }

    public place(layout:Layout,geom:Point[][],feature:any) {
        if (feature.geomType !== GeomType.Point) return undefined
        let property = this.text.str(layout.zoom,feature.properties)
        if (!property) return undefined
        let font = this.font.str(layout.zoom,feature.properties)
        layout.scratch.font = font
        let metrics = layout.scratch.measureText(property)

        let width = metrics.width
        let ascent = metrics.actualBoundingBoxAscent
        let descent = metrics.actualBoundingBoxDescent

        let a = new Point(geom[0][0].x,geom[0][0].y)
        let bbox = {
            minX:a.x-width/2, 
            minY:a.y-ascent,
            maxX:a.x+width/2,
            maxY:a.y+descent
        }
        let textX = -width/2

        // inside draw, the origin is the anchor
        let draw = (ctx:any) => {
            ctx.globalAlpha = 1
            ctx.font = font

            if (this.width) {
                ctx.lineWidth = this.width * 2 // centered stroke
                ctx.strokeStyle = this.stroke
                ctx.strokeText(property,textX,0)
            }

            ctx.fillStyle = this.fill
            ctx.fillText(property,textX,0)

        }
        return [{anchor:a,bboxes:[bbox],draw:draw}]
    }
}

export class OffsetTextSymbolizer implements LabelSymbolizer {
    font: FontSpec
    text: TextSpec
    fill: string
    stroke: number
    width: number
    offset: number

    constructor(options:any) {
        this.font = new FontSpec(options)
        this.text = new TextSpec(options)

        this.fill = options.fill 
        this.stroke = options.stroke || "black"
        this.width = options.width || 0
        this.offset = options.offset || 0
    }

    public place(layout:Layout,geom:Point[][],feature:any) {
        if (feature.geomType !== GeomType.Point) return undefined
        let property = this.text.str(layout.zoom,feature.properties)
        if (!property) return undefined
        let font = this.font.str(layout.zoom,feature.properties)
        layout.scratch.font = font
        let metrics = layout.scratch.measureText(property)

        let width = metrics.width
        let ascent = metrics.actualBoundingBoxAscent
        let descent = metrics.actualBoundingBoxDescent

        let a = new Point(geom[0][0].x,geom[0][0].y)
        let offset = this.offset

        var text_origin = new Point(offset,-offset)

        let draw = (ctx:any) => {
            ctx.globalAlpha = 1
            ctx.font = font
            if (this.width) {
                ctx.lineWidth = this.width * 2 // centered stroke
                ctx.strokeStyle = this.stroke
                ctx.strokeText(property,text_origin.x,text_origin.y)
            }
            ctx.fillStyle = this.fill
            ctx.fillText(property,text_origin.x,text_origin.y)
        }

        // test candidates
        var bbox = {
            minX:a.x+text_origin.x, 
            minY:a.y-ascent+text_origin.y,
            maxX:a.x+width+text_origin.x,
            maxY:a.y+descent+text_origin.y
        }
        if (!layout.index.bboxCollides(bbox,layout.order)) return [{anchor:a,bboxes:[bbox],draw:draw}]

        text_origin = new Point(-width-offset,-offset)
        bbox = {
            minX:a.x+text_origin.x, 
            minY:a.y-ascent+text_origin.y,
            maxX:a.x+width+text_origin.x,
            maxY:a.y+descent+text_origin.y
        }
        if (!layout.index.bboxCollides(bbox,layout.order)) return [{anchor:a,bboxes:[bbox],draw:draw}]

        return undefined
    }
}

export class LineLabelSymbolizer implements LabelSymbolizer {
    font: FontSpec
    text: TextSpec

    fill: string
    stroke: string
    width: number
    offset: number

    constructor(options:any) {
        this.font = new FontSpec(options)
        this.text = new TextSpec(options)

        this.fill = options.fill || "black"
        this.stroke = options.stroke || "black"
        this.width = options.width || 0
        this.offset = options.offset || 0
    } 

    public place(layout:Layout,geom:Point[][],feature:any) {
        let name = this.text.str(layout.zoom,feature.properties)
        if (!name) return undefined
        if (name.length > 20) return undefined

        let fbbox = feature.bbox
        let area = (fbbox.maxY - fbbox.minY) * (fbbox.maxX-fbbox.minX) // TODO needs to be based on zoom level
        if (area < 400) return undefined

        let font = this.font.str(layout.zoom,feature.properties)
        layout.scratch.font = font
        let metrics = layout.scratch.measureText(name)
        let width = metrics.width

        let result = simpleLabel(geom,width)
        if (!result) return undefined
        let dx = result.end.x - result.start.x
        let dy = result.end.y - result.start.y

        let Q = 8
        let cells = lineCells(result.start,result.end,width,8)
        let bboxes = cells.map(c => {
            return {
            minX:c.x-Q,
            minY:c.y-Q,
            maxX:c.x+Q,
            maxY:c.y+Q
        }})

        let draw = (ctx:any) => {
            ctx.globalAlpha = 1
            // ctx.beginPath()
            // ctx.moveTo(0,0)
            // ctx.lineTo(dx,dy)
            // ctx.strokeStyle = "red"
            // ctx.stroke()
            ctx.rotate(Math.atan2(dy, dx))
            if (dx < 0) {
                ctx.scale(-1,-1)
                ctx.translate(-width,0)
            }
            ctx.translate(0,-this.offset)
            ctx.font = font
            if (this.width) {
                ctx.lineWidth = this.width
                ctx.strokeStyle = this.stroke
                ctx.strokeText(name,0,0)
            }
            ctx.fillStyle = this.fill
            ctx.fillText(name,0,0)
        }

        return [{anchor:result.start,bboxes:bboxes,draw:draw}]
    }
}

export class PolygonLabelSymbolizer implements LabelSymbolizer {
    font:FontSpec
    text:TextSpec
    fill:string
    stroke: string
    width: number

    constructor(options:any) {
        this.font = new FontSpec(options)
        this.text = new TextSpec(options)

        this.fill = options.fill || "black"
        this.stroke = options.stroke || "black"
        this.width = options.width || 0
    }

    public place(layout:Layout,geom:Point[][],feature:any) {
        let fbbox = feature.bbox
        let area = (fbbox.maxY - fbbox.minY) * (fbbox.maxX-fbbox.minX) // TODO needs to be based on zoom level/overzooming
        if (area < 20000) return undefined

        let property = this.text.str(layout.zoom,feature.properties)
        if (!property) return undefined

        let first_poly = geom[0]
        let found = polylabel([first_poly.map(c => [c.x,c.y])])
        let a = new Point(found[0],found[1])
        let font = this.font.str(layout.zoom,feature.properties)

        layout.scratch.font = font

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

        let metrics = layout.scratch.measureText(longestLine)
        let width = metrics.width
        let bbox = {
            minX:a.x-width/2, 
            minY:a.y-metrics.actualBoundingBoxAscent,
            maxX:a.x+width/2,
            maxY:a.y+(lineHeight*lines.length-metrics.actualBoundingBoxAscent)
        }

        let fill = this.fill

        let draw = (ctx:any) => {
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
        return [{anchor:a,bboxes:[bbox],draw:draw}]
    }
}