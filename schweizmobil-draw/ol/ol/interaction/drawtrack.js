goog.provide('ol.interaction.DrawTrack');
goog.provide('ol.interaction.DrawTrackOptions');
goog.provide('ol.interaction.TrackEventType');

goog.require('goog.asserts');
goog.require('goog.events');
goog.require('goog.events.Event');
goog.require('goog.math.Coordinate');
goog.require('goog.net.XhrIo');
goog.require('ol.DrawEventType');
goog.require('ol.Feature');
goog.require('ol.FeatureOverlay');
goog.require('ol.format.Polyline');
goog.require('ol.geom.LineString');
goog.require('ol.geom.Point');
goog.require('ol.interaction.Draw');
goog.require('ol.interaction.Pointer');
goog.require('ol.proj');
goog.require('ol.style.Fill');
goog.require('ol.style.RegularShape');
goog.require('ol.style.Stroke');
goog.require('ol.style.Style');


/**
 * @typedef {{
 *    snap: (boolean),
 *    style:(ol.style.Style|Array.<ol.style.Style>|ol.style.StyleFunction|undefined),
 *    sketchStyle:(ol.style.Style|Array.<ol.style.Style>|ol.style.StyleFunction|undefined)
 * }}
 * @api
 */
ol.interaction.DrawTrackOptions;


/**
 * @enum {string}
 */
ol.interaction.TrackEventType = {
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
 * @param {ol.interaction.DrawTrackOptions=} opt_options Options
 * @api
 */
ol.interaction.DrawTrack = function(opt_options) {

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

  /**
   * @type {string}
   * @private
   */
  this.osrmProfile_ = 'quiet';
  // this.osrmProfile_ = 'neutral';

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

  var defaulSketchStyle = new ol.style.Style({
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
  var sketchStyle = goog.isDef(options.sketchStyle) ?
      options.sketchStyle : [defaulSketchStyle];

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
        style: sketchStyle
      }));

  goog.events.listen(this.drawInteraction_, ol.DrawEventType.DRAWEND,
      this.onDrawEnd_, false, this);

};
goog.inherits(ol.interaction.DrawTrack, ol.interaction.Pointer);


/**
 * @return {boolean} Snap?
 * @api
 */
ol.interaction.DrawTrack.prototype.getSnap = function() {
  return this.snap_;
};


/**
 * @param {boolean} snap Snap?
 * @api
 */
ol.interaction.DrawTrack.prototype.setSnap = function(snap) {
  this.snap_ = snap;
};


/**
 * @return {string} The OSRM profile used.
 * @api
 */
ol.interaction.DrawTrack.prototype.getProfile = function() {
  return this.osrmProfile_;
};


/**
 * @param {string} profile The OSRM profile to use.
 * @api
 */
ol.interaction.DrawTrack.prototype.setProfile = function(profile) {
  this.osrmProfile_ = profile;
};


/**
 * @return {boolean} Does the track have points?
 * @api
 */
ol.interaction.DrawTrack.prototype.hasPoints = function() {
  return this.controlPoints_.length > 0;
};


/**
 * @inheritDoc
 */
ol.interaction.DrawTrack.prototype.setMap = function(map) {
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
ol.interaction.DrawTrack.prototype.onDrawEnd_ = function(evt) {
  var feature = evt.feature;
  this.controlPoints_.push(feature);
  this.refreshOverlays_(false);
};


/**
 * Remove the last control point.
 * @api
 */
ol.interaction.DrawTrack.prototype.removeLastPoint = function() {
  if (this.controlPoints_.length === 0 || this.lastPoint_ === null) {
    return;
  }
  this.controlPoints_.pop();
  this.segments_.pop();
  this.segmentOverlay_.removeFeature(/** @type {ol.Feature} */ (
      this.lastPoint_.get('segment')));
  this.refreshOverlays_(true);
};


/**
 * @param {boolean} removing
 * @private
 */
ol.interaction.DrawTrack.prototype.refreshOverlays_ = function(removing) {
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
 * @param {ol.Feature} featureFrom
 * @param {ol.Feature} featureTo
 * @private
 */
ol.interaction.DrawTrack.prototype.addSegment_ =
    function(featureFrom, featureTo) {
  var pointFrom = /** @type {ol.geom.Point} */ (featureFrom.getGeometry());
  var pointTo = /** @type {ol.geom.Point} */ (featureTo.getGeometry());

  var segment = new ol.Feature({
    geometry: new ol.geom.LineString([
      pointFrom.getCoordinates(),
      pointTo.getCoordinates()
    ])
  });

  featureTo.set('previousPoint', featureFrom);
  featureTo.set('segment', segment);
  featureTo.set('snapped', false);

  this.segments_.push(segment);
  this.segmentOverlay_.addFeature(segment);
};


/**
 * @param {ol.Feature} feature
 * @private
 */
ol.interaction.DrawTrack.prototype.requestSnapPoint_ = function(feature) {
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
ol.interaction.DrawTrack.prototype.snapPoint_ = function(feature, mappedPoint) {
  var point = /** @type {ol.geom.Point} */ (feature.getGeometry());
  if (!this.isValidSnap_(point, mappedPoint)) {
    return;
  }
  feature.set('snapped', true);

  // use the mapped point
  feature.setGeometry(mappedPoint);

  if (goog.isDef(feature.get('previousPoint'))) {
    // update the segment leading to this point
    var previousFeature = /** @type {ol.Feature} */ (
        feature.get('previousPoint'));
    var previousPoint = /** @type {ol.geom.Point} */ (
        previousFeature.getGeometry());
    feature.get('segment').setGeometry(new ol.geom.LineString([
      previousPoint.getCoordinates(),
      mappedPoint.getCoordinates()
    ]));

    // if the previous point was also snapped, we can try to find a route
    // between the points
    if (previousFeature.get('snapped') && feature.get('snapped')) {
      this.requestRoute_(previousFeature, feature);
    }
  }
  this.dispatchChangeEvent_();
};


/**
 * @param {ol.Feature} featureFrom
 * @param {ol.Feature} featureTo
 * @private
 */
ol.interaction.DrawTrack.prototype.requestRoute_ =
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
ol.interaction.DrawTrack.prototype.isValidSnap_ =
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
ol.interaction.DrawTrack.prototype.dispatchChangeEvent_ = function() {
  this.dispatchEvent(new goog.events.Event(
      ol.interaction.TrackEventType.TRACKCHANGED));
};
