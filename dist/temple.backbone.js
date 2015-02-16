/*
 * Temple Backbone
 * (c) 2014 Beneath the Ink, Inc.
 * MIT License
 * Version 1.1.2
 */

(function ( global, factory ) {

	'use strict';

	// Common JS (i.e. browserify) environment
	if ( typeof module !== 'undefined' && module.exports && typeof require === 'function' ) {
		factory( require( 'temple-mustache' ), require( 'backbone' ) );
	}

	// AMD?
	else if ( typeof define === 'function' && define.amd ) {
		define([ 'temple-mustache', 'backbone' ], factory );
	}

	// browser global
	else if ( global.Mustache && global.Backbone ) {
		factory( global.Mustache, global.Backbone );
	}

	else {
		throw new Error( 'Could not find Temple Mustache or Backbone!' );
	}

}( typeof window !== 'undefined' ? window : this, function ( Mustache, Backbone ) {

	Mustache.registerPlugin("backbone", function() {
		this.registerProxy(ModelProxy);
		this.registerProxy(CollectionProxy);
	});

	var ModelProxy = Mustache.Proxy.extend({
		constructor:  function(target, model) {
			this.target = target;
			this.model = model;

			this.target.on("change sync", this._onChange = function() {
				for (var k in this.attributes) {
					model.set(k, this.attributes[k], { reset: true });
				}
			});
		},
		isLeaf: function() { return false; },
		get: function(path) {
			return ModelProxy.get(this.target, path);
		},
		set: function(path, value) {
			this.target.set(path, value);
			return true;
		},
		keys: function() {
			return this.target.keys();
		},
		unset: function(path) {
			this.target.unset(path);
			return true;
		},
		merge: function(mixin) {
			if (!Mustache.util.isPlainObject(mixin)) return false;
			this.target.set(mixin);
			return true;
		},
		destroy: function() {
			this.target.off("change sync", this._onChange);
		}
	}, {
		match: function(target) {
			return target instanceof Backbone.Model;
		},
		get: function(target, path) {
			return target.get(path);
		}
	});

	var CollectionProxy = Mustache.Proxy.extend({
		constructor:  function(target, model) {
			this.target = target;
			this.model = model;

			var model_cache = target.toArray();
			this.set("length", target.length);

			this.listenTo(target, "add remove sort reset", function() {
				var models = target.toArray();

				models.forEach(function(m, index) {
					model.set(index.toString(), m);
					model.set(m.cid, m);
					if (m.id != null) model.set(m.id, m);
				});

				// calculate difference between old and new
				var diff = model_cache.filter(function(m) {
					return models.indexOf(m) < 0;
				});

				// remove old models
				if (diff.length) {					
					diff.forEach(function(m) {
						model.unset(m.cid);
						if (m.id != null) model.unset(m.id);
					});

					for (var i = diff.length - 1; i >= 0; i--) {
						model.unset((models.length + i).toString());
					}
				}

				model_cache = models;
				model.set("length", target.length);
			});
		},
		isLeaf: function() { return false; },
		isArray: function() { return true; },
		get: function(path) {
			return CollectionProxy.get(this.target, path);
		},
		set: function(path, value) {
			return true;
		},
		keys: function() {
			return Object.keys(this.target.toArray());
		},
		unset: function(path) {
			return true;
		},
		merge: function(mixin) {
			return false;
		},
		destroy: function() {
			this.stopListening(this.target);
		}
	}, {
		match: function(target) {
			return target instanceof Backbone.Collection;
		},
		get: function(target, path) {
			if (path === "length") return target.length;
			return target.at(path) || target.get(path);
		}
	});

}));