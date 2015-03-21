goog.require('ol.Map');
goog.require('ol.View');
goog.require('ol.format.TopoJSON');
goog.require('ol.layer.Vector');
goog.require('ol.proj');
goog.require('ol.source.ProtobufVectorTile');
goog.require('ol.style.Fill');
goog.require('ol.style.Stroke');
goog.require('ol.style.Style');
goog.require('ol.tilegrid.XYZ');
goog.require('ol.layer.Tile');
goog.require('ol.source.OSM');

var layer = new ol.layer.Vector({
  source: new ol.source.ProtobufVectorTile({
    projection: 'EPSG:3857',
    tileGrid: new ol.tilegrid.XYZ({
      maxZoom: 19,
      // see https://github.com/mapbox/mapbox-gl-js/blob/
      // c2211cdd086fc79392b9585d78b650ad1c0c5775/js/source/vector_tile_source.js#L14
      tileSize: 512
    }),
    url: 'https://{a-c}.tiles.mapbox.com/v4/mapbox.mapbox-streets-v6-dev' +
      '/{z}/{x}/{y}.vector.pbf?' +
      'access_token=pk.eyJ1IjoibWFwYm94IiwiYSI6IlhHVkZmaW8ifQ.hAMX5hSW-QnTeRCMAy9A8Q'
  }),
  // style: new ol.style.Style({
  //   fill: new ol.style.Fill({
  //     color: '#9db9e8'
  //   })
  // })
});

var map = new ol.Map({
  layers: [new ol.layer.Tile({source: new ol.source.OSM()}), layer],
  renderer: 'canvas',
  target: document.getElementById('map'),
  view: new ol.View({
    center: ol.proj.transform([-74.0064, 40.7142], 'EPSG:4326', 'EPSG:3857'),
    maxZoom: 19,
    zoom: 4
  })
});

