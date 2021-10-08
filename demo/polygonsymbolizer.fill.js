window.demoDescription = "Basic polygon symbolizer fill.";

map.setView(new L.LatLng(25.0412,121.5177),16);

(function() {
    var PAINT_RULES = [
        {
            dataLayer: "landuse",
            symbolizer: new protomaps.PolygonSymbolizer({fill:"red"})
        }
    ]

    var layer = protomaps.leafletLayer({
        url:'https://api.protomaps.com/tiles/v2/{z}/{x}/{y}.pbf?key=' + DEMO_KEY, 
        paint_rules:PAINT_RULES,
        label_rules:[]
    });
    layer.addTo(map);
})();
