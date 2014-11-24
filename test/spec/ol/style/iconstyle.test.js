goog.provide('ol.test.style.Icon');
goog.provide('ol.test.style.IconImageCache');

goog.require('ol.style.Icon');
goog.require('ol.style.IconAnchorUnits');
goog.require('ol.style.IconOrigin');


describe('ol.style.Icon', function() {
  var size = [36, 48];

  describe('#getAnchor', function() {
    var fractionAnchor = [0.25, 0.25];

    it('uses fractional units by default', function() {
      var iconStyle = new ol.style.Icon({
        src: 'test.png',
        size: size,
        anchor: fractionAnchor
      });
      expect(iconStyle.getAnchor()).to.eql([9, 12]);
    });

    it('uses pixels units', function() {
      var iconStyle = new ol.style.Icon({
        src: 'test.png',
        size: size,
        anchor: [2, 18],
        anchorXUnits: ol.style.IconAnchorUnits.PIXELS,
        anchorYUnits: ol.style.IconAnchorUnits.PIXELS
      });
      expect(iconStyle.getAnchor()).to.eql([2, 18]);
    });

    it('uses a bottom left anchor origin', function() {
      var iconStyle = new ol.style.Icon({
        src: 'test.png',
        size: size,
        anchor: fractionAnchor,
        anchorOrigin: ol.style.IconOrigin.BOTTOM_LEFT
      });
      expect(iconStyle.getAnchor()).to.eql([9, 36]);
    });

    it('uses a bottom right anchor origin', function() {
      var iconStyle = new ol.style.Icon({
        src: 'test.png',
        size: size,
        anchor: fractionAnchor,
        anchorOrigin: ol.style.IconOrigin.BOTTOM_RIGHT
      });
      expect(iconStyle.getAnchor()).to.eql([27, 36]);
    });

    it('uses a top right anchor origin', function() {
      var iconStyle = new ol.style.Icon({
        src: 'test.png',
        size: size,
        anchor: fractionAnchor,
        anchorOrigin: ol.style.IconOrigin.TOP_RIGHT
      });
      expect(iconStyle.getAnchor()).to.eql([27, 12]);
    });
  });

  describe('#getOrigin', function() {
    var offset = [16, 20];
    var imageSize = [144, 192];

    it('uses a top left offset origin (default)', function() {
      var iconStyle = new ol.style.Icon({
        src: 'test.png',
        size: size,
        offset: offset
      });
      expect(iconStyle.getOrigin()).to.eql([16, 20]);
    });

    it('uses a bottom left offset origin', function() {
      var iconStyle = new ol.style.Icon({
        src: 'test.png',
        size: size,
        offset: offset,
        offsetOrigin: ol.style.IconOrigin.BOTTOM_LEFT
      });
      iconStyle.iconImage_.size_ = imageSize;
      expect(iconStyle.getOrigin()).to.eql([16, 124]);
    });

    it('uses a bottom right offset origin', function() {
      var iconStyle = new ol.style.Icon({
        src: 'test.png',
        size: size,
        offset: offset,
        offsetOrigin: ol.style.IconOrigin.BOTTOM_RIGHT
      });
      iconStyle.iconImage_.size_ = imageSize;
      expect(iconStyle.getOrigin()).to.eql([92, 124]);
    });

    it('uses a top right offset origin', function() {
      var iconStyle = new ol.style.Icon({
        src: 'test.png',
        size: size,
        offset: offset,
        offsetOrigin: ol.style.IconOrigin.TOP_RIGHT
      });
      iconStyle.iconImage_.size_ = imageSize;
      expect(iconStyle.getOrigin()).to.eql([92, 20]);
    });
  });

  describe('#constructor', function() {

    it('it uses a separate hit detection image when tainted', function() {
      var iconStyle = new ol.style.Icon({
        src: 'http://some-other-domain.com/test1.png',
        size: [18, 18],
        offset: [12, 13]
      });
      expect(iconStyle.getSize()).to.eql([18, 18]);

      // simulate tainted image
      iconStyle.iconImage_.load();
      iconStyle.iconImage_.tainting_ = true;
      iconStyle.iconImage_.handleImageLoad_();

      expect(iconStyle.getHitDetectionImage()).not.to.eql(
          iconStyle.getImage());
      expect(iconStyle.getHitDetectionImage()).to.eql(
          ol.style.HitDetectionCanvas_.getInstance().canvas_);
      expect(iconStyle.getHitDetectionImageSize()).to.eql([32, 32]);
      expect(iconStyle.getHitDetectionOrigin()).to.eql([0, 0]);
    });

    it('it uses a separate hit detection image when tainted (already loaded)',
        function() {
          var iconStyle = new ol.style.Icon({
            src: 'http://some-other-domain.com/test2.png',
            size: [18, 18],
            offset: [12, 13]
          });
          iconStyle.iconImage_.load();
          iconStyle.iconImage_.tainting_ = true;
          iconStyle.iconImage_.handleImageLoad_();

          iconStyle = new ol.style.Icon({
            src: 'http://some-other-domain.com/test2.png',
            size: [18, 18],
            offset: [12, 13]
          });
          expect(iconStyle.getSize()).to.eql([18, 18]);

          expect(iconStyle.getHitDetectionImage()).not.to.eql(
              iconStyle.getImage());
          expect(iconStyle.getHitDetectionImage()).to.eql(
              ol.style.HitDetectionCanvas_.getInstance().canvas_);
          expect(iconStyle.getHitDetectionImageSize()).to.eql([32, 32]);
          expect(iconStyle.getHitDetectionOrigin()).to.eql([0, 0]);
        });

    it('it uses no separate hit detection image when not tainted', function() {
      var iconStyle = new ol.style.Icon({
        src: 'test3.png',
        size: [18, 18],
        offset: [12, 13]
      });
      expect(iconStyle.getSize()).to.eql([18, 18]);

      // simulate not tainted image
      iconStyle.iconImage_.load();
      iconStyle.iconImage_.image_.width = 55;
      iconStyle.iconImage_.image_.height = 55;
      iconStyle.iconImage_.handleImageLoad_();

      expect(iconStyle.getHitDetectionImage()).to.eql(
          iconStyle.getImage());
      expect(iconStyle.getHitDetectionImageSize()).to.eql([55, 55]);
      expect(iconStyle.getHitDetectionOrigin()).to.eql([12, 13]);
    });

    it('it uses no separate hit detection image when not tainted ' +
        '(already loaded)', function() {
          var iconStyle = new ol.style.Icon({
            src: 'test4.png',
            size: [18, 18],
            offset: [12, 13]
          });
          iconStyle.iconImage_.load();
          iconStyle.iconImage_.image_.width = 55;
          iconStyle.iconImage_.image_.height = 55;
          iconStyle.iconImage_.handleImageLoad_();

          iconStyle = new ol.style.Icon({
            src: 'test4.png',
            size: [18, 18],
            offset: [12, 13]
          });
          expect(iconStyle.getSize()).to.eql([18, 18]);

          expect(iconStyle.getHitDetectionImage()).to.eql(
              iconStyle.getImage());
          expect(iconStyle.getHitDetectionImageSize()).to.eql([55, 55]);
          expect(iconStyle.getHitDetectionOrigin()).to.eql([12, 13]);
        });
  });
});

describe('ol.style.IconImageCache', function() {
  var originalMaxCacheSize;

  beforeEach(function() {
    var cache = ol.style.IconImageCache.getInstance();
    cache.clear();
    originalMaxCacheSize = cache.maxCacheSize;
    cache.maxCacheSize_ = 4;
  });

  afterEach(function() {
    var cache = ol.style.IconImageCache.getInstance();
    cache.maxCacheSize_ = originalMaxCacheSize;
    cache.clear();
  });

  describe('#expire', function() {
    it('expires images when expected', function() {
      var cache = ol.style.IconImageCache.getInstance();

      var i, src, iconImage, key;

      for (i = 0; i < 4; ++i) {
        src = i + '';
        iconImage = new ol.style.IconImage_(src, null);
        cache.set(src, null, iconImage);
      }

      expect(cache.cacheSize_).to.eql(4);

      cache.expire();
      expect(cache.cacheSize_).to.eql(4);

      src = '4';
      iconImage = new ol.style.IconImage_(src, null);
      cache.set(src, null, iconImage);
      expect(cache.cacheSize_).to.eql(5);

      cache.expire(); // remove '0' and '4'
      expect(cache.cacheSize_).to.eql(3);

      src = '0';
      iconImage = new ol.style.IconImage_(src, null);
      goog.events.listen(iconImage, goog.events.EventType.CHANGE,
          goog.nullFunction, false);
      cache.set(src, null, iconImage);
      expect(cache.cacheSize_).to.eql(4);

      src = '4';
      iconImage = new ol.style.IconImage_(src, null);
      goog.events.listen(iconImage, goog.events.EventType.CHANGE,
          goog.nullFunction, false);
      cache.set(src, null, iconImage);
      expect(cache.cacheSize_).to.eql(5);

      // check that '0' and '4' are not removed from the cache
      cache.expire();
      key = ol.style.IconImageCache.getKey('0', null);
      expect(key in cache.cache_).to.be.ok();
      key = ol.style.IconImageCache.getKey('4', null);
      expect(key in cache.cache_).to.be.ok();

    });
  });
});

goog.require('goog.events');
goog.require('goog.events.EventType');
goog.require('ol.style.IconImageCache');
