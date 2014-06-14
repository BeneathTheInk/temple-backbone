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

	// set up events
	this.listenTo = Backbone.Events.listenTo;
	this.listenToOnce = Backbone.Events.listenToOnce;
	this.stopListening = Backbone.Events.stopListening;
	this.off = this.removeListener;
	this.trigger = this.emit;

	// clean up
	this.once("destroy", function() {
		this.stopListening();
	});
}

var ModelHandler = {
	match: function(model) {
		return model instanceof Backbone.Model;
	},
	construct: function(model) {
		var self = this;

		model.on("change", this._backboneListener = function() {
			for (var k in this.changed) {
				self.notify(k, this.changed[k], this.previous(k));
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
		this.set("length", col.length);
		
		col.on( 'add remove reset sort', this._backboneListener = function () {
			this.toArray().forEach(function(model, index) {
				var oval;

				oval = self.get(index);
				if (oval !== model) self.notify(index, model, oval);


				if (model.id != null) {
					oval = self.get(model.id);
					if (oval !== model) self.notify(model.id, model, oval);
				}

				oval = self.get(model.cid);
				if (oval !== model) self.notify(model.cid, model, oval);
			});

			self.notify("length", col.length);
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
		if (path === "length") return false;

		var model = col.at(path) || col.get(path);
		
		if (model == null || value instanceof Backbone.Model) {
			col.set([ value ], { remove: false });
		} else {
			model.set(value);
		}

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