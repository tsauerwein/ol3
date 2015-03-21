goog.provide('ol.test.format.ProtobufVectorTile');


describe('ol.format.ProtobufVectorTile', function() {

  var format, tileData;
  var tilePath = 'spec/ol/format/vectortile.pbf/1578.vector.pbf';
  var tileCoords = [12, 797, 1578];
  // https://c.tiles.mapbox.com/v4/mapbox.mapbox-streets-v6-dev/12/797/1578.vector.pbf?access_token=pk.eyJ1IjoibWFwYm94IiwiYSI6IlhHVkZmaW8ifQ.hAMX5hSW-QnTeRCMAy9A8Q

  before(function(done) {
    var request = new XMLHttpRequest();
    request.open('GET', tilePath, true);
    request.responseType = 'arraybuffer';

    request.onload = function (evt) {
      var arrayBuffer = request.response;
      if (arrayBuffer) {
        tileData = arrayBuffer;
        done();
      } else {
        done('Failed to load tile ' + tilePath)
      }
    };
    request.send(null);
  });

  beforeEach(function() {
    format = new ol.format.GeoJSON();
  });

  describe('#readFeatures', function() {

    it('can read all features', function() {
      var byteArray = new Uint8Array(tileData);
      var format = new ol.format.ProtobufVectorTile();
      var features = format.readFeatures(byteArray, tileCoords);
      expect(features.length).to.be(7);

      var feature = features[0];
      expect(feature.get('_layer_')).to.be('landuse');
      expect(feature.get('class')).to.be('park');

      var geometry = feature.getGeometry();
      expect(geometry).to.be.a(ol.geom.Polygon);
      var firstCoord = geometry.getFirstCoordinate();
      expect(firstCoord[0]).to.roughlyEqual(-109.9525451, 1e-6);
      expect(firstCoord[1]).to.roughlyEqual(38.131839199, 1e-6);
      console.log(features);
      console.log(features.length);
    });

    it('can read all features in tile space', function() {
      var byteArray = new Uint8Array(tileData);
      var format = new ol.format.ProtobufVectorTile();
      var features = format.readFeatures(
            byteArray, tileCoords, {tileSpace: true});
      expect(features.length).to.be(7);

      var feature = features[0];
      expect(feature.get('_layer_')).to.be('landuse');
      expect(feature.get('class')).to.be('park');

      var geometry = feature.getGeometry();
      expect(geometry).to.be.a(ol.geom.Polygon);
      var firstCoord = geometry.getFirstCoordinate();
      expect(firstCoord[0]).to.roughlyEqual(-64, 1e-6);
      expect(firstCoord[1]).to.roughlyEqual(161, 1e-6);
    });

    it('can read only the features of one layer', function() {
      var byteArray = new Uint8Array(tileData);
      var format = new ol.format.ProtobufVectorTile();
      var features = format.readFeatures(
          byteArray, tileCoords, {layers: ['water']});
      expect(features.length).to.be(4);

      var feature = features[0];
      expect(feature.get('_layer_')).to.be('water');
    });
  });

});


goog.require('ol.ext.vectortile');
goog.require('ol.ext.pbf');
goog.require('ol.format.GeoJSON');
goog.require('ol.format.ProtobufVectorTile');

