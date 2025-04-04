# protomaps-leaflet

Vector tile rendering and labeling for [Leaflet](https://github.com/Leaflet/Leaflet).

[![npm](https://img.shields.io/npm/v/protomaps-leaflet)](https://www.npmjs.com/package/protomaps-leaflet)
[![Test suite](https://github.com/protomaps/protomaps-leaflet/actions/workflows/node.js.yml/badge.svg)](https://github.com/protomaps/protomaps-leaflet/actions/workflows/node.js.yml)

<p float="left">
    <img src="benchmark/example_1.png" width="400">
    <img src="benchmark/example_2.png" width="400">
</p>

This project is a complete vector tile renderer - including quality label layout - in as simple as possible of an implementation. It's an alternative to renderers like [MapLibre GL JS](https://maplibre.org) in a fraction of the size.

New projects starting from scratch should probably use MapLibre GL, but this library is useful as a drop-in replacement for raster basemaps in Leaflet, either using the [Protomaps API](https://protomaps.com/dashboard) or PMTiles on your own storage.

### Features

* Render interactive slippy maps with [Leaflet](https://leafletjs.com) integration
* Supports variable web fonts with multiple weights and italics in a single font file
* Can read normal Z/X/Y tile URLs or offline, static-hosted tile archives in [PMTiles format](https://github.com/protomaps/PMTiles)
* Full out-of-the-box support for right-to-left and Indic/Brahmic writing systems
* Configurable via plain JavaScript
* (Advanced) Extensible API for defining your own symbolizers

See the docs on [what protomaps-leaflet is, what protomaps-leaflet is not](https://protomaps.com/docs/protomaps-js#protomapsjs-is-not)

## Demos

* [Simple Leaflet demo](https://protomaps.github.io/protomaps-leaflet/examples/leaflet.html)
* [Satellite + labels demo](https://protomaps.github.io/protomaps-leaflet/examples/labels.html)
* [GeoJSON between basemap and labels demo](https://protomaps.github.io/protomaps-leaflet/examples/sandwich.html)
* [Map inset](https://protomaps.github.io/protomaps-leaflet/examples/inset.html)
* [Custom fonts](https://protomaps.github.io/protomaps-leaflet/examples/fonts.html)

## How to use

```html
<script src="https://unpkg.com/protomaps-leaflet@4.0.1/dist/protomaps-leaflet.js"></script>
<script>
    const map = L.map('map')
    var layer = protomapsL.leafletLayer({url:'FILE.pmtiles OR ENDPOINT/{z}/{x}/{y}.mvt',flavor:"light",lang:"en"})
    layer.addTo(map)
</script>
```

## See Also
* [Tangram](https://github.com/tangrams/tangram)
* [KothicJS](https://github.com/kothic/kothic-js)
* [Leaflet.VectorGrid](https://github.com/Leaflet/Leaflet.VectorGrid)
