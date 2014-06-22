/*
 * Temple Backbone
 * (c) 2014 Beneath the Ink, Inc.
 * MIT License
 * Version 1.0.4
 */

!function(e){if("object"==typeof exports&&"undefined"!=typeof module)module.exports=e();else if("function"==typeof define&&define.amd)define([],e);else{var f;"undefined"!=typeof window?f=window:"undefined"!=typeof global?f=global:"undefined"!=typeof self&&(f=self),(f.Temple||(f.Temple={})).Backbone=e()}}(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(_dereq_,module,exports){
var Backbone = (function() {
	if (this.Backbone) return this.Backbone;
	return _dereq_("backbone");
}).call(typeof window !== "undefined" ? window : this);

var Temple = (function() {
	if (this.Temple) return this.Temple;
	return _dereq_("templejs");
}).call(typeof window !== "undefined" ? window : this);

module.exports = function() {
	// attach handlers
	this.handle(ModelHandler);
	this.handle(CollectionHandler);
}

var ModelHandler = {
	match: function(model) {
		return model instanceof Backbone.Model;
	},
	construct: function(model) {
		this.listenTo(model, "change", function() {
			for (var k in model.changed) this.set(k, model.changed[k]);
		});
	},
	isLeaf: function() { return false; },
	get: function(model, path) {
		return model.get(path);
	},
	set: function(model, path, value) {
		model.set(path, value);
		return true;
	},
	keys: function(model) {
		return model.keys();
	},
	merge: function(model, mixin) {
		if (!Temple.util.isPlainObject(mixin)) return false;
		for (var k in mixin) this.set(k, mixin[k]);
		return true;
	},
	deleteProperty: function(model, path) {
		model.unset(path);
		return true;
	},
	destroy: function(model) {
		this.stopListening(model);
	}
}

var CollectionHandler = {
	match: function(col) {
		return col instanceof Backbone.Collection;
	},
	construct: function(col) {
		var self = this,
			model_cache = col.toArray();

		this.set("length", col.length);
		
		function setModel(model, index, remove) {
			var method, val;

			if (remove) {
				method = "unset";
				val = { remove: true };
			} else {
				method = "set";
				val = model;
			}

			self[method](index, val);
			self[method](model.cid, val);
			if (model.id != null) self[method](model.id, val);
		}

		function setAllModels() {
			var m = model_cache = col.toArray();
			m.forEach(function(model, index) {
				setModel(model, index, false);
			});
		}

		this.listenTo(col, {
			add: function(model) {
				var index = col.indexOf(model);
				setModel(model, index, false);
				self.set("length", col.length);
				model_cache.splice(index, 0, model);
			},
			remove: function(model) {
				var index = model_cache.indexOf(model);
				if (!~index) return;
				setModel(model, index, true);
				self.set("length", col.length);
				model_cache.splice(index, 1);
			},
			sort: setAllModels,
			reset: function() {
				model_cache.forEach(function(model, index) {
					setModel(model, index, true);
				});

				addAllModels();
				self.set("length", col.length);
			}
		});
	},
	isLeaf: function() { return false; },
	toArray: function(col) {
		return col.toArray();
	},
	get: function(col, path) {
		if (path === "length") return col.length;
		return col.at(path) || col.get(path);
	},
	set: function(col, path, value) {
		return true;
	},
	keys: function(col) {
		return Object.keys(col.toArray());
	},
	merge: function(col, mixin) {
		return false;
	},
	deleteProperty: function(col, path) {
		var model = col.at(path) || col.get(path);
		col.remove(model);
		return true;
	},
	destroy: function(col) {
		this.stopListening(col);
	}
}
},{"templejs":"+QSU3/"}]},{},[1])
(1)
});