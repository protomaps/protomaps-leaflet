[Demo](https://protomaps.github.io/protomaps.js/examples/leaflet.html) : uses a local PMTiles file

[Worldwide Demo](http://protomaps.com/map/)

A vector map renderer for the web. < 20 KB gzipped.



See the docs on [what protomaps.js, what protomaps.js is not](https://protomaps.com/docs/protomaps-js#protomapsjs-is-not)

## How to use

```html
<script src="https://unpkg.com/protomaps@latest/dist/protomaps.min.js"></script>
<script>
    const map = L.map('map')
    var layer = new protomaps.LeafletLayer({url:'FILE.pmtiles OR ENDPOINT/{z}/{x}/{y}.pbf'})
    layer.addTo(map)
</script>
```

## See Also
* [KothicJS](https://github.com/kothic/kothic-js)
* [Tangram](https://github.com/tangrams/tangram)
