# protomaps-leaflet

Vector tile rendering and labeling for [Leaflet](https://github.com/Leaflet/Leaflet).

[![npm](https://img.shields.io/npm/v/protomaps-leaflet)](https://www.npmjs.com/package/protomaps-leaflet)
[![Test suite](https://github.com/protomaps/protomaps-leaflet/actions/workflows/node.js.yml/badge.svg)](https://github.com/protomaps/protomaps-leaflet/actions/workflows/node.js.yml)
[![minzipped size](https://img.shields.io/bundlephobia/minzip/protomaps-leaflet)](https://bundlephobia.com/package/protomaps-leaflet)

<p float="left">
    <img src="benchmark/example_1.png" width="400">
    <img src="benchmark/example_2.png" width="400">
</p>

This project is a complete web map renderer - including quality label layout, pattern fills, and icons - in as simple as possible of an implementation. It's an alternative to renderers like [MapLibre GL JS](https://maplibre.org) in a fraction of the size.

### Features

* Render interactive slippy maps with [Leaflet](https://leafletjs.com) integration
* Supports variable web fonts with multiple weights and italics in a single font file
* Can read normal Z/X/Y tile URLs or offline, static-hosted tile archives in [PMTiles format](github.com/protomaps/PMTiles)
* Full out-of-the-box support for right-to-left and Indic/Brahmic writing systems
* Configurable via plain JavaScript
* Extensible API for defining your own symbolizers

See the docs on [what protomaps-leaflet is, what protomaps-leaflet is not](https://protomaps.com/docs/protomaps-js#protomapsjs-is-not)

## Demos

* [Simple Leaflet demo](https://protomaps.github.io/protomaps-leaflet/examples/leaflet.html)
* ["Toner" black-and-white style](https://protomaps.github.io/protomaps-leaflet/examples/toner.html)
* [Multi-language customization](https://protomaps.github.io/protomaps-leaflet/examples/multi_language.html)
* [Satellite + labels demo](https://protomaps.github.io/protomaps-leaflet/examples/labels.html)
* [GeoJSON between basemap and labels demo](https://protomaps.github.io/protomaps-leaflet/examples/sandwich.html)
* [Map inset](https://protomaps.github.io/protomaps-leaflet/examples/inset.html)
* [PostGIS](https://protomaps.github.io/protomaps-leaflet/examples/postgis.html)
* [Custom fonts](https://protomaps.github.io/protomaps-leaflet/examples/fonts.html)

## How to use

```html
<script src="https://unpkg.com/protomaps-leaflet@latest/dist/protomaps-leaflet.min.js"></script>
<script>
    const map = L.map('map')
    var layer = protomapsL.leafletLayer({url:'FILE.pmtiles OR ENDPOINT/{z}/{x}/{y}.pbf'})
    layer.addTo(map)
</script>
```

Exports of OpenStreetMap data in PMTiles format can be obtained from [https://protomaps.com/bundles](https://protomaps.com/bundles).

## Project Status

The design is still evolving rapidly, so do not expect any kind of stable internal or external-facing API between minor versions. But please do report bugs and discuss requirements in the Issues.

## See Also
* [KothicJS](https://github.com/kothic/kothic-js)
* [Tangram](https://github.com/tangrams/tangram)
