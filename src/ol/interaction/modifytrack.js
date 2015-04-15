goog.provide('ol.interaction.ModifyTrack');

goog.require('goog.array');
goog.require('goog.asserts');
goog.require('goog.net.XhrIo');
goog.require('goog.object');
goog.require('ol.Collection');
goog.require('ol.Feature');
goog.require('ol.FeatureOverlay');
goog.require('ol.format.Polyline');
goog.require('ol.geom.GeometryLayout');
goog.require('ol.geom.LineString');
goog.require('ol.geom.Point');
goog.require('ol.interaction.Modify');
goog.require('ol.interaction.Snap');
goog.require('ol.interaction.Track');
goog.require('ol.proj');
goog.require('ol.style.Fill');
goog.require('ol.style.RegularShape');
goog.require('ol.style.Stroke');
goog.require('ol.style.Style');



/**
 * Interaction to modify a track.
 *
 * @constructor
 * @extends {ol.interaction.Track}
 * @param {ol.interaction.TrackOptions=} opt_options Options
 * @api
 */
ol.interaction.ModifyTrack = function(opt_options) {

  var options = goog.isDef(opt_options) ? opt_options : {};

  goog.object.extend(options, {
    handleEvent: ol.interaction.ModifyTrack.prototype.handleEvent,
    handleDownEvent: ol.interaction.ModifyTrack.prototype.handleDownEvent,
    handleDragEvent: ol.interaction.ModifyTrack.prototype.handleDragEvent,
    handleMoveEvent: ol.interaction.ModifyTrack.prototype.handleMoveEvent,
    handleUpEvent: ol.interaction.ModifyTrack.prototype.handleUpEvent
  });
  goog.base(this, /** @type {ol.interaction.TrackOptions} */ (options));

  var defaultModifyStyle = function(feature, resolution) {
    return [new ol.style.Style({
      fill: new ol.style.Fill({
        color: '#7E0000'
      }),
      stroke: new ol.style.Stroke({
        color: '#7E0000',
        width: 3
      }),
      image: new ol.style.RegularShape({
        fill: new ol.style.Fill({
          color: '#7E0000'
        }),
        stroke: new ol.style.Stroke({
          color: '#7E0000',
          width: 1
        }),
        points: 4,
        radius: feature.get('small') ? 6 : 8,
        angle: Math.PI / 4
      })
    })];
  };

  this.snapFeatures_ = new ol.Collection();
  this.snapInteraction_ = new ol.interaction.Snap({
    features: this.snapFeatures_
  });

  /**
   * The coordinate of the last registered event when dragging.
   * @type {ol.Pixel}
   * @private
   */
  this.coordinate_ = null;

  /**
   * The feature that is being dragged.
   * @type {ol.Feature}
   * @private
   */
  this.dragFeature_ = null;

  /**
   * If the feature was dragged after a `down` event. Needed to
   * register clicks without dragging.
   * @type {boolean}
   * @private
   */
  this.wasDragged_ = false;

  /**
   * Sketch point.
   * @type {ol.Feature}
   * @private
   */
  this.sketchPoint_ = null;

  /**
   * If inserting a new point or dragging an existing control point.
   * @type {boolean}
   * @private
   */
  this.insertingNewPoint_ = false;

  /**
   * The last point that was dragged.
   * @type {ol.Feature}
   * @private
   */
  this.lastPoint_ = null;

  /**
   * Overlay used to show the sketch point.
   * @type {ol.FeatureOverlay}
   * @private
   */
  this.sketchOverlay_ = new ol.FeatureOverlay({
    style: defaultModifyStyle
  });

  /**
   * If the distance between the original point and the mapped point
   * is less than this tolerance, the point is considered on the network.
   * @type {number}
   */
  this.onNetworkTolerance = 5;
};
goog.inherits(ol.interaction.ModifyTrack, ol.interaction.Track);


/**
 * @inheritDoc
 */
ol.interaction.ModifyTrack.prototype.setMap = function(map) {
  goog.base(this, 'setMap', map);

  var prevMap = this.snapInteraction_.getMap();
  if (!goog.isNull(prevMap)) {
    prevMap.removeInteraction(this.snapInteraction_);
  }

  if (!goog.isNull(map)) {
    map.addInteraction(this.snapInteraction_);
  }
  this.sketchOverlay_.setMap(map);
};


/**
 * @param {Array.<ol.Feature>} controlPoints Control points.
 * @param {Array.<ol.Feature>} segments Segments.
 * @api
 */
ol.interaction.ModifyTrack.prototype.setTrack =
    function(controlPoints, segments) {
  goog.asserts.assert(segments.length + 1 === controlPoints.length);

  this.controlPoints = controlPoints;
  this.segments = segments;
  this.snapFeatures_.clear();

  var point, previousPoint, segment;
  for (var i = 0; i < controlPoints.length; i++) {
    point = controlPoints[i];

    this.snapFeatures_.push(point);
    if (i === 0) {
      point.set('segmentIn', null);
      point.set('segmentOut', segments.length > 0 ? segments[0] : null);
    } else {
      segment = segments[i - 1];
      previousPoint = controlPoints[i - 1];
      point.set('segmentIn', segment);
      point.set('segmentOut', i < segments.length ? segments[i] : null);
      this.snapFeatures_.push(segment);

      segment.set('from', previousPoint);
      segment.set('to', point);
    }
  }

  this.pointOverlay.getFeatures().clear();
  this.pointOverlay.getFeatures().extend(controlPoints);
  this.segmentOverlay.getFeatures().clear();
  this.segmentOverlay.getFeatures().extend(segments);
};


/**
 * @param {ol.MapBrowserEvent} evt Map browser event.
 * @return {boolean} `true` to start the drag sequence.
 */
ol.interaction.ModifyTrack.prototype.handleDownEvent = function(evt) {
  this.wasDragged_ = false;
  var map = evt.map;

  var feature = map.forEachFeatureAtPixel(evt.pixel,
      function(feature, layer) {
        // skip the sketch-point
        if (feature === this.sketchPoint_) {
          return undefined;
        } else {
          return feature;
        }
      }, this);

  if (goog.isDef(feature)) {
    this.insertingNewPoint_ = feature.getGeometry().getType() === 'LineString';
    if (this.insertingNewPoint_) {
      var newPoint = new ol.Feature(
          new ol.geom.Point(goog.array.slice(evt.coordinate, 0, 2)));
      this.insertControlPoint_(feature, newPoint);
      feature = newPoint;
    }

    this.coordinate_ = evt.coordinate;
    this.dragFeature_ = feature;
    this.clearSketchPoint_();
    this.snapInteraction_.setActive(false);
  }

  return goog.isDef(feature);
};


/**
 * @param {ol.Feature} segment The segment that will be split by the new point.
 * @param {ol.Feature} controlPoint The new control point.
 * @private
 */
ol.interaction.ModifyTrack.prototype.insertControlPoint_ =
    function(segment, controlPoint) {
  var pointFrom = /** @type {ol.Feature} */ (segment.get('from'));
  var pointTo = /** @type {ol.Feature} */ (segment.get('to'));

  var segment1 = this.createSegment_(pointFrom, controlPoint);
  var segment2 = this.createSegment_(controlPoint, pointTo);

  this.replaceSegment_(segment, segment1, segment2);

  var insertIndex = goog.array.indexOf(this.controlPoints, pointTo);
  goog.array.insertAt(this.controlPoints, controlPoint, insertIndex);
  this.pointOverlay.addFeature(controlPoint);
  this.snapFeatures_.push(controlPoint);
};


/**
 * @param {ol.Feature} featureFrom Start point.
 * @param {ol.Feature} featureTo End point.
 * @return {ol.Feature} Segment between the two points.
 * @private
 */
ol.interaction.ModifyTrack.prototype.createSegment_ =
    function(featureFrom, featureTo) {
  var pointFrom = /** @type {ol.geom.Point} */ (featureFrom.getGeometry());
  var pointTo = /** @type {ol.geom.Point} */ (featureTo.getGeometry());

  var segment = new ol.Feature({
    geometry: new ol.geom.LineString([
      pointFrom.getCoordinates(),
      pointTo.getCoordinates()
    ])
  });

  featureFrom.set('segmentOut', segment);
  featureTo.set('segmentIn', segment);

  segment.set('from', featureFrom);
  segment.set('to', featureTo);

  return segment;
};


/**
 * Replace a segment with two new segments.
 * @param {ol.Feature} oldSegment Old segment.
 * @param {ol.Feature} newSegment1 New segment 1.
 * @param {ol.Feature} newSegment2 New segment 2.
 * @private
 */
ol.interaction.ModifyTrack.prototype.replaceSegment_ =
    function(oldSegment, newSegment1, newSegment2) {
  var oldIndex = goog.array.indexOf(this.segments, oldSegment);
  goog.array.splice(this.segments, oldIndex, 1, newSegment1, newSegment2);

  // update overlay
  this.segmentOverlay.removeFeature(oldSegment);
  this.segmentOverlay.addFeature(newSegment1);
  this.segmentOverlay.addFeature(newSegment2);

  // update snap index
  this.snapFeatures_.remove(oldSegment);
  this.snapFeatures_.push(newSegment1);
  this.snapFeatures_.push(newSegment2);
};


/**
 * Updates the connected segments after a control point was dragged.
 * @param {ol.Feature} controlPoint Point.
 * @private
 */
ol.interaction.ModifyTrack.prototype.updateControlPoint_ =
    function(controlPoint) {
  var point = /** @type {ol.geom.Point} */ (controlPoint.getGeometry());
  var segment;
  if (controlPoint.get('segmentIn') !== null) {
    segment = controlPoint.get('segmentIn');
    segment.setGeometry(new ol.geom.LineString([
      segment.get('from').getGeometry().getCoordinates(),
      point.getCoordinates()
    ]));
  }
  if (controlPoint.get('segmentOut') !== null) {
    segment = controlPoint.get('segmentOut');
    segment.setGeometry(new ol.geom.LineString([
      point.getCoordinates(),
      segment.get('to').getGeometry().getCoordinates()
    ]));
  }
};


/**
 * @param {ol.MapBrowserEvent} evt Map browser event.
 */
ol.interaction.ModifyTrack.prototype.handleDragEvent = function(evt) {
  this.wasDragged_ = true;
  var deltaX = evt.coordinate[0] - this.coordinate_[0];
  var deltaY = evt.coordinate[1] - this.coordinate_[1];

  var geometry = /** @type {ol.geom.Point} */
      (this.dragFeature_.getGeometry());
  geometry.translate(deltaX, deltaY);
  this.updateControlPoint_(this.dragFeature_);

  this.coordinate_[0] = evt.coordinate[0];
  this.coordinate_[1] = evt.coordinate[1];
};


/**
 * @param {ol.MapBrowserEvent} evt Event.
 */
ol.interaction.ModifyTrack.prototype.handleMoveEvent = function(evt) {
  if (evt.dragging) {
    return;
  }

  var map = evt.map;
  var feature = map.forEachFeatureAtPixel(evt.pixel,
      function(feature, layer) {
        if (feature === this.sketchPoint_) {
          return undefined;
        } else {
          return feature;
        }
      }, this);

  if (goog.isDef(feature)) {
    // show a larger symbol for real control-points, and a smaller one
    // for snap-points on lines
    var smallPoint = !(goog.isDef(feature.get('segmentIn')) &&
        goog.isDef(feature.get('segmentOut')));
    this.createOrUpdateSketchPoint_(evt, smallPoint);
  } else {
    this.clearSketchPoint_();
  }
};


/**
 * @private
 */
ol.interaction.ModifyTrack.prototype.clearSketchPoint_ = function() {
  if (!goog.isNull(this.sketchPoint_)) {
    this.sketchOverlay_.removeFeature(this.sketchPoint_);
    this.sketchPoint_ = null;
  }
};


/**
 * @param {ol.MapBrowserEvent} evt Map browser event.
 * @return {boolean} `false` to stop the drag sequence.
 */
ol.interaction.ModifyTrack.prototype.handleUpEvent = function(evt) {
  this.lastPoint_ = this.dragFeature_;
  if (!this.wasDragged_ && !this.insertingNewPoint_) {
    // click on control-point, remove the point
    this.removeControlPoint_(this.lastPoint_);
  } else {
    this.requestSnapPoint_(
        this.dragFeature_, this.dragFeature_,
        goog.bind(this.snapPoint_, this, this.dragFeature_));
  }
  this.coordinate_ = null;
  this.dragFeature_ = null;

  this.snapInteraction_.setActive(true);

  return false;
};


/**
 * @param {ol.Feature} pointToSnap
 * @param {ol.Feature} draggedPoint
 * @param {function(ol.geom.Point)} callback
 * @private
 */
ol.interaction.ModifyTrack.prototype.requestSnapPoint_ =
    function(pointToSnap, draggedPoint, callback) {
  var point = /** @type {ol.geom.Point} */ (pointToSnap.getGeometry());
  var location = ol.proj.transform(
      point.getCoordinates(),
      this.getMap().getView().getProjection(), 'EPSG:4326');

  var url = this.osrmLocateUrl
    .replace('{profile}', this.osrmProfile)
    .replace('{point}', location[1] + ',' + location[0]);

  goog.net.XhrIo.send(url, goog.bind(function(e) {
    var xhr = /** @type {goog.net.XhrIo} */ (e.target);
    if (this.lastPoint_ !== draggedPoint || !xhr.isSuccess()) {
      return;
    }

    var response = xhr.getResponseJson();
    if (response['status'] === 0) {
      var mappedCoordinate = response['mapped_coordinate'];
      var mappedPoint = new ol.geom.Point(ol.proj.transform(
          [mappedCoordinate[1], mappedCoordinate[0]],
          'EPSG:4326', this.getMap().getView().getProjection()));
      callback(mappedPoint);
    }
    // if the request was not successful simply keep the original point
  }, this));
};


/**
 * @param {ol.Feature} controlPoint
 * @param {ol.geom.Point} mappedPoint
 * @private
 */
ol.interaction.ModifyTrack.prototype.snapPoint_ =
    function(controlPoint, mappedPoint) {
  var pointGeom = /** @type {ol.geom.Point} */ (controlPoint.getGeometry());
  if (!this.isValidSnap(pointGeom, mappedPoint)) {
    return;
  }

  // use the mapped point
  controlPoint.setGeometry(mappedPoint);
  this.clearSketchPoint_();
  this.updateControlPoint_(controlPoint);

  // try to snap the connected segments
  if (controlPoint.get('segmentIn') !== null) {
    this.checkOnNetwork_(
        controlPoint,
        /** @type {ol.Feature} */ (controlPoint.get('segmentIn')));
  }
  if (controlPoint.get('segmentOut') !== null) {
    this.checkOnNetwork_(
        controlPoint,
        /** @type {ol.Feature} */ (controlPoint.get('segmentOut')));
  }
};


/**
 * Checks if the "other" point of a segment is on the network.
 * @param {ol.Feature} draggedPoint
 * @param {ol.Feature} segment
 * @private
 */
ol.interaction.ModifyTrack.prototype.checkOnNetwork_ =
    function(draggedPoint, segment) {
  var otherPoint = /** @type {ol.Feature} */ (
      (segment.get('from') === draggedPoint) ? segment.get('to') :
      segment.get('from'));

  this.requestSnapPoint_(
      otherPoint, draggedPoint,
      goog.bind(
          this.tryRequestRoute_, this, draggedPoint, otherPoint, segment));
};


/**
 * @param {ol.Feature} draggedPoint
 * @param {ol.Feature} otherPoint
 * @param {ol.Feature} segment
 * @param {ol.geom.Point} mappedPoint
 * @private
 */
ol.interaction.ModifyTrack.prototype.tryRequestRoute_ =
    function(draggedPoint, otherPoint, segment, mappedPoint) {
  var pointGeom = /** @type {ol.geom.Point} */ (otherPoint.getGeometry());
  if (!this.isInTolerance(pointGeom, mappedPoint, this.onNetworkTolerance)) {
    return;
  }

  // both points are on the network, request a route
  var featureFrom = /** @type {ol.Feature} */ (segment.get('from'));
  var pointFrom = /** @type {ol.geom.Point} */ (featureFrom.getGeometry());
  var from = ol.proj.transform(
      pointFrom.getCoordinates(),
      this.getMap().getView().getProjection(), 'EPSG:4326');

  var featureTo = /** @type {ol.Feature} */ (segment.get('to'));
  var pointTo = /** @type {ol.geom.Point} */ (featureTo.getGeometry());
  var to = ol.proj.transform(
      pointTo.getCoordinates(),
      this.getMap().getView().getProjection(), 'EPSG:4326');

  var url = this.osrmRoutingUrl
    .replace('{elevation}', this.elevation ? 'true' : 'false')
    .replace('{profile}', this.osrmProfile)
    .replace('{from}', from[1] + ',' + from[0])
    .replace('{to}', to[1] + ',' + to[0])
    .replace('{zoom}', '18');

  goog.net.XhrIo.send(url, goog.bind(function(e) {
    var xhr = /** @type {goog.net.XhrIo} */ (e.target);
    if (this.lastPoint_ !== draggedPoint || !xhr.isSuccess()) {
      return;
    }

    var response = xhr.getResponseJson();
    if (response['status'] === 0) {
      var format = new ol.format.Polyline({
        factor: 1e6,
        geometryLayout: this.elevation ?
            ol.geom.GeometryLayout.XYZ : ol.geom.GeometryLayout.XY
      });
      var route = format.readGeometry(response['route_geometry'], {
        dataProjection: 'EPSG:4326',
        featureProjection: this.getMap().getView().getProjection()
      });
      segment.setGeometry(route);
    }
  }, this));
};


/**
 * @param {ol.Feature} controlPoint The control point to remove.
 * @private
 */
ol.interaction.ModifyTrack.prototype.removeControlPoint_ =
    function(controlPoint) {
  var segment;
  if (controlPoint.get('segmentIn') === null) {
    // this is the first point of the track, make the next point the first one
    segment = /** @type {ol.Feature} */ (controlPoint.get('segmentOut'));
    goog.asserts.assert(!goog.isNull(segment));
    var nextPoint = /** @type {ol.Feature} */ (segment.get('to'));
    goog.asserts.assert(!goog.isNull(nextPoint));
    nextPoint.set('segmentIn', null);

    this.removeSegment_(segment);
    this.removePoint_(controlPoint);
  } else if (controlPoint.get('segmentOut') === null) {
    // this is the last point of the track, make the previous the last one
    segment = /** @type {ol.Feature} */ (controlPoint.get('segmentIn'));
    goog.asserts.assert(!goog.isNull(segment));
    var previousPoint = /** @type {ol.Feature} */ (segment.get('from'));
    goog.asserts.assert(!goog.isNull(previousPoint));
    previousPoint.set('segmentOut', null);

    this.removeSegment_(segment);
    this.removePoint_(controlPoint);
  } else {
    // the point has a predecessor and a successor, we have to create a new
    // segment between these two and remove the old segments.
    var segmentIn = /** @type {ol.Feature} */ (controlPoint.get('segmentIn'));
    var segmentOut = /** @type {ol.Feature} */ (controlPoint.get('segmentOut'));
    var pointFrom = /** @type {ol.Feature} */ (segmentIn.get('from'));
    var pointTo = /** @type {ol.Feature} */ (segmentOut.get('to'));

    segment = this.createSegment_(pointFrom, pointTo);

    // remove two old segments and insert new segment
    var oldIndex = goog.array.indexOf(this.segments, segmentIn);
    goog.array.splice(this.segments, oldIndex, 2, segment);

    this.segmentOverlay.addFeature(segment);
    this.snapFeatures_.push(segment);

    this.removeSegment_(segmentIn, false);
    this.removeSegment_(segmentOut, false);
    this.removePoint_(controlPoint);
  }
};


/**
 * @param {ol.Feature} segment The segment to remove.
 * @param {boolean=} opt_all Remove also from segment list.
 * @private
 */
ol.interaction.ModifyTrack.prototype.removeSegment_ =
    function(segment, opt_all) {
  if (!goog.isDef(opt_all) || opt_all) {
    goog.array.remove(this.segments, segment);
  }
  this.segmentOverlay.removeFeature(segment);
  this.snapFeatures_.remove(segment);
};


/**
 * @param {ol.Feature} controlPoint The control point to remove.
 * @private
 */
ol.interaction.ModifyTrack.prototype.removePoint_ =
    function(controlPoint) {
  goog.array.remove(this.controlPoints, controlPoint);
  this.pointOverlay.removeFeature(controlPoint);
  this.snapFeatures_.remove(controlPoint);
};


/**
 * @param {ol.MapBrowserEvent} event Event.
 * @param {boolean} smallPoint Show a small point?.
 * @private
 */
ol.interaction.ModifyTrack.prototype.createOrUpdateSketchPoint_ =
    function(event, smallPoint) {
  var coordinates = goog.array.slice(event.coordinate, 0, 2);
  if (goog.isNull(this.sketchPoint_)) {
    this.sketchPoint_ = new ol.Feature(new ol.geom.Point(coordinates));
    this.sketchOverlay_.setFeatures(new ol.Collection([this.sketchPoint_]));
  } else {
    var sketchPointGeom = this.sketchPoint_.getGeometry();
    goog.asserts.assertInstanceof(sketchPointGeom, ol.geom.Point,
        'sketchPointGeom should be an ol.geom.Point');
    sketchPointGeom.setCoordinates(coordinates);
  }
  this.sketchPoint_.set('small', smallPoint);
};
