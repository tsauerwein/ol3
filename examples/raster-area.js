goog.require('ol.Map');
goog.require('ol.View');
goog.require('ol.control');
goog.require('ol.layer.Tile');
goog.require('ol.source.Vector');
goog.require('ol.source.TileWMS');
goog.require('ol.source.ImageStatic');
goog.require('ol.format.GeoJSON');
goog.require('ol.source.OSM');

proj4.defs('EPSG:21781',
    '+proj=somerc +lat_0=46.95240555555556 +lon_0=7.439583333333333 ' +
    '+k_0=1 +x_0=600000 +y_0=200000 +ellps=bessel' +
    '+towgs84=674.374,15.056,405.346,0,0,0,0 +units=m +no_defs');
ol.proj.get('EPSG:21781').setExtent([420000, 30000, 900000, 350000]);
proj4.defs('urn:ogc:def:crs:EPSG::21781', proj4.defs('EPSG:21781'));

var projection = ol.proj.get('EPSG:21781');
var extent = projection.getExtent();

var rasterExtent = [600000, 196000, 602000, 198000];
var rasterSize = [1000, 1000];
var rasterMinValue = 4.0;
var rasterMaxValue = 10.7848;
var precision = 16;

var RESOLUTION = Math.max(
  ol.extent.getWidth(rasterExtent) / rasterSize[0],
  ol.extent.getHeight(rasterExtent) / rasterSize[1]
  );

var getMapSize = function(extent, resolution) {
  return [
    ol.extent.getWidth(extent) / resolution,
    ol.extent.getHeight(extent) / resolution,
  ];
};

var vectorSource = new ol.source.Vector({
  format: new ol.format.GeoJSON(),
  url: 'data/triangle.geojson'
});

var vectorLayer = new ol.layer.Vector({
  source: vectorSource
});

var map = new ol.Map({
  layers: [
    new ol.layer.Tile({
      extent: extent,
      source: new ol.source.TileWMS({
        url: 'http://wms.geo.admin.ch/',
        crossOrigin: 'anonymous',
        params: {
          'LAYERS': 'ch.swisstopo.geologie-tektonische_karte',
          'FORMAT': 'image/jpeg'
        },
        serverType: 'mapserver'
      })
    }),
    new ol.layer.Image({
      source: new ol.source.ImageStatic({
        url: 'data/area-grey.png',
        imageExtent: rasterExtent,
        imageSize: rasterSize
      })
    }),
    vectorLayer
  ],
  controls: ol.control.defaults({
    attributionOptions: /** @type {olx.control.AttributionOptions} */ ({
      collapsible: false
    })
  }),
  renderer: common.getRendererFromQueryString(),
  target: 'map',
  view: new ol.View({
    resolutions: [
      RESOLUTION * 4, RESOLUTION * 2, RESOLUTION,
      RESOLUTION / 2, RESOLUTION / 4
    ],
    projection: projection,
    center: ol.proj.fromLonLat([8.23, 46.86], projection),
    zoom: 2
  })
});

vectorSource.on('change', function() {
  var feature = vectorSource.getFeatures()[0];
  map.getView().fit(feature.getGeometry(), map.getSize());
});

$('#start').click(function(evt) {
  var rasterContext = null;
  var vectorContext = null;

  var polygon = vectorSource.getFeatures()[0];

  getRasterContext(polygon, function(canvasContext) {
    rasterContext = canvasContext;
    if (rasterContext !== null && vectorContext != null) {
      calculate(rasterContext, vectorContext);
    }
  });

  getVectorContext(polygon, function(canvasContext) {
    vectorContext = canvasContext;
    if (rasterContext !== null && vectorContext != null) {
      calculate(rasterContext, vectorContext);
    }
  });
});

var getRasterContext = function(polygon, callback) {
  var rasterSource = new ol.source.ImageStatic({
    url: 'data/area-grey.png',
    imageExtent: rasterExtent,
    imageSize: rasterSize
  });
  var rasterLayer = new ol.layer.Image({
    source: rasterSource
  });
  getMapContext(polygon, rasterLayer, callback);
};

var getVectorContext = function(polygon, callback) {
  var polygonSource = new ol.source.Vector();
  polygonSource.addFeature(polygon);
  var polygonLayer = new ol.layer.Vector({
    source: polygonSource,
    style: new ol.style.Style({
      fill: new ol.style.Fill({
        color: 'rgb(255, 255, 255)'
      })
    })
  });
  getMapContext(polygon, polygonLayer, callback);
};

var getMapContext = function(polygon, layer, callback) {
  var mapResolution = RESOLUTION / precision;
  var polygonExtent = polygon.getGeometry().getExtent();
  var mapSize = getMapSize(polygonExtent, mapResolution);

  var mapContainer = document.createElement('div');
  $(mapContainer).width(mapSize[0]);
  $(mapContainer).height(mapSize[1]);
  $(mapContainer).addClass('map');
  $('#offscreen-maps').append(mapContainer);

  var offscreenMap = new ol.Map({
    layers: [layer],
    controls: [],
    interactions: [],
    target: mapContainer,
    view: new ol.View({
      projection: projection,
      resolutions: [mapResolution],
      center: ol.extent.getCenter(polygonExtent),
      resolution: mapResolution
    })
  });

  var getCanvasContext = function() {
    offscreenMap.once('postcompose', function(event) {
      var width = event.context.canvas.width;
      var height = event.context.canvas.height;
      var imageData = event.context.getImageData(0, 0, width, height);
      var pixelRatio = event.frameState.pixelRatio;
      var size = [width, height];
      callback({
        size: size,
        imageData: imageData,
        pixelRatio: pixelRatio
      });
    });
    offscreenMap.render();
  };

  if (layer instanceof ol.layer.Image) {
    var loading = 0;
    var loadend = 0;
    layer.getSource().on('imageloadstart', function(event) {
      loading++;
    });

    layer.getSource().on(['imageloadend', 'imageloaderror'], function(event) {
      loadend++;
      if (loading === loadend) {
        getCanvasContext();
      }
    });
  } else {
    getCanvasContext();
  }
};


var calculate = function(rasterContext, vectorContext) {
  console.log('Starting calculation');
  var width = rasterContext.size[0];
  var height = rasterContext.size[1];

  debugShow(vectorContext.imageData, width, height);
  debugShow(rasterContext.imageData, width, height);

  var convertToArea = function(pixelValue) {
    return rasterMinValue + (pixelValue / 255) * (rasterMaxValue - rasterMinValue);
  };

  var vectorData = vectorContext.imageData.data;
  var rasterData = rasterContext.imageData.data;
  var area = 0;
  for (var x = 0; x < width; x++) {
    for (var y = 0; y < height; y++) {
      var vectorValueAlpha = vectorData[((x * (width * 4)) + (y * 4) + 3)];
      if (vectorValueAlpha > 0) {
        var rasterValueRed = rasterData[((x * (width * 4)) + (y * 4))];

        // "simple" area
        // area += 4.0;

        // scaled "simple" area
        area += vectorValueAlpha / 255 * 4.0;

        // real area
        // area += convertToArea(rasterValueRed);

        // scaled real area
        // area += vectorValueAlpha / 255 * convertToArea(rasterValueRed);
      }
    }
  }
  console.log(area);
  console.log(area / Math.pow(precision, 2));
};

var debugShow = function(imageData, width, height) {
  var canvas = document.createElement('canvas');
  canvas.width  = width;
  canvas.height = height;
  document.body.appendChild(canvas);
  var context = canvas.getContext("2d");
  context.putImageData(imageData, 0, 0);
};
