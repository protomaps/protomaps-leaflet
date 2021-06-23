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

export function numberFn(obj) {
    if (!obj) return obj
    if (typeof obj == "number") {
        return obj
    } 
    if (obj.base && obj.stops) {
        return exp(obj.base,obj.stops)
    } else if (obj[0] == 'interpolate' && obj[1][0] == "exponential" && obj[2] == "zoom") {
        let slice = obj.slice(3)
        let stops = []
        for (var i = 0; i < slice.length; i+=2) {
            stops.push([slice[i],slice[i+1]])
        }
        return exp(obj[1][1],stops)
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

export function getFont(obj,mapping = {}) {
    let fontfaces = []
    for (let wanted_face of obj['text-font']) {
        if (mapping.hasOwnProperty(wanted_face)) {
            fontfaces.push(mapping[wanted_face])
        }
    }
    if (fontfaces.length === 0) fontfaces.push('sans-serif')

    let text_size = obj['text-size']
    if (typeof text_size == 'number') {
        return `${text_size}px ${fontfaces.join(', ')}`
    } else if (text_size.stops) {
        var base = 1.4
        if(text_size.base) base = text_size.base
        return z => {
            let t = numberFn(text_size)
            return `${t(z)}px ${fontfaces.join(', ')}`
        }
    } else if (text_size[0] == 'step') {
        return (z,p) => {
            let t = numberFn(text_size)
            return `${t(z,p)}px ${fontfaces.join(', ')}`
        }
    } else {
        console.log("Can't parse font: ", obj)
    }
}

export function json_style(obj) {
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
            if (layer.paint['line-dasharray']) {
                console.log(layer.paint)
                paint_rules.push({
                    dataLayer: layer['source-layer'],
                    filter:filter,
                    symbolizer: new LineSymbolizer({
                        width:numberFn(layer.paint["line-width"]),
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
                        width:numberFn(layer.paint["line-width"])
                    })
                })

            }
        } else if (layer.type == "symbol") {
            if (layer.layout["symbol-placement"] == "line") {
                label_rules.push({
                    dataLayer: layer['source-layer'],
                    filter:filter,
                    symbolizer: new LineLabelSymbolizer({
                        fill:layer.paint['text-color'],
                        width:layer.paint['text-halo-width'],
                        stroke:layer.paint['text-halo-color']
                    })
                })
            } else {
                label_rules.push({
                    dataLayer: layer['source-layer'],
                    filter:filter,
                    symbolizer: new TextSymbolizer({
                        font: getFont(layer.layout),
                        fill: layer.paint['text-color'],
                        stroke: layer.paint['text-halo-color'],
                        width:layer.paint['text-halo-width']
                    })
                })
            }
        }
    }

    return {paint_rules:paint_rules,label_rules:label_rules,tasks:[]}
}