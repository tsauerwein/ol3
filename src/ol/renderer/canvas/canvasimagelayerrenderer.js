goog.provide('ol.renderer.canvas.ImageLayer');

goog.require('goog.asserts');
goog.require('goog.vec.Mat4');
goog.require('ol.ImageBase');
goog.require('ol.ViewHint');
goog.require('ol.dom');
goog.require('ol.extent');
goog.require('ol.layer.Image');
goog.require('ol.proj');
goog.require('ol.renderer.Map');
goog.require('ol.renderer.canvas.Layer');
goog.require('ol.source.ImageVector');
goog.require('ol.vec.Mat4');



/**
 * @constructor
 * @extends {ol.renderer.canvas.Layer}
 * @param {ol.renderer.Map} mapRenderer Map renderer.
 * @param {ol.layer.Image} imageLayer Single image layer.
 */
ol.renderer.canvas.ImageLayer = function(mapRenderer, imageLayer) {

  goog.base(this, mapRenderer, imageLayer);

  /**
   * @private
   * @type {?ol.ImageBase}
   */
  this.image_ = null;

  /**
   * @private
   * @type {!goog.vec.Mat4.Number}
   */
  this.imageTransform_ = goog.vec.Mat4.createNumber();

  /**
   * @private
   * @type {?goog.vec.Mat4.Number}
   */
  this.imageTransformInv_ = null;

  /**
   * @private
   * @type {CanvasRenderingContext2D}
   */
  this.hitCanvasContext_ = null;

};
goog.inherits(ol.renderer.canvas.ImageLayer, ol.renderer.canvas.Layer);


/**
 * @inheritDoc
 */
ol.renderer.canvas.ImageLayer.prototype.forEachFeatureAtPixel =
    function(coordinate, frameState, callback, thisArg) {
  var layer = this.getLayer();
  var source = layer.getSource();
  var resolution = frameState.viewState.resolution;
  var rotation = frameState.viewState.rotation;
  var skippedFeatureUids = frameState.skippedFeatureUids;
  return source.forEachFeatureAtPixel(
      resolution, rotation, coordinate, skippedFeatureUids,
      /**
       * @param {ol.Feature} feature Feature.
       * @return {?} Callback result.
       */
      function(feature) {
        return callback.call(thisArg, feature, layer);
      });
};


/**
 * @inheritDoc
 */
ol.renderer.canvas.ImageLayer.prototype.forEachLayerAtPixel =
    function(coordinate, frameState, callback, thisArg) {
  if (goog.isNull(this.getImage())) {
    return undefined;
  }

  if (this.getLayer().getSource() instanceof ol.source.ImageVector) {
    // for ImageVector sources use the original hit-detection logic,
    // so that for example also transparent polygons are detected
    var hasFeature = this.forEachFeatureAtPixel(
        coordinate, frameState, goog.functions.TRUE, this);

    if (hasFeature) {
      return callback.call(thisArg, this.getLayer());
    } else {
      return undefined;
    }
  } else {
    // for all other image sources directly check the image
    if (goog.isNull(this.imageTransformInv_)) {
      this.imageTransformInv_ = goog.vec.Mat4.createNumber();
      goog.vec.Mat4.invert(this.imageTransform_, this.imageTransformInv_);
    }

    var pixelOnCanvas =
        this.getPixelFromCoordinates(coordinate, this.imageTransformInv_);

    if (goog.isNull(this.hitCanvasContext_)) {
      this.hitCanvasContext_ = ol.dom.createCanvasContext2D(1, 1);
    }

    this.hitCanvasContext_.clearRect(0, 0, 1, 1);
    this.hitCanvasContext_.drawImage(
        this.getImage(), pixelOnCanvas[0], pixelOnCanvas[1], 1, 1, 0, 0, 1, 1);

    var imageData = this.hitCanvasContext_.getImageData(0, 0, 1, 1).data;
    if (imageData[3] > 0) {
      return callback.call(thisArg, this.getLayer());
    } else {
      return undefined;
    }
  }
};


/**
 * @inheritDoc
 */
ol.renderer.canvas.ImageLayer.prototype.getImage = function() {
  return goog.isNull(this.image_) ?
      null : this.image_.getImage();
};


/**
 * @inheritDoc
 */
ol.renderer.canvas.ImageLayer.prototype.getImageTransform = function() {
  return this.imageTransform_;
};


/**
 * @inheritDoc
 */
ol.renderer.canvas.ImageLayer.prototype.prepareFrame =
    function(frameState, layerState) {

  var pixelRatio = frameState.pixelRatio;
  var viewState = frameState.viewState;
  var viewCenter = viewState.center;
  var viewResolution = viewState.resolution;
  var viewRotation = viewState.rotation;

  var image;
  var imageLayer = this.getLayer();
  goog.asserts.assertInstanceof(imageLayer, ol.layer.Image);
  var imageSource = imageLayer.getSource();

  var hints = frameState.viewHints;

  var renderedExtent = frameState.extent;
  if (goog.isDef(layerState.extent)) {
    renderedExtent = ol.extent.getIntersection(
        renderedExtent, layerState.extent);
  }

  if (!hints[ol.ViewHint.ANIMATING] && !hints[ol.ViewHint.INTERACTING] &&
      !ol.extent.isEmpty(renderedExtent)) {
    var projection = viewState.projection;
    var sourceProjection = imageSource.getProjection();
    if (!goog.isNull(sourceProjection)) {
      goog.asserts.assert(ol.proj.equivalent(projection, sourceProjection));
      projection = sourceProjection;
    }
    image = imageSource.getImage(
        renderedExtent, viewResolution, pixelRatio, projection);
    if (!goog.isNull(image)) {
      var loaded = this.loadImage(image);
      if (loaded) {
        this.image_ = image;
      }
    }
  }

  if (!goog.isNull(this.image_)) {
    image = this.image_;
    var imageExtent = image.getExtent();
    var imageResolution = image.getResolution();
    var imagePixelRatio = image.getPixelRatio();
    var scale = pixelRatio * imageResolution /
        (viewResolution * imagePixelRatio);
    ol.vec.Mat4.makeTransform2D(this.imageTransform_,
        pixelRatio * frameState.size[0] / 2,
        pixelRatio * frameState.size[1] / 2,
        scale, scale,
        viewRotation,
        imagePixelRatio * (imageExtent[0] - viewCenter[0]) / imageResolution,
        imagePixelRatio * (viewCenter[1] - imageExtent[3]) / imageResolution);
    this.imageTransformInv_ = null;
    this.updateAttributions(frameState.attributions, image.getAttributions());
    this.updateLogos(frameState, imageSource);
  }

  return true;
};
