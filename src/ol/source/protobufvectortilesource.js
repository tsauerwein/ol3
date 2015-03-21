goog.provide('ol.source.ProtobufVectorTile');

goog.require('ol.source.TileVector');
goog.require('ol.format.ProtobufVectorTile');



/**
 * @classdesc
 * A vector source in one of the supported formats, where the data is divided
 * into tiles in a fixed grid pattern.
 *
 * @constructor
 * @extends {ol.source.FormatVector}
 * @param {olx.source.TileVectorOptions} options Options.
 * @api
 */
ol.source.ProtobufVectorTile = function(options) {

  goog.base(this, {
    attributions: options.attributions,
    format: new ol.format.ProtobufVectorTile(),
    logo: options.logo,
    projection: options.projection,
    tileGrid: options.tileGrid,
    tileUrlFunction: options.tileUrlFunction,
    url: options.url,
    urls: options.urls
  });


};
goog.inherits(ol.source.ProtobufVectorTile, ol.source.TileVector);



/**
 * @inheritDoc
 */
ol.source.ProtobufVectorTile.prototype.loadFeatures =
    function(extent, resolution, projection) {
  // TODO copy, refactor
  var tileCoordTransform = this.tileCoordTransform_;
  var tileGrid = this.tileGrid_;
  var tileUrlFunction = this.tileUrlFunction_;
  var tiles = this.tiles_;
  var z = tileGrid.getZForResolution(resolution);
  var tileRange = tileGrid.getTileRangeForExtentAndZ(extent, z);
  var tileCoord = [z, 0, 0];
  var x, y;
  /**
   * @param {string} tileKey Tile key.
   * @param {Array.<ol.Feature>} features Features.
   * @this {ol.source.TileVector}
   */
  function success(tileKey, tileCoord, source) {
    var features = this.format.readFeatures(source, tileCoord);
    tiles[tileKey] = features;
    this.setState(ol.source.State.READY);
  }
  for (x = tileRange.minX; x <= tileRange.maxX; ++x) {
    for (y = tileRange.minY; y <= tileRange.maxY; ++y) {
      var tileKey = this.getTileKeyZXY_(z, x, y);
      if (!(tileKey in tiles)) {
        tileCoord[0] = z;
        tileCoord[1] = x;
        tileCoord[2] = y;
        tileCoordTransform(tileCoord, projection, tileCoord);
        var url = tileUrlFunction(tileCoord, 1, projection);
        if (goog.isDef(url)) {
          tiles[tileKey] = [];
          this.loadFeaturesFromURL(url, goog.partial(success, tileKey, goog.array.clone(tileCoord)),
              goog.nullFunction, this);
        }
      }
    }
  }
};


/**
 * @inheritDoc
 */
ol.source.ProtobufVectorTile.prototype.readFeatures = function(source) {
  return new Uint8Array(source);
};