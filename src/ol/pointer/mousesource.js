// Based on https://github.com/Polymer/PointerEvents

// Copyright (c) 2013 The Polymer Authors. All rights reserved.
//
// Redistribution and use in source and binary forms, with or without
// modification, are permitted provided that the following conditions are
// met:
//
// * Redistributions of source code must retain the above copyright
// notice, this list of conditions and the following disclaimer.
// * Redistributions in binary form must reproduce the above
// copyright notice, this list of conditions and the following disclaimer
// in the documentation and/or other materials provided with the
// distribution.
// * Neither the name of Google Inc. nor the names of its
// contributors may be used to endorse or promote products derived from
// this software without specific prior written permission.
//
// THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS
// "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT
// LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR
// A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT
// OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
// SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT
// LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
// DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY
// THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
// (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
// OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.

goog.provide('ol.pointer.MouseSource');

goog.require('ol.pointer.EventSource');



/**
 * @param {ol.pointer.PointerEventHandler} dispatcher
 * @constructor
 * @extends {ol.pointer.EventSource}
 */
ol.pointer.MouseSource = function(dispatcher) {
  goog.base(this, dispatcher);

  this.pointerMap = dispatcher.pointerMap;

  // radius around touchend that swallows mouse events
  this.DEDUP_DIST = 25;

  this.POINTER_ID = 1;
  this.POINTER_TYPE = 'mouse';

  this.events = [
    'mousedown',
    'mousemove',
    'mouseup',
    'mouseover',
    'mouseout'
  ];
  this.mapping = {
    'mousedown': this.mousedown,
    'mousemove': this.mousemove,
    'mouseup': this.mouseup,
    'mouseover': this.mouseover,
    'mouseout': this.mouseout
  };

  this.lastTouches = [];
};
goog.inherits(ol.pointer.MouseSource, ol.pointer.EventSource);


/** @inheritDoc */
ol.pointer.MouseSource.prototype.getEvents = function() {
  return this.events;
};


/** @inheritDoc */
ol.pointer.MouseSource.prototype.getMapping = function() {
  return this.mapping;
};


/**
 * Collide with the global mouse listener
 *
 * @private
 * @param {goog.events.BrowserEvent} inEvent
 * @return {boolean} True, if the event was generated by a touch.
 */
ol.pointer.MouseSource.prototype.isEventSimulatedFromTouch_ =
    function(inEvent) {
  var lts = this.lastTouches;
  var x = inEvent.clientX, y = inEvent.clientY;
  for (var i = 0, l = lts.length, t; i < l && (t = lts[i]); i++) {
    // simulated mouse events will be swallowed near a primary touchend
    var dx = Math.abs(x - t.x), dy = Math.abs(y - t.y);
    if (dx <= this.DEDUP_DIST && dy <= this.DEDUP_DIST) {
      return true;
    }
  }
  return false;
};


/**
 * Creates a copy of the original event that will be used
 * for the fake pointer event.
 *
 * @private
 * @param {goog.events.BrowserEvent} inEvent
 * @return {Object}
 */
ol.pointer.MouseSource.prototype.prepareEvent_ = function(inEvent) {
  var e = this.dispatcher.cloneEvent(inEvent);

  // forward mouse preventDefault
  var pd = e.preventDefault;
  e.preventDefault = function() {
    inEvent.preventDefault();
    pd();
  };

  e.pointerId = this.POINTER_ID;
  e.isPrimary = true;
  e.pointerType = this.POINTER_TYPE;

  return e;
};


/**
 * Handler for `mousedown`.
 *
 * @param {goog.events.BrowserEvent} inEvent
 */
ol.pointer.MouseSource.prototype.mousedown = function(inEvent) {
  if (!this.isEventSimulatedFromTouch_(inEvent)) {
    var p = this.pointerMap.containsKey(this.POINTER_ID);
    // TODO(dfreedman) workaround for some elements not sending mouseup
    // http://crbug/149091
    if (p) {
      this.cancel(inEvent);
    }
    var e = this.prepareEvent_(inEvent);
    this.pointerMap.set(this.POINTER_ID, inEvent);
    this.dispatcher.down(e);
  }
};


/**
 * Handler for `mousemove`.
 *
 * @param {goog.events.BrowserEvent} inEvent
 */
ol.pointer.MouseSource.prototype.mousemove = function(inEvent) {
  if (!this.isEventSimulatedFromTouch_(inEvent)) {
    var e = this.prepareEvent_(inEvent);
    this.dispatcher.move(e);
  }
};


/**
 * Handler for `mouseup`.
 *
 * @param {goog.events.BrowserEvent} inEvent
 */
ol.pointer.MouseSource.prototype.mouseup = function(inEvent) {
  if (!this.isEventSimulatedFromTouch_(inEvent)) {
    var p = this.pointerMap.get(this.POINTER_ID);

    if (p && p.button === inEvent.button) {
      var e = this.prepareEvent_(inEvent);
      this.dispatcher.up(e);
      this.cleanupMouse();
    }
  }
};


/**
 * Handler for `mouseover`.
 *
 * @param {goog.events.BrowserEvent} inEvent
 */
ol.pointer.MouseSource.prototype.mouseover = function(inEvent) {
  if (!this.isEventSimulatedFromTouch_(inEvent)) {
    var e = this.prepareEvent_(inEvent);
    this.dispatcher.enterOver(e);
  }
};


/**
 * Handler for `mouseout`.
 *
 * @param {goog.events.BrowserEvent} inEvent
 */
ol.pointer.MouseSource.prototype.mouseout = function(inEvent) {
  if (!this.isEventSimulatedFromTouch_(inEvent)) {
    var e = this.prepareEvent_(inEvent);
    this.dispatcher.leaveOut(e);
  }
};


/**
 * Dispatches a `pointercancel` event.
 *
 * @param {goog.events.BrowserEvent} inEvent
 */
ol.pointer.MouseSource.prototype.cancel = function(inEvent) {
  var e = this.prepareEvent_(inEvent);
  this.dispatcher.cancel(e);
  this.cleanupMouse();
};


/**
 * Remove the mouse from the list of active pointers.
 */
ol.pointer.MouseSource.prototype.cleanupMouse = function() {
  this.pointerMap.remove(this.POINTER_ID);
};
