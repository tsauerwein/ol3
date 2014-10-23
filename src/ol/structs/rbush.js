// Based on rbush https://github.com/mourner/rbush
// Copyright (c) 2013 Vladimir Agafonkin
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
// THE SOFTWARE.

// FIXME bulk inserts
// FIXME is level argument needed to insert_?

goog.provide('ol.structs.RBush');

goog.require('goog.array');
goog.require('goog.asserts');
goog.require('goog.object');
goog.require('ol.extent');



/**
 * @constructor
 * @param {number=} opt_maxEntries Max entries.
 * @see https://github.com/mourner/rbush
 * @struct
 * @template T
 */
ol.structs.RBush = function(opt_maxEntries) {

  /**
   * @private
   * @type {rbush}
   */
  this.rbush_ = rbush(opt_maxEntries);

  /**
   * @private
   * @type {Object.<T, Object>}
   */
  this.items_ = {};

  if (goog.DEBUG) {
    /**
     * @private
     * @type {number}
     */
    this.readers_ = 0;
  }

};


/**
 * FIXME empty description for jsdoc
 */
ol.structs.RBush.prototype.clear = function() {
  this.rbush_.clear();
  goog.object.clear(this.items_);
};


/**
 * Calls a callback function with each node in the tree. Inside the callback,
 * no tree modifications (insert, update, remove) can be made.
 * If the callback returns a truthy value, this value is returned without
 * checking the rest of the tree.
 * @param {function(this: S, T): *} callback Callback.
 * @param {S=} opt_this The object to use as `this` in `callback`.
 * @return {*} Callback return value.
 * @template S
 */
ol.structs.RBush.prototype.forEach = function(callback, opt_this) {
  if (goog.DEBUG) {
    ++this.readers_;
    try {
      return this.forEach_(this.root_, callback, opt_this);
    } finally {
      --this.readers_;
    }
  } else {
    return this.forEach_(this.root_, callback, opt_this);
  }
};



/**
 * Calls a callback function with each node in the provided extent. Inside the
 * callback, no tree modifications (insert, update, remove) can be made.
 * @param {ol.Extent} extent Extent.
 * @param {function(this: S, T): *} callback Callback.
 * @param {S=} opt_this The object to use as `this` in `callback`.
 * @return {*} Callback return value.
 * @template S
 */
ol.structs.RBush.prototype.forEachInExtent =
    function(extent, callback, opt_this) {
  if (goog.DEBUG) {
    ++this.readers_;
    try {
      return this.forEachInExtent_(extent, callback, opt_this);
    } finally {
      --this.readers_;
    }
  } else {
    return this.forEachInExtent_(extent, callback, opt_this);
  }
};


/**
 * @return {Array.<T>} All.
 */
ol.structs.RBush.prototype.getAll = function() {
  var items = this.rbush_.getAll();
  return goog.array.map(items, function(item) {
    return item[4];
  });
};


/**
 * @param {ol.Extent} extent Extent.
 * @return {Array.<T>} All in extent.
 */
ol.structs.RBush.prototype.getInExtent = function(extent) {
  var items = this.rbush_.search(extent);
  return goog.array.map(items, function(item) {
    return item[4];
  });
};


/**
 * @param {ol.Extent=} opt_extent Extent.
 * @return {ol.Extent} Extent.
 */
ol.structs.RBush.prototype.getExtent = function(opt_extent) {
  return ol.extent.returnOrUpdate(this.root_.extent, opt_extent);
};


/**
 * @param {ol.Extent} extent Extent.
 * @param {T} value Value.
 */
ol.structs.RBush.prototype.insert = function(extent, value) {
  if (goog.DEBUG && this.readers_) {
    throw new Error('cannot insert value while reading');
  }

  var item = [
    extent[0],
    extent[1],
    extent[2],
    extent[3],
    value
  ];

  this.rbush_.insert(item);
  goog.object.add(this.items_, value, item);
};



/**
 * @return {boolean} Is empty.
 */
ol.structs.RBush.prototype.isEmpty = function() {
  return goog.object.isEmpty(this.items_);
};


/**
 * @param {T} value Value.
 * @return {boolean} Removed.
 */
ol.structs.RBush.prototype.remove = function(value) {
  if (goog.DEBUG && this.readers_) {
    throw new Error('cannot remove value while reading');
  }
  goog.asserts.assert(goog.object.containsKey(this.items_, value));
  var item = goog.object.get(this.items_, value);
  goog.object.remove(this.items_, value);
  return this.rbush_.remove(item) !== null;
};


/**
 * @param {ol.Extent} extent Extent.
 * @param {T} value Value.
 */
 // TODO check if this is needed
ol.structs.RBush.prototype.update = function(extent, value) {
  var key = this.getKey_(value);
  var currentExtent = this.valueExtent_[key];
  goog.asserts.assert(goog.isDef(currentExtent));
  if (!ol.extent.equals(currentExtent, extent)) {
    if (goog.DEBUG && this.readers_) {
      throw new Error('cannot update extent while reading');
    }
    var removed = this.remove_(currentExtent, value);
    goog.asserts.assert(removed);
    this.insert_(extent, value, this.root_.height - 1);
    this.valueExtent_[key] = ol.extent.clone(extent, currentExtent);
  }
};
