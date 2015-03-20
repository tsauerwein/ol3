var app = {};


/**
 * Interactions.
 */
app.interactions = {};


/**
 * @typedef {{
 *    snap: (boolean),
 *    style:(ol.style.Style|Array.<ol.style.Style>|ol.style.StyleFunction|undefined),
 *    sketchStyle:(ol.style.Style|Array.<ol.style.Style>|ol.style.StyleFunction|undefined)
 * }}
 */
app.interactions.DrawOptions;


/**
 * @enum {string}
 */
app.interactions.TrackEventType = {
  /**
   * Triggered when the track has changed.
   * @event goog.events.Event#trackchanged
   */
  TRACKCHANGED: 'trackchanged'
};



/**
 * Interaction to draw a track.
 *
 * @constructor
 * @extends {ol.interaction.Pointer}
 * @param {app.interactions.DrawOptions=} opt_options Options
 */
app.interactions.Draw = function(opt_options) {

  var options = goog.isDef(opt_options) ? opt_options : {};

  goog.base(this, {});

  /**
   * Should the points and segments be snapped?
   * @type {boolean}
   * @private
   */
  this.snap_ = goog.isDef(options.snap) ? options.snap : true;

  /**
   * If the distance between the original point and the mapped point
   * on the network is less than this tolerance, the point is snapped.
   * @type {number}
   * @private
   */
  this.snapTolerance_ = 15;

  // this.osrmProfile_ = 'neutral';
  this.osrmProfile_ = 'quiet';

  // this.baseOsrmUrl_ = 'http://chmobil-osrm.dev.bgdi.ch/';
  this.baseOsrmUrl_ =
      'http://provelobern-geomapfish.prod.sig.cloud.camptocamp.net/';

  this.osrmLocateUrl_ = this.baseOsrmUrl_ + '{profile}/nearest?loc={point}';

  this.osrmRoutingUrl_ =
      this.baseOsrmUrl_ +
      '{profile}/viaroute?loc={from}&loc={to}&instructions=false&alt=false' +
      '&z={zoom}&output=json';

  var defaulStyle = new ol.style.Style({
    fill: new ol.style.Fill({
      color: '#d80000'
    }),
    stroke: new ol.style.Stroke({
      color: '#d80000',
      width: 3
    }),
    image: new ol.style.RegularShape(
        /** @type {olx.style.RegularShapeOptions} */({
          fill: new ol.style.Fill({
            color: '#d80000'
          }),
          points: 4,
          radius: 8,
          angle: Math.PI / 4
        }))
  });

  var style = goog.isDef(options.style) ? options.style : [defaulStyle];

  /**
   * The control points of the track.
   * @type {Array.<ol.Feature>}
   * @private
   */
  this.controlPoints_ = [];

  /**
   * @type {ol.Feature}
   * @private
   */
  this.lastPoint_ = null;

  /**
   * The segments of the track.
   * @type {Array.<ol.Feature>}
   * @private
   */
  this.segments_ = [];

  /**
   * The overlay for the track control points.
   * @type {ol.FeatureOverlay}
   * @private
   */
  this.pointOverlay_ = new ol.FeatureOverlay({
    style: style
  });

  /**
   * The overlay for the track segments.
   * @type {ol.FeatureOverlay}
   * @private
   */
  this.segmentOverlay_ = new ol.FeatureOverlay({
    style: style
  });

  /**
   * @type {ol.interaction.Draw}
   * @private
   */
  this.drawInteraction_ = new ol.interaction.Draw(
      /** @type {olx.interaction.DrawOptions} */ ({
        type: 'Point',
        style: options.sketchStyle
      }));

  goog.events.listen(this.drawInteraction_, ol.DrawEventType.DRAWEND,
      this.onDrawEnd_, false, this);

};
goog.inherits(app.interactions.Draw, ol.interaction.Pointer);


/**
 * @return {boolean} Snap?
 */
app.interactions.Draw.prototype.getSnap = function() {
  return this.snap_;
};


/**
 * @param {boolean} snap Snap?
 */
app.interactions.Draw.prototype.setSnap = function(snap) {
  this.snap_ = snap;
};


/**
 * @return {String} The OSRM profile used.
 */
app.interactions.Draw.prototype.getProfile = function() {
  return this.profile_;
};


/**
 * @param {String} profile The OSRM profile to use.
 */
app.interactions.Draw.prototype.setProfile = function(profile) {
  this.profile_ = profile;
};


/**
 * @return {boolean} Does the track have points?
 */
app.interactions.Draw.prototype.hasPoints = function() {
  return this.controlPoints_.length > 0;
};


/**
 * @inheritDoc
 */
app.interactions.Draw.prototype.setMap = function(map) {
  goog.base(this, 'setMap', map);

  this.pointOverlay_.setMap(map);
  this.segmentOverlay_.setMap(map);

  var prevMap = this.drawInteraction_.getMap();
  if (!goog.isNull(prevMap)) {
    prevMap.removeInteraction(this.drawInteraction_);
  }

  if (!goog.isNull(map)) {
    map.addInteraction(this.drawInteraction_);
  }
};


/**
 * @param {ol.DrawEvent} evt
 * @private
 */
app.interactions.Draw.prototype.onDrawEnd_ = function(evt) {
  var feature = evt.feature;
  this.controlPoints_.push(feature);
  this.refreshOverlays_(false);
};


/**
 * Remove the last control point.
 */
app.interactions.Draw.prototype.removeLastPoint = function() {
  if (this.controlPoints_.length === 0 || this.lastPoint_ === null) {
    return;
  }
  this.controlPoints_.pop();
  this.segments_.pop();
  this.segmentOverlay_.removeFeature(this.lastPoint_.get('segment'));
  this.refreshOverlays_(true);
};


/**
 * @param {boolean} removing
 * @private
 */
app.interactions.Draw.prototype.refreshOverlays_ = function(removing) {
  this.pointOverlay_.getFeatures().clear();
  this.lastPoint_ = null;
  if (this.controlPoints_.length > 0) {
    // always show the last control point
    var lastIndex = this.controlPoints_.length - 1;
    var currentPoint = this.controlPoints_[lastIndex];
    this.pointOverlay_.addFeature(currentPoint);
    this.lastPoint_ = currentPoint;

    if (!removing) {
      if (this.controlPoints_.length >= 2) {
        var previousPoint = this.controlPoints_[lastIndex - 1];
        this.addSegment_(previousPoint, currentPoint);
      }

      if (this.snap_) {
        this.requestSnapPoint_(currentPoint);
      }
    }
  }
  this.dispatchChangeEvent_();
};


/**
 * @param {ol.Feature} pointFrom
 * @param {ol.Feature} pointTo
 * @private
 */
app.interactions.Draw.prototype.addSegment_ = function(pointFrom, pointTo) {
  var segment = new ol.Feature({
    geometry: new ol.geom.LineString([
      pointFrom.getGeometry().getCoordinates(),
      pointTo.getGeometry().getCoordinates()
    ])
  });

  pointTo.set('previousPoint', pointFrom);
  pointTo.set('segment', segment);
  pointTo.set('snapped', false);

  this.segments_.push(segment);
  this.segmentOverlay_.addFeature(segment);
};


/**
 * @param {ol.Feature} feature
 * @private
 */
app.interactions.Draw.prototype.requestSnapPoint_ = function(feature) {
  var point = /** @type {ol.geom.Point} */ (feature.getGeometry());
  var location = ol.proj.transform(
      point.getCoordinates(),
      this.getMap().getView().getProjection(), 'EPSG:4326');

  var url = this.osrmLocateUrl_
    .replace('{profile}', this.osrmProfile_)
    .replace('{point}', location[1] + ',' + location[0]);

  goog.net.XhrIo.send(url, goog.bind(function(e) {
    var xhr = /** @type {goog.net.XhrIo} */ (e.target);
    if (this.lastPoint_ !== feature || !xhr.isSuccess()) {
      return;
    }

    var response = xhr.getResponseJson();
    if (response['status'] === 0) {
      var mappedCoordinate = response['mapped_coordinate'];
      var mappedPoint = new ol.geom.Point(ol.proj.transform(
          [mappedCoordinate[1], mappedCoordinate[0]],
          'EPSG:4326', this.getMap().getView().getProjection()));
      this.snapPoint_(feature, mappedPoint);
    }
    // if the request was not successful simply keep the original point
  }, this));
};


/**
 * @param {ol.Feature} feature
 * @param {ol.geom.Point} mappedPoint
 * @private
 */
app.interactions.Draw.prototype.snapPoint_ = function(feature, mappedPoint) {
  if (!this.isValidSnap_(feature.getGeometry(), mappedPoint)) {
    return;
  }
  feature.set('snapped', true);

  // use the mapped point
  feature.setGeometry(mappedPoint);

  if (goog.isDef(feature.get('previousPoint'))) {
    // update the segment leading to this point
    var previousPoint = feature.get('previousPoint');
    feature.get('segment').setGeometry(new ol.geom.LineString([
      previousPoint.getGeometry().getCoordinates(),
      mappedPoint.getCoordinates()
    ]));

    // if the previous point was also snapped, we can try to find a route
    // between the points
    if (previousPoint.get('snapped') && feature.get('snapped')) {
      this.requestRoute_(previousPoint, feature);
    }
  }
  this.dispatchChangeEvent_();
};


/**
 * @param {ol.Feature} featureFrom
 * @param {ol.Feature} featureTo
 * @private
 */
app.interactions.Draw.prototype.requestRoute_ =
    function(featureFrom, featureTo) {
  var pointFrom = /** @type {ol.geom.Point} */ (featureFrom.getGeometry());
  var from = ol.proj.transform(
      pointFrom.getCoordinates(),
      this.getMap().getView().getProjection(), 'EPSG:4326');
  var pointTo = /** @type {ol.geom.Point} */ (featureTo.getGeometry());
  var to = ol.proj.transform(
      pointTo.getCoordinates(),
      this.getMap().getView().getProjection(), 'EPSG:4326');

  var url = this.osrmRoutingUrl_
    .replace('{profile}', this.osrmProfile_)
    .replace('{from}', from[1] + ',' + from[0])
    .replace('{to}', to[1] + ',' + to[0])
    .replace('{zoom}', '18');

  goog.net.XhrIo.send(url, goog.bind(function(e) {
    var xhr = /** @type {goog.net.XhrIo} */ (e.target);
    if (this.lastPoint_ !== featureTo || !xhr.isSuccess()) {
      return;
    }

    var response = xhr.getResponseJson();
    if (response['status'] === 0) {
      var format = new ol.format.Polyline({factor: 1e6});
      var route = format.readGeometry(response['route_geometry'], {
        dataProjection: 'EPSG:4326',
        featureProjection: this.getMap().getView().getProjection()
      });
      featureTo.get('segment').setGeometry(route);
      this.dispatchChangeEvent_();
    }
  }, this));
};


/**
 * @param {ol.geom.Point} originalPoint
 * @param {ol.geom.Point} mappedPoint
 * @return {boolean}
 * @private
 */
app.interactions.Draw.prototype.isValidSnap_ =
    function(originalPoint, mappedPoint) {
  var map = this.getMap();

  var originalPointPx =
      map.getPixelFromCoordinate(originalPoint.getCoordinates());
  var mappedPointPx =
      map.getPixelFromCoordinate(mappedPoint.getCoordinates());

  var distance = goog.math.Coordinate.distance(
      new goog.math.Coordinate(originalPointPx[0], originalPointPx[1]),
      new goog.math.Coordinate(mappedPointPx[0], mappedPointPx[1]));

  return distance < this.snapTolerance_;
};


/**
 * @private
 */
app.interactions.Draw.prototype.dispatchChangeEvent_ = function() {
  this.dispatchEvent(new goog.events.Event(
      app.interactions.TrackEventType.TRACKCHANGED));
};


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

var drawInteraction = new app.interactions.Draw({
  snap: true,
  sketchStyle: new ol.style.Style({
    image: new ol.style.RegularShape(
        /** @type {olx.style.RegularShapeOptions} */({
          fill: new ol.style.Fill({
            color: '#d80000'
          }),
          points: 4,
          radius: 8,
          angle: Math.PI / 4
        }))
  })
});
map.addInteraction(drawInteraction);

$('#remove-last-point').click(function(e) {
  drawInteraction.removeLastPoint();
});

drawInteraction.on('trackchanged', function(evt) {
  $('#remove-last-point').prop('disabled', !drawInteraction.hasPoints());
});
