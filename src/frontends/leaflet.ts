declare var L: any

import Point from '@mapbox/point-geometry'
import { ZxySource, PmtilesSource, TileCache } from '../tilecache'
import { View } from '../view'
import { painter } from '../painter'
import { Labelers } from '../labeler'
import { light } from '../default_style/light'
import { dark } from '../default_style/dark'
import { paintRules, labelRules } from '../default_style/style'

class CanvasPool {
    unused: any[]
    lang: string

    constructor(lang:string) {
        this.lang = lang
        this.unused = []
    }

    public get(tile_size) {
        if (this.unused.length) {
            let tile = this.unused.shift()
            tile.removed = false
            return tile
        }
        let element = L.DomUtil.create('canvas', 'leaflet-tile')
        element.width = tile_size
        element.height = tile_size
        element.lang = this.lang
        return element
    }

    public put(elem) {
        L.DomUtil.removeClass(elem,'leaflet-tile-loaded')
        this.unused.push(elem)
    }
}

const timer = duration => {
    return new Promise<void>((resolve,reject) => {
        setTimeout(() => {
            resolve()
        },duration)
    })
}

class LeafletLayer extends L.GridLayer {
    constructor(options) {
        if (options.noWrap && !options.bounds) options.bounds = [[-90,-180],[90,180]]
        if (!options.attribution) options.attribution = '<a href="https://protomaps.com">Protomaps</a> © <a href="https://openstreetmap.org/copyright">OpenStreetMap</a>'
        super(options)

        let theme = options.dark ? dark : light
        this.paint_rules = options.paint_rules || paintRules(theme,options.shade)
        this.label_rules = options.label_rules || labelRules(theme,options.shade)
        this.lastRequestedZ = undefined

        let source
        if (options.url.url) {
            source = new PmtilesSource(options.url)
        } else if (options.url.endsWith(".pmtiles")) {
            source = new PmtilesSource(options.url)
        } else {
            source = new ZxySource(options.url)
        }

        this.tasks = options.tasks || []
        let cache = new TileCache(source,1024)
        this.view = new View(cache,14,2)
        this.debug = options.debug
        let scratch = document.createElement('canvas').getContext('2d')
        this.scratch = scratch
        this.onTilesInvalidated = tiles => {
            tiles.forEach(t => {
                this.rerenderTile(t)
            })
        }
        this.labelers = new Labelers(this.scratch, this.label_rules, this.onTilesInvalidated)
        this.tile_size = 256 *window.devicePixelRatio
        this.pool = new CanvasPool(options.lang)
    }

    public setDefaultStyle(dark:boolean) {
        this.paint_rules = (dark ? darkPaintRules : lightPaintRules)
        this.label_rules = (dark ? darkLabelRules : lightLabelRules)
    }

    public async renderTile(coords,element,key,done = ()=>{}) {
        this.lastRequestedZ = coords.z
        var prepared_tile
        try {
            prepared_tile = await this.view.getDisplayTile(coords)
        } catch (e) {
            if (e.name == "AbortError") return
            else throw e
        }

        if (element.key != key) return
        if (this.lastRequestedZ !== coords.z) return

        await Promise.allSettled(this.tasks)

        if (element.key != key) return
        if (this.lastRequestedZ !== coords.z) return

        let layout_time = await this.labelers.add(prepared_tile)

        if (element.key != key) return
        if (this.lastRequestedZ !== coords.z) return

        let label_data = this.labelers.getIndex(prepared_tile.z)

        if (!this._map) return // the layer has been removed from the map

        let center = this._map.getCenter().wrap()
        let pixelBounds = this._getTiledPixelBounds(center),
             tileRange = this._pxBoundsToTileRange(pixelBounds),
             tileCenter = tileRange.getCenter()
        let priority = coords.distanceTo(tileCenter) * 5

        await timer(priority)

        if (element.key != key) return
        if (this.lastRequestedZ !== coords.z) return

        let BUF = 16
        let bbox = {minX:256*coords.x-BUF,minY:256*coords.y-BUF,maxX:256*(coords.x+1)+BUF,maxY:256*(coords.y+1)+BUF}
        let origin = new Point(256*coords.x,256*coords.y)

        let ctx = element.getContext("2d")
        ctx.setTransform(this.tile_size/256,0,0,this.tile_size/256,0,0)
        ctx.clearRect(0,0,256,256)

        let painting_time = painter(ctx,[prepared_tile],label_data,this.paint_rules,bbox,origin,false,this.debug)

        if (this.debug) {
            let data_tile = prepared_tile.data_tile
            ctx.save()
            ctx.fillStyle = this.debug
            ctx.font = '600 12px sans-serif'
            ctx.fillText(coords.z + " " + coords.x + " " + coords.y,4,14)
            ctx.font = '200 12px sans-serif'
            ctx.fillText(data_tile.z + " " + data_tile.x + " " + data_tile.y,4,28)
            ctx.font = '600 10px sans-serif'
            if (painting_time > 8) {
                ctx.fillText(painting_time.toFixed() + " ms paint",4,42)
            }
            if (layout_time > 8) {
                ctx.fillText(layout_time.toFixed() + " ms layout",4,56)
            }
            ctx.strokeStyle = this.debug

            ctx.lineWidth = (coords.x/4 === data_tile.x) ? 1.5 : 0.5
            ctx.beginPath()
            ctx.moveTo(0,0)
            ctx.lineTo(0,256)
            ctx.stroke()

            ctx.lineWidth = (coords.y/4 === data_tile.y) ? 1.5 : 0.5
            ctx.beginPath()
            ctx.moveTo(0,0)
            ctx.lineTo(256,0)
            ctx.stroke()

            ctx.restore()
        }
        done()
    }

    public rerenderTile(key) {
        for (let unwrapped_k in this._tiles) {
            let wrapped_coord = this._wrapCoords(this._keyToTileCoords(unwrapped_k))
            if (key === this._tileCoordsToKey(wrapped_coord)) {
                this.renderTile(wrapped_coord,this._tiles[unwrapped_k].el,key)
            }
        }
    }

    public clearLayout() {
        this.labelers = new Labelers(this.scratch, this.label_rules, this.onTilesInvalidated)
    }

    public rerenderTiles() {
        for (let unwrapped_k in this._tiles) {
            let wrapped_coord = this._wrapCoords(this._keyToTileCoords(unwrapped_k))
            let key = this._tileCoordsToKey(wrapped_coord)
            this.renderTile(wrapped_coord,this._tiles[unwrapped_k].el,key)
        }
    }

    public createTile(coords,showTile) {
        let element = this.pool.get(this.tile_size)
        let key = this._tileCoordsToKey(coords)
        element.key = key

        this.renderTile(coords,element,key,() => {
            showTile(null,element)
        })

        return element
    }

    public _removeTile(key) {
        let tile = this._tiles[key]
        if (!tile) { return }
        tile.el.removed = true
        tile.el.key = undefined
        L.DomUtil.remove(tile.el)
        this.pool.put(tile.el)
        delete this._tiles[key]
        this.fire('tileunload', {
            tile: tile.el,
            coords: this._keyToTileCoords(key)
        })
    }

    public queryFeatures(lng:number,lat:number) {
        return this.view.queryFeatures(lng,lat,this._map.getZoom())
    }
}

const leafletLayer = options => {
    return new LeafletLayer(options)
}

export { leafletLayer, LeafletLayer }