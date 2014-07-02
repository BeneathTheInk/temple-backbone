var Backbone = (function() {
	if (this.Backbone) return this.Backbone;
	return require("backbone");
}).call(typeof window !== "undefined" ? window : this);

var Temple = (function() {
	if (this.Temple) return this.Temple;
	return require("templejs");
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
			for (var k in model.changed) {
				this.set(k, model.changed[k], { reset: true });
			}
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

		this.listenTo(col, "add remove sort reset", function() {
			var models = col.toArray();

			models.forEach(function(model, index) {
				self.set(index.toString(), model);
				self.set(model.cid, model);
				if (model.id != null) self.set(model.id, model);
			});

			// calculate difference between old and new
			var diff = model_cache.filter(function(model) {
				return models.indexOf(model) < 0;
			});

			// remove old models
			if (diff.length) {
				diff.forEach(function(model) {
					self.unset(model.cid);
					if (model.id != null) self.unset(model.id);
				});

				for (var i = 0; i < diff.length; i++) {
					self.unset((models.length + i).toString());
				}
			}

			model_cache = models;
			self.set("length", col.length);
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
		return true;
	},
	destroy: function(col) {
		this.stopListening(col);
	}
}