// set up the MapBox GL JS map
// this is the access token from the API docu:
mapboxgl.accessToken =
    'pk.eyJ1Ijoic29uZW5idWVyZyIsImEiOiJrUHlXQnI4In0.Dzw9SCFJL39Uab-gG9ymgQ';
var glMap = new mapboxgl.Map({
  container: 'gl-map',
  style: 'data/outdoors-v4.json',
  center: [0, 0],
  zoom: 3,
  // deactivate the listeners, so that we are using the ol listeners
  interactive: false
});


var view = new ol.View({});
view.on('change:center', function() {
  var center = ol.proj.transform(view.getCenter(), 'EPSG:3857', 'EPSG:4326');
  glMap.setView([center[1], center[0]], glMap.getZoom(), glMap.getBearing());
});
view.on('change:resolution', function() {
  // sync the zoom-level (-1)
  glMap.zoomTo(view.getZoom() - 1);
});
view.on('change:rotation', function() {
  // sync the rotation (convert from radians to degree)
  glMap.setBearing(-view.getRotation() * 180 / Math.PI);
});

var vector = new ol.layer.Vector({
  source: new ol.source.GeoJSON({
    url: 'data/geojson/countries.geojson',
    projection: 'EPSG:3857'
  }),
  style: new ol.style.Style({
    fill: new ol.style.Fill({
      color: 'rgba(255, 255, 255, 0.1)'
    }),
    stroke: new ol.style.Stroke({
      color: '#319FD3',
      width: 1
    })
  })
});

var olMapDiv = document.getElementById('ol-map');
var map = new ol.Map({
  layers: [vector],
  interactions: ol.interaction.defaults({
    dragPan: false
  }).extend([
    new ol.interaction.DragPan({kinetic: null})
  ]),
  target: olMapDiv,
  view: view
});
view.setCenter([0, 0]);
view.setZoom(4);
view.setRotation(45);
