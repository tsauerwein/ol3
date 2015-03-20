/**
 * @const
 * @type {!Array.<number>}
 */
var RESOLUTIONS = [
  4000, 3750, 3500, 3250, 3000, 2750, 2500, 2250, 2000, 1750, 1500, 1250,
  1000, 750, 650, 500, 250, 100, 50, 20, 10, 5, 2.5, 2, 1.5, 1, 0.5
];


/**
 * @const
 * @type {!Array.<string>}
 */
var MATRIX_IDS = RESOLUTIONS.map(function(value, index) {
  return String(index);
});


/**
 * @const
 * @type {ol.Coordinate}
 */
var ORIGIN = [420000, 350000];


/**
 * @const
 * @type {ol.tilegrid.WMTS}
 */
var WMTS_TILE_GRID = new ol.tilegrid.WMTS({
  origin: ORIGIN,
  resolutions: RESOLUTIONS,
  matrixIds: MATRIX_IDS
});

function getSwisstopoSource(layer, timestamp, format) {
  var source = new ol.source.WMTS({
    url: '//wmts{5-9}.geo.admin.ch/1.0.0/{Layer}/default/{Time}' +
        '/21781/{TileMatrix}/{TileRow}/{TileCol}.' + format,
    layer: layer,
    style: 'default',
    format: 'image/' + format,
    matrixSet: '21781',
    requestEncoding: 'REST',
    dimensions: {
      'Time': timestamp
    },
    tileGrid: WMTS_TILE_GRID
  });
  source.set('baseUrl', 'http://wmts.geo.admin.ch/');
  return source;
}

var raster = new ol.layer.Tile({
  visible: true,
  opacity: 0.75,
  source: getSwisstopoSource(
      'ch.swisstopo.pixelkarte-farbe', '20151231', 'jpeg'
  )
});

var source = new ol.source.Vector();

var vector = new ol.layer.Vector({
  source: source,
  style: new ol.style.Style({
    fill: new ol.style.Fill({
      color: 'rgba(255, 255, 255, 0.2)'
    }),
    stroke: new ol.style.Stroke({
      color: '#ffcc33',
      width: 2
    }),
    image: new ol.style.Circle({
      radius: 7,
      fill: new ol.style.Fill({
        color: '#ffcc33'
      })
    })
  })
});

proj4.defs('EPSG:21781',
    '+proj=somerc +lat_0=46.95240555555556 +lon_0=7.439583333333333 ' +
    '+k_0=1 +x_0=600000 +y_0=200000 +ellps=bessel' +
    '+towgs84=674.374,15.056,405.346,0,0,0,0 +units=m +no_defs');
ol.proj.get('EPSG:21781').setExtent([420000, 30000, 900000, 350000]);

var projection = ol.proj.get('EPSG:21781');
var extent = projection.getExtent();
var resolutions = [650, 500, 250, 100, 50, 20, 10, 5, 2.5, 2, 1.5, 1];

var map = new ol.Map({
  renderer: exampleNS.getRendererFromQueryString(),
  layers: [raster, vector],
  target: 'map',
  view: new ol.View({
    enableRotation: false,
    center: [650000, 130000],
    projection: projection,
    resolution: 20,
    resolutions: resolutions
  })
});

var drawInteraction = new ol.interaction.DrawTrack();
map.addInteraction(drawInteraction);

$('#remove-last-point').click(function(e) {
  drawInteraction.removeLastPoint();
});

$('#map').keypress(function(e) {
  // to listen on `keypress` the map div must have a
  // `tabindex="1"` attribute
  if (e.which === 127) {
    // remove last point when pressing DEL
    drawInteraction.removeLastPoint();
  }
});

drawInteraction.on('trackchanged', function(evt) {
  $('#remove-last-point').prop('disabled', !drawInteraction.hasPoints());
});
