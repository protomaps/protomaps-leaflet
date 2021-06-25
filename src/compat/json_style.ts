import { PolygonSymbolizer, LineSymbolizer, LineLabelSymbolizer, TextSymbolizer, exp } from './../symbolizer'

export function filterFn(arr) {
    // hack around "$type"
    if (arr.includes("$type")) {
        return f => true 
    } else if (arr[0] == "==") {
        return f => f[arr[1]] === arr[2]
    } else if (arr[0] == "!=") {
        return f => f[arr[1]] !== arr[2]
    } else if (arr[0] === "<") {
        return f => f[arr[1]] < arr[2]
    } else if (arr[0] === ">") {
        return f => f[arr[1]] > arr[2]
    } else if (arr[0] === "in") {
        return f => arr.slice(2,arr.length).includes(f[arr[1]])
    } else if (arr[0] === "!in") {
        return f => !arr.slice(2,arr.length).includes(f[arr[1]])
    } else if (arr[0] === "has") {
        return f => f.hasOwnProperty(arr[1])
    } else if (arr[0] === "all") {
        let parts = arr.slice(1,arr.length).map(e => filterFn(e))
        return f => parts.every(p => { return p(f)})
    } else if (arr[0] === "any") {
        let parts = arr.slice(1,arr.length).map(e => filterFn(e))
        return f => parts.some(p => { return p(f) })
    } else {
        console.log("Unimplemented filter: ",arr[0])
    }
}

export function numberFn(obj,defu = 0) {
    if (!obj) return defu
    if (typeof obj == "number") {
        return obj
    } 
    if (obj.base && obj.stops) {
        return z => { return exp(obj.base,obj.stops)(z-1) }
    } else if (obj[0] == 'interpolate' && obj[1][0] == "exponential" && obj[2] == "zoom") {
        let slice = obj.slice(3)
        let stops = []
        for (var i = 0; i < slice.length; i+=2) {
            stops.push([slice[i],slice[i+1]])
        }
        return z => { return exp(obj[1][1],stops)(z-1) }
    } else if (obj[0] == 'step' && obj[1][0] == 'get') {
        let slice = obj.slice(2)
        let prop = obj[1][1]
        return (z,props) => {
            let val = props[prop]
            if (val < slice[1]) return slice[0]
            for (i = 1; i < slice.length; i+=2) {
                if (val <= slice[i]) return slice[i+1]
            }
            return slice[slice.length-1]
        }
    } else {
        console.log("Unimplemented numeric fn: ", obj)
    }
}

export function widthFn(width_obj,gap_obj) {
    let w = numberFn(width_obj,1)
    let g = numberFn(gap_obj)
    return (z) => {
        let tmp = (typeof(w) == "number" ? w : w(z))
        if (g) {
            return tmp + (typeof(g) == "number" ? g : g(z))
        }
        return tmp
    }
}

interface FontSub {
    face: string
    weight: number
    style: string
}

// for fallbacks, use the weight and style of the first font
export function getFont(obj,fontsubmap:Map<string,FontSub>) {
    let fontfaces = []
    for (let wanted_face of obj['text-font']) {
        if (fontsubmap.hasOwnProperty(wanted_face)) {
            fontfaces.push(fontsubmap[wanted_face])
        }
    }
    if (fontfaces.length === 0) fontfaces.push({face:'sans-serif'})

    let text_size = obj['text-size']
    if (typeof text_size == 'number') {
        return `${text_size}px ${fontfaces.map(f => f.face).join(', ')}`
    } else if (text_size.stops) {
        var base = 1.4
        if(text_size.base) base = text_size.base
        return z => {
            let t = numberFn(text_size)
            return `${t(z)}px ${fontfaces.map(f => f.face).join(', ')}`
        }
    } else if (text_size[0] == 'step') {
        return (z,p) => {
            let t = numberFn(text_size)
            return `${t(z,p)}px ${fontfaces.map(f => f.face).join(', ')}`
        }
    } else {
        console.log("Can't parse font: ", obj)
    }
}

export function json_style(obj,fontsubmap:Map<string,FontSub>) {
    let paint_rules = []
    let label_rules = []
    let refs = new Map<string,any>()

    for (var layer of obj.layers) {
        refs.set(layer.id,layer)

        if (layer.layout && layer.layout.visibility == "none") {
            continue
        }

        if (layer.ref) {
           let referenced = refs.get(layer.ref)
           layer.type = referenced.type
           layer.filter = referenced.filter
           layer.source = referenced['source']
           layer['source-layer'] = referenced['source-layer']
        }

        let sourceLayer = layer['source-layer']
        var symbolizer

        var filter = undefined
        if (layer.filter) {
            filter = filterFn(layer.filter)
        }

        // ignore background-color?
        if (layer.type == "fill") {
            paint_rules.push({
                dataLayer: layer['source-layer'],
                filter:filter,
                symbolizer: new PolygonSymbolizer({
                    fill:layer.paint['fill-color'],
                    opacity:layer.paint['fill-opacity']
                })
            })
        } else if (layer.type == "fill-extrusion") {
            // simulate fill-extrusion with plain fill
            paint_rules.push({
                dataLayer: layer['source-layer'],
                filter:filter,
                symbolizer: new PolygonSymbolizer({
                    fill:layer.paint['fill-extrusion-color'],
                    opacity:layer.paint['fill-extrusion-opacity']
                })
            })
        } else if (layer.type == "line") {
            // simulate gap-width
            if (layer.paint['line-dasharray']) {
                paint_rules.push({
                    dataLayer: layer['source-layer'],
                    filter:filter,
                    symbolizer: new LineSymbolizer({
                        width:widthFn(layer.paint["line-width"],layer.paint["line-gap-width"]),
                        dash:layer.paint['line-dasharray'],
                        dashColor:layer.paint['line-color']
                    })
                })
            } else {
                paint_rules.push({
                    dataLayer: layer['source-layer'],
                    filter:filter,
                    symbolizer: new LineSymbolizer({
                        color:layer.paint['line-color'],
                        width:widthFn(layer.paint["line-width"],layer.paint["line-gap-width"])
                    })
                })

            }
        } else if (layer.type == "symbol") {
            if (layer.layout["symbol-placement"] == "line") {
                label_rules.push({
                    dataLayer: layer['source-layer'],
                    filter:filter,
                    symbolizer: new LineLabelSymbolizer({
                        font: getFont(layer.layout,fontsubmap),
                        fill:layer.paint['text-color'],
                        width:layer.paint['text-halo-width'],
                        stroke:layer.paint['text-halo-color'],
                        textTransform:layer.layout["text-transform"]
                    })
                })
            } else {
                label_rules.push({
                    dataLayer: layer['source-layer'],
                    filter:filter,
                    symbolizer: new TextSymbolizer({
                        font: getFont(layer.layout,fontsubmap),
                        fill: layer.paint['text-color'],
                        stroke: layer.paint['text-halo-color'],
                        width:layer.paint['text-halo-width'],
                        textTransform:layer.layout["text-transform"]
                    })
                })
            }
        }
    }

    label_rules.reverse()
    return {paint_rules:paint_rules,label_rules:label_rules,tasks:[]}
}