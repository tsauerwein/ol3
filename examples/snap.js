goog.require('ol.FeatureOverlay');
goog.require('ol.Map');
goog.require('ol.View');
goog.require('ol.interaction');
goog.require('ol.interaction.Draw');
goog.require('ol.interaction.Modify');
goog.require('ol.interaction.Select');
goog.require('ol.interaction.Snap');
goog.require('ol.layer.Tile');
goog.require('ol.source.MapQuest');
goog.require('ol.style.Circle');
goog.require('ol.style.Fill');
goog.require('ol.style.Stroke');
goog.require('ol.style.Style');

var raster = new ol.layer.Tile({
  source: new ol.source.MapQuest({layer: 'sat'})
});

var map = new ol.Map({
  layers: [raster],
  target: 'map',
  view: new ol.View({
    center: [-11000000, 4600000],
    zoom: 4
  })
});

// The features are not added to a regular vector layer/source,
// but to a feature overlay which holds a collection of features.
// This collection is passed to the modify and also the draw
// interaction, so that both can add or modify features.
var featureOverlay = new ol.FeatureOverlay({
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
  }),
  map: map
});

var Modify = {
  init: function() {
    this.select = new ol.interaction.Select();
    map.addInteraction(this.select);

    this.modify = new ol.interaction.Modify({
      features: this.select.getFeatures()
    });
    map.addInteraction(this.modify);

    this.setEvents();
  },
  setEvents: function() {
    var selectedFeatures = this.select.getFeatures();

    this.select.on('change:active', function() {
      selectedFeatures.forEach(selectedFeatures.remove, selectedFeatures);
    });
  },
  setActive: function(active) {
    this.select.setActive(active);
    this.modify.setActive(active);
  }
};
Modify.init();


var Draw = {
  init: function() {
    map.addInteraction(this.Point);
    this.Point.setActive(false);
    map.addInteraction(this.LineString);
    this.LineString.setActive(false);
    map.addInteraction(this.Polygon);
    this.Polygon.setActive(false);
  },
  Point: new ol.interaction.Draw({
    features: featureOverlay.getFeatures(),
    type: /** @type {ol.geom.GeometryType} */ ('Point')
  }),
  LineString: new ol.interaction.Draw({
    features: featureOverlay.getFeatures(),
    type: /** @type {ol.geom.GeometryType} */ ('LineString')
  }),
  Polygon: new ol.interaction.Draw({
    features: featureOverlay.getFeatures(),
    type: /** @type {ol.geom.GeometryType} */ ('Polygon')
  }),
  getActive: function() {
    return this.activeType ? this[this.activeType].getActive() : false;
  },
  setActive: function(active) {
    var type = optionsForm.elements['draw-type'].value;
    if (active) {
      this.activeType && this[this.activeType].setActive(false);
      this[type].setActive(true);
      this.activeType = type;
    } else {
      this.activeType && this[this.activeType].setActive(false);
      this.activeType = null;
    }
  }
};
Draw.init();

var optionsForm = document.getElementById('options-form');


/**
 * Let user change the geometry type.
 * @param {Event} e Change event.
 */
optionsForm.onchange = function(e) {
  var type = e.target.getAttribute('name');
  var value = e.target.value;
  if (type == 'draw-type') {
    Draw.getActive() && Draw.setActive(true);
  } else if (type == 'interaction') {
    if (value == 'modify') {
      Draw.setActive(false);
      Modify.setActive(true);
    } else if (value == 'draw') {
      Draw.setActive(true);
      Modify.setActive(false);
    }
  }
};

Draw.setActive(true);
Modify.setActive(false);

// The snap interaction must be added after the Modify and Draw interactions
// in order for its map browser event handlers to be fired first. Its handlers
// are responsible of doing the snapping.
var snap = new ol.interaction.Snap({
  features: featureOverlay.getFeatures()
});
map.addInteraction(snap);
