window.demoDescription = "A simple basemap displayed as a Leaflet layer.";

map.setView(new L.LatLng(25.0412,121.5177),16);

(function() {
    var layer = protomaps.leafletLayer({
        url:'https://api.protomaps.com/tiles/v2/{z}/{x}/{y}.pbf?key='+DEMO_KEY
    })
    layer.addTo(map)
})();
