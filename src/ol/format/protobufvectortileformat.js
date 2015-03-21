// FIXME coordinate order
// FIXME reprojection

goog.provide('ol.format.ProtobufVectorTile');

goog.require('ol.ext.vectortile');
goog.require('ol.ext.pbf');
goog.require('goog.array');
goog.require('goog.asserts');
goog.require('goog.object');
goog.require('ol.Feature');
goog.require('ol.format.GeoJSON');
goog.require('ol.format.BinaryFeature');
goog.require('ol.geom.GeometryCollection');
goog.require('ol.geom.GeometryType');
goog.require('ol.geom.LineString');
goog.require('ol.geom.MultiLineString');
goog.require('ol.geom.MultiPoint');
goog.require('ol.geom.MultiPolygon');
goog.require('ol.geom.Point');
goog.require('ol.geom.Polygon');
goog.require('ol.proj');



/**
 * @classdesc
 * Feature format for reading MapBox Protobuf vector tiles.
 *
 * @constructor
 * @extends {ol.format.BinaryFeature}
 * @api
 */
ol.format.ProtobufVectorTile = function(opt_options) {

  var options = goog.isDef(opt_options) ? opt_options : {};

  goog.base(this);

  /**
   * @inheritDoc
   */
  this.defaultDataProjection = ol.proj.get('EPSG:4326');
};
goog.inherits(ol.format.ProtobufVectorTile, ol.format.BinaryFeature);


/**
 * @const
 * @type {Array.<string>}
 * @private
 */
ol.format.ProtobufVectorTile.EXTENSIONS_ = ['.vector.pbf'];

/**
 * @const
 * @type {Array.<string>}
 * @private
 */
ol.format.ProtobufVectorTile.TYPES_ = ['Unknown', 'Point', 'LineString', 'Polygon'];

/**
 * @inheritDoc
 */
ol.format.ProtobufVectorTile.prototype.getExtensions = function() {
  return ol.format.ProtobufVectorTile.EXTENSIONS_;
};


/**
 * Read all features of a tile.
 *
 * @function
 * @param {byteArray} source Source.
 * @param {ol.TileCoord} tileCoord Tile coordinates of the tile.
 * @param {olx.format.ProtobufVectorTileOptions=} opt_options Read options.
 * @return {Array.<ol.Feature>} Features.
 * @api
 */
ol.format.ProtobufVectorTile.prototype.readFeatures =
      function(byteArray, tileCoord, opt_options) {
  var options = goog.isDef(opt_options) ? opt_options : {};
  var reproject = goog.isDef(options.tileSpace) ? !options.tileSpace : true;
  var features = [];

  var pbf = new ol.ext.pbf(byteArray);
  var tile = new ol.ext.vectortile.VectorTile(pbf);
  var layer, feature;
  for (var layerName in tile.layers) {
    if (goog.isDef(options.layers) &&
          !goog.array.contains(options.layers, layerName)) {
      continue;
    }
    layer = tile.layers[layerName];

    for (var i = 0; i < layer.length; i++) {
      var feature = this.createFeature_(layer.feature(i), tileCoord, reproject);
      if (goog.isNull(feature)) {
        continue;
      }
      // keep the layer name
      feature.set('_layer_', layerName);
      // TODO don't do the reprojection here
      feature.getGeometry().transform('EPSG:4326', 'EPSG:3857');
      features.push(feature);
    }
  }

  return features;
};


ol.format.ProtobufVectorTile.prototype.createFeature_ =
      function(rawFeature, tileCoord, reproject) {
  var geometry = this.createGeometry_(rawFeature, tileCoord, reproject);
  if (goog.isNull(geometry)) {
    return null;
  }

  var feature = new ol.Feature(geometry);
  feature.setProperties(rawFeature.properties);

  return feature;
};


/**
 * Create the geometry in 'EPSG:4326' for a vector tile feature.
 *
 * See VectorTileFeature.toGeoJSON:
 * https://github.com/mapbox/vector-tile-js/blob/master/lib/vectortilefeature.js
 *
 * @return {ol.geom.Geometry} Geometry.
 * @private
 */
ol.format.ProtobufVectorTile.prototype.createGeometry_ =
      function(rawFeature, tileCoord, reproject) {
  if (rawFeature.type === 0) {
    return null;
  }

  var size = rawFeature.extent * Math.pow(2, tileCoord[0]);
  var x0 = rawFeature.extent * tileCoord[1];
  var y0 = rawFeature.extent * tileCoord[2];
  var coords = rawFeature.loadGeometry();

  var type = ol.format.ProtobufVectorTile.TYPES_[rawFeature.type];
  goog.asserts.assert(goog.isDef(type), 'invalid geometry type');

  if (reproject) {
    // reproject the coordinates to EPSG:4326
    for (var i = 0; i < coords.length; i++) {
      var line = coords[i];
      for (var j = 0; j < line.length; j++) {
        var p = line[j];
        var y2 = 180 - (p.y + y0) * 360 / size;
        line[j] = [
            (p.x + x0) * 360 / size - 180,
            360 / Math.PI * Math.atan(Math.exp(y2 * Math.PI / 180)) - 90
        ];
      }
    }
  } else {
    // do not reproject, keep the coordinates in "tile space"
    // TODO avoid this step, write a custom loadGeometry function
    for (var i = 0; i < coords.length; i++) {
      var line = coords[i];
      for (var j = 0; j < line.length; j++) {
        line[j] = [line[j].x, line[j].y];
      }
    }
  }

  if (type === 'Point' && coords.length === 1) {
    return new ol.geom.Point(coords[0][0]);
  } else if (type === 'Point') {
    return new ol.geom.MultiPoint(coords[0]);
  } else if (type === 'LineString' && coords.length === 1) {
    return new ol.geom.LineString(coords[0]);
  } else if (type === 'LineString') {
    return new ol.geom.MultiLineString(coords);
  } else {
    return new ol.geom.Polygon(coords);
  }
};