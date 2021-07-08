[![Test suite](https://github.com/protomaps/protomaps.js/actions/workflows/node.js.yml/badge.svg)](https://github.com/protomaps/protomaps.js/actions/workflows/node.js.yml)
[![minzipped size](https://badgen.net/bundlephobia/minzip/protomaps)](https://bundlephobia.com/package/protomaps)

A vector map renderer for the web.

* [Simple Leaflet demo](https://protomaps.github.io/protomaps.js/examples/leaflet.html)
* [Satellite + labels demo](https://protomaps.github.io/protomaps.js/examples/labels.html)
* [GeoJSON between basemap and labels demo](https://protomaps.github.io/protomaps.js/examples/sandwich.html)
* [JSON style](https://protomaps.github.io/protomaps.js/examples/json_style.html)

Above examples use a local PMTiles file and do not need an API key.

[Worldwide Demo](http://protomaps.com/map/)

See the docs on [what protomaps.js is, what protomaps.js is not](https://protomaps.com/docs/protomaps-js#protomapsjs-is-not)

## How to use

```html
<script src="https://unpkg.com/protomaps@latest/dist/protomaps.min.js"></script>
<script>
    const map = L.map('map')
    var layer = protomaps.leafletLayer({url:'FILE.pmtiles OR ENDPOINT/{z}/{x}/{y}.pbf'})
    layer.addTo(map)
</script>
```

Exports of OpenStreetMap data in PMTiles format can be obtained from [https://protomaps.com/bundles](https://protomaps.com/bundles).

## Project Status

The design is still evolving rapidly, so do not expect any kind of stable internal or external-facing API. But please do report bugs and discuss requirements in the Issues.

## See Also
* [KothicJS](https://github.com/kothic/kothic-js)
* [Tangram](https://github.com/tangrams/tangram)
