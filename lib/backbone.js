(function ( global, factory ) {

	'use strict';

	// Common JS (i.e. browserify) environment
	if ( typeof module !== 'undefined' && module.exports && typeof require === 'function' ) {
		module.exports = factory( require( 'temple-mustache' ), require( 'backbone' ) );
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

	Mustache.Backbone = {};

	// the issue with NPM dependencies is that sometimes we get a real Backbone
	// model or collection that did not originate from the same Backbone library
	// as this one. A simple instanceof check on this value will fail even
	// though our code can handle it just fine. Instead, we'll use duck type
	// checking to detect features so any Backbone-looking object will pass.
	var isModel =
	Mustache.util.isModel =
	Mustache.Backbone.isModel = function(val) {
		return val instanceof Backbone.Model || (
			val != null &&
			typeof val.cid === "string" &&
			typeof val.attributes === "object" &&
			typeof val.get === "function" &&
			typeof val.set === "function"
		);
	}

	var isCollection =
	Mustache.util.isCollection =
	Mustache.Backbone.isCollection = function(val) {
		return val instanceof Backbone.Collection || (
			val != null &&
			Array.isArray(val.models) &&
			typeof val.model === "function" &&
			typeof val.add === "function" &&
			typeof val.remove === "function"
		);
	}

	Mustache.Backbone.track = function(val) {
		if (isModel(val)) return trackModel(val);
		if (isCollection(val)) return trackCollection(val);
		throw new Error("Expecting Backbone model or collection to track.");
	}

	var ModelProxy = Mustache.Backbone.ModelProxy = {
		match: function(target) {
			return target instanceof Backbone.Model;
		},
		get: function(target, path) {
			return target.get(path);
		}
	}

	var trackModel = Mustache.Backbone.trackModel = function(obj) {
		if (obj._deps != null) return obj;
		obj._deps = {};
		var onChange;

		obj.on("change", onChange = function() {
			Object.keys(this.changedAttributes()).forEach(function(k) {
				if (obj._deps[k] != null) obj._deps[k].changed();
			});
		});

		var getter = obj.get;
		obj.get = function(k, options) {
			if (options == null || options.depend !== false) {
				if (obj._deps[k] == null) obj._deps[k] = new Mustache.Dependency();
				obj._deps[k].depend();
			}

			return getter.apply(this, arguments);
		}

		obj.removeTracking = function() {
			obj.off("change", onChange);
			obj.get = getter;
			delete obj.removeTracking;
			return obj;
		}

		return obj;
	}

	var CollectionProxy = Mustache.Backbone.CollectionProxy = {
		isList: true,
		match: function(t) { return isCollection(t); },
		get: function(t, k) {
			if (k === "length") return this.length(t);
			var n = parseInt(k, 10);
			return n == k ? t.at(n) : t.get(k);
		},
		length:  function(t) {
			return typeof t.$length === "function" ? t.$length() : t.length;
		},
		keys: function(t) {
			var len = this.length(t), keys = [];
			while (len--) { keys.unshift(len); }
			return keys;
		},
		isEmpty: function(t) {
			return !!this.length(t);
		}
	}

	var trackCollection = Mustache.Backbone.trackCollection = function(obj) {
		if (obj._deps != null) return obj;
		var deps = obj._deps = {};
		
		var onChange;
		var model_cache = obj.map(function(m) { return m.cid; });

		obj.on("add remove sort reset", onChange = function() {
			var models = obj.map(function(m) { return m.cid; });
			var changed = [];

			// determine which indexes were modified
			for (var i = 0; i < Math.max(models.length, model_cache.length); i++) {
				if (models[i] !== model_cache[i] && deps[i]) deps[i].changed();
			}

			// get added models
			models.forEach(function(cid, i) {
				if (model_cache.indexOf(cid) < 0 &&
					changed.indexOf(cid) < 0) changed.push(cid);
			});

			// get removed models
			model_cache.forEach(function(cid) {
				if (models.indexOf(cid) < 0 &&
					changed.indexOf(cid) < 0) changed.push(cid);
			});

			// notify of all changed ids and cids
			changed.forEach(function(cid) {
				if (deps[cid]) deps[cid].changed();
				var id = this._byId[cid] && this._byId[cid].id;
				if (id && deps[id]) deps[id].changed();
			}, this);
		});

		var getter = obj.get;
		obj.get = function(k, options) {
			if (options == null || options.depend !== false) {
				if (obj._deps[k] == null) obj._deps[k] = new Mustache.Dependency();
				obj._deps[k].depend();
			}

			return getter.apply(this, arguments);
		}

		var atter = obj.at;
		obj.at = function(i, options) {
			if (options == null || options.depend !== false) {
				if (obj._deps[i] == null) obj._deps[i] = new Mustache.Dependency();
				obj._deps[i].depend();
			}

			return atter.apply(this, arguments);
		}

		obj.removeTracking = function() {
			obj.off("add remove sort reset", onChange);
			obj.get = getter;
			obj.at = atter;
			delete obj.removeTracking;
			return obj;
		}

		return obj;
	}

}));