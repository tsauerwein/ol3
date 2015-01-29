goog.require('ol.Attribution');
goog.require('ol.Map');
goog.require('ol.View');
goog.require('ol.extent');
goog.require('ol.layer.Image');
goog.require('ol.proj.Projection');
goog.require('ol.source.ImageStatic');


// Map views always need a projection.  Here we just want to map image
// coordinates directly to map coordinates, so we create a projection that uses
// the image extent in pixels.
var extent = [0, 0, 1024, 968];
var projection = new ol.proj.Projection({
  code: 'xkcd-image',
  units: 'pixels',
  extent: extent
});

var map = new ol.Map({
  renderer: exampleNS.getRendererFromQueryString(),
  layers: [
    new ol.layer.Image({
      source: new ol.source.ImageStatic({
        attributions: [
          new ol.Attribution({
            html: '&copy; <a href="http://xkcd.com/license.html">xkcd</a>'
          })
        ],
        url: 'data/online_communities.png',
        projection: projection,
        imageExtent: extent
      })
    })
  ],
  target: 'map',
  view: new ol.View({
    projection: projection,
    center: ol.extent.getCenter(extent),
    zoom: 2
  })
});

$(map.getViewport()).on('mousemove', function(evt) {
  var pixel = map.getEventPixel(evt.originalEvent);
  var hit = map.forEachLayerAtPixel(pixel, function(layer) {
    return true;
  }, this, function(layer) {
    return layer instanceof ol.layer.Image;
  });
  map.getTargetElement().style.cursor = hit ? 'pointer' : '';
});
