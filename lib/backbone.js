var Backbone = (function() {
	if (this.Backbone) return this.Backbone;
	return require("backbone");
}).call(typeof window !== "undefined" ? window : this);

var Temple = (function() {
	if (this.Temple) return this.Temple;
	return require("templejs");
}).call(typeof window !== "undefined" ? window : this);

module.exports = function() {
	// set up events
	this.listenTo = Backbone.Events.listenTo;
	this.listenToOnce = Backbone.Events.listenToOnce;
	this.stopListening = Backbone.Events.stopListening;
	this.off = this.removeListener;
	this.trigger = this.emit;

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
			var nval; 

			for (var k in this.changed) {
				nval = this.get(k);
				self.set(k, nval, { notify: false });
				self.notify(k, nval, this.previous(k));
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
		model.off("change", this._backboneListener);
	}
}

var CollectionHandler = {
	match: function(col) {
		return col instanceof Backbone.Collection;
	},
	construct: function(col) {
		var self = this;

		col.on( 'add remove reset sort', this._backboneListener = function () {
			this.each(function(model, index) {
				var oval;

				// update index value first
				oval = self.get(index);
				if (oval !== model) {
					self.set(index, model, { notify: false });
					self.notify(index, model, oval);
				}

				// then id value first
				if (model.id) {
					oval = self.get(model.id);
					
					if (oval !== model) {
						self.set(model.id, model, { notify: false });
						self.notify(model.id, model, oval);
					}
				}
			})
			// self.notify([], col);
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
		var index = parseInt(path, 10),
			options = {};

		if (!isNaN(index) && ~index) options.at = index;
		
		col.set([ value ], options);
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
		col.off('add remove reset sort', this._backboneListener);
	}
}