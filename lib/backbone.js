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
		var self = this;

		model.on("change", this._backboneListener = function() {
			for (var k in this.changed) self.set(k, this.changed[k]);
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
		model.off("change", this._backboneListener);
	}
}

var CollectionHandler = {
	match: function(col) {
		return col instanceof Backbone.Collection;
	},
	construct: function(col) {
		var self = this;
		this.set("length", col.length);
		
		col.on( 'add remove reset sort', this._backboneListener = function () {
			this.toArray().forEach(function(model, index) {
				self.set(index, model);
				self.set(model.cid, model);
				if (model.id != null) self.set(model.id, model);
			});

			self.set("length", col.length);
		});
	},
	isLeaf: function() { return false; },
	toArray: function(col) {
		return col.toArray();
	},
	get: function(col, path) {
		return col.at(path) || col.get(path);
	},
	set: function(col, path, value) {
		return false;
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
		col.off('add remove reset sort', this._backboneListener);
	}
}