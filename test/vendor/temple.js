/*
 * Temple
 * (c) 2014 Beneath the Ink, Inc.
 * MIT License
 * Version 0.2.9-rc1
 */

!function(e){if("object"==typeof exports&&"undefined"!=typeof module)module.exports=e();else if("function"==typeof define&&define.amd)define([],e);else{var f;"undefined"!=typeof window?f=window:"undefined"!=typeof global?f=global:"undefined"!=typeof self&&(f=self),f.Temple=e()}}(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(_dereq_,module,exports){
var _ = _dereq_("underscore"),
	Binding = _dereq_("./index");

module.exports = Binding.extend({
	constructor: function(view) {
		if (_.isFunction(view)) view = new view();
		if (!(view instanceof _dereq_("../temple"))) throw new Error("Expecting subclass or instance of Temple for component.");

		this.view = view;
		this.previousScope = null;

		Binding.call(this);
	},

	addChild: function() {
		throw new Error("Component bindings cannot have children.");
	},

	clean: function() {
		if (this.previousScope != null)
			this.view.removeModel(this.previousScope);

		return this;
	},

	render: function(scope) {
		this.clean();
		this.previousScope = scope;
		this.view.addModel(scope);
		this.view.forceUpdate();
		return this;
	},

	appendTo: function(parent, before) {
		this.view.paint(parent, before);
		return this;
	},

	toString: function() {
		return this.view.toString();
	},

	find: function(selector) {
		return this.view.find(selector);
	},

	findAll: function(selector) {
		return this.view.findAll(selector);
	},

	destroy: function() {
		this.clean();
		this.view.erase();
		return Binding.prototype.destroy.apply(this, arguments);
	}
});
},{"../temple":18,"./index":6,"underscore":25}],2:[function(_dereq_,module,exports){
var _ = _dereq_("underscore"),
	Binding = _dereq_("./index"),
	util = _dereq_("../util"),
	Scope = _dereq_("../scope"),
	Model = _dereq_("../model");

var Context =
module.exports = Binding.extend({
	constructor: function(path) {
		if (!_.isString(path))
			throw new Error("Expecting string path.");

		this.path = path;
		this.scope = null;

		Binding.call(this, _.toArray(arguments).slice(1));
	},

	cleanScope: function() {
		if (this.scope != null) {
			this.scope.destroy();
			delete this.scope;
		}

		return this;
	},

	render: function(scope) {
		this.cleanScope();
		this.scope = scope.createScopeFromPath(this.path);
		return Binding.prototype.render.call(this, this.scope);
	},

	destroy: function() {
		this.cleanScope();
		return Binding.prototype.destroy.apply(this, arguments);
	}
});
},{"../model":10,"../scope":17,"../util":20,"./index":6,"underscore":25}],3:[function(_dereq_,module,exports){
var _ = _dereq_("underscore"),
	Binding = _dereq_("./index"),
	util = _dereq_("../util"),
	Context = _dereq_("./context"),
	Deps = _dereq_("../deps"),
	Scope = _dereq_("../scope"),
	Model = _dereq_("../model");

module.exports = Binding.extend({
	constructor: function(path, body) {
		if (!_.isString(path))
			throw new Error("Expecting string path.");

		if (!_.isFunction(body))
			throw new Error("Expecting function for body.");

		this.path = path;
		this.body = function() {
			var args = arguments, ctx = this;
			return Deps.nonreactive(function() {
				return body.apply(ctx, args);
			});
		}
		this.rows = {};
		this.placeholder = document.createComment(_.uniqueId("$"));

		Binding.call(this);
	},

	addChild: function() {
		throw new Error("Each bindings can't have children.");
	},

	updateRow: function(key, scope) {
		var row, nscope;

		row = this.rows[key];
		if (row == null) {
			row = this.rows[key] = {
				binding: new Binding(this.body(key))
			};
		}

		this.clearScope(row);
		nscope = row.scope = scope.createScopeFromPath(util.joinPathParts(this.path, key));
		nscope.setHidden("$key", key);
		row.binding.render(nscope);

		return this;
	},

	refreshRows: function() {
		_.each(this.rows, function(row) {
			var parent = this.placeholder.parentNode;
			if (parent != null) row.binding.appendTo(parent, this.placeholder);
		}, this);
		
		return this;
	},

	removeRow: function(key) {
		var row = this.rows[key];
		
		if (row != null) {
			this.clearScope(row);
			row.binding.destroy();
			delete this.rows[key];
		}

		return this;
	},

	removeAllRows: function(key) {
		_.keys(this.rows).forEach(this.removeRow, this);
		this.rows = {};
		return this;
	},

	clearScope: function(row) {
		if (row.scope) {
			row.scope.destroy();
			delete row.scope;
		}

		return this;
	},

	dependOn: function(scope) {
		if (this._stopDepending) this._stopDepending();
		
		var parts, onChange;
		parts = util.splitPath(this.path);

		onChange = (function(s) {
			var keypath = util.splitPath(s.path),
				extra;

			if (!util.arrayStartsWith(keypath, parts)) return;
			extra = keypath.slice(parts.length);
			
			if (!extra.length) {
				this.render(scope);
			} else if (s.type === "delete") {
				this.removeRow(extra[0]);
			} else if (_.contains(scope.keys(parts), extra[0])) {
				this.updateRow(extra[0], scope);
				this.refreshRows();
			}
		}).bind(this);

		scope.observe(this.path, onChange);
		scope.observe(util.joinPathParts(this.path, "*"), onChange);

		this._stopDepending = (function() {
			scope.stopObserving(onChange);
			delete this._stopDepending;
		}).bind(this);

		return this;
	},

	render: function(scope) {
		var model = (scope.findModel(this.path) || scope).getModel(this.path),
			keys = model.keys(),
			toRemove = [];

		this.execDirectives(scope);
		this.dependOn(scope);

		keys.forEach(function(k) {
			this.updateRow(k, scope);
		}, this);

		// remove all rows except for keys
		_.keys(this.rows).filter(function(k) {
			return !_.contains(keys, k);
		}).forEach(function(k) {
			this.removeRow(k);
		}, this);

		// update all positions
		this.refreshRows();

		return this;
	},

	appendTo: function(parent, before) {
		parent.insertBefore(this.placeholder, before);
		this.refreshRows();
		return this;
	},

	find: function(selector) {
		var el = null;

		_.some(this.rows, function(row) {
			return !!(el = row.binding.find(selector));
		});

		return el;
	},

	findAll: function(selector) {
		var els = [];

		_.each(this.rows, function(row) {
			els = els.concat(row.binding.findAll(selector));
		});

		return els;
	},

	destroy: function() {
		if (this._stopDepending) this._stopDepending();
		
		this.removeAllRows();
		var parent = this.placeholder.parentNode;
		if (parent != null) parent.removeChild(this.placeholder);

		return Binding.prototype.destroy.apply(this, arguments);
	}
});
},{"../deps":8,"../model":10,"../scope":17,"../util":20,"./context":2,"./index":6,"underscore":25}],4:[function(_dereq_,module,exports){
var _ = _dereq_("underscore"),
	util = _dereq_("../util"),
	Binding = _dereq_("./index");

module.exports = Binding.extend({
	constructor: function(tagname) {
		if (!_.isString(tagname))
			throw new Error("Expecting string for element binding tag name.");

		this.tagname = tagname;
		this.attributes = {};
		this.node = document.createElement(tagname);
		
		// when children are added, append to element
		this.on("child:add", function(child) {
			child.appendTo(this.node);
		});

		Binding.call(this, _.toArray(arguments).slice(1));
	},

	appendTo: function(parent, before) {
		parent.insertBefore(this.node, before);
		return this;
	},

	toString: function() {
		return this.node.outerHTML;
	},

	find: function(selector) {
		if (util.matchSelector(this.node, selector)) return this.node;
		return Binding.prototype.find.apply(this, arguments);
	},

	findAll: function(selector) {
		var els = [];
		if (util.matchSelector(this.node, selector)) els.push(this.node);
		els = els.concat(Binding.prototype.findAll.apply(this, arguments));
		return els;
	},

	attr: function(name, value) {
		if (_.isObject(name) && value == null) {
			_.each(name, function(v, n) { this.attr(n, v); }, this);
			return this;
		}

		if (_.isString(value)) {
			var str = value;
			value = function() { return str; };
		}

		if (!_.isFunction(value)) throw new Error("Expecting string or function for attribute value");
		if (!_.isString(name)) throw new Error("Expecting string for attribute name");

		this.directive(function(scope) {
			var val = value.call(this, scope);
			val = val != null ? val.toString() : "";
			this.node.setAttribute(name, val);
		});

		return this;
	},

	destroy: function() {
		var parent = this.node.parentNode;
		if (parent != null) parent.removeChild(this.node);

		return Binding.prototype.destroy.apply(this, arguments);
	}
});
},{"../util":20,"./index":6,"underscore":25}],5:[function(_dereq_,module,exports){
var _ = _dereq_("underscore"),
	util = _dereq_("../util"),
	Binding = _dereq_("./index");

module.exports = Binding.extend({
	constructor: function(value) {
		if (_.isString(value)) {
			var str = value;
			value = function() { return str; }
		}

		if (!_.isFunction(value))
			throw new Error("Expecting string or function for html binding value.");

		this.compute = value;
		this.value = "";
		this.nodes = [];
		this.placeholder = document.createComment(_.uniqueId("$"));
		
		Binding.call(this);
	},

	addChild: function() {
		throw new Error("Triple bindings can't have children.");
	},

	cleanNodes: function() {
		this.nodes.forEach(function(node) {
			var parent = node.parentNode;
			if (parent != null) parent.removeChild(node);
		});

		this.nodes = [];
		return this;
	},

	refreshNodes: function() {
		var parent = this.placeholder.parentNode;
		if (parent != null) this.nodes.forEach(function(node) {
			parent.insertBefore(node, this.placeholder);
		}, this);

		return this;
	},

	render: function(scope) {
		this.autorun("render", function(comp) {
			var val, cont;

			val = this.compute(scope);
			val = val != null ? val.toString() : "";
			this.value = val;
			
			this.cleanNodes();
			div = document.createElement("div");
			div.innerHTML = val;
			this.nodes = _.toArray(div.childNodes);
			this.refreshNodes();
		});

		return Binding.prototype.render.apply(this, arguments);
	},

	appendTo: function(parent, before) {
		parent.insertBefore(this.placeholder, before);
		this.refreshNodes();
		return this;
	},

	find: function(selector) {
		var k, node, queryResult;

		for (k in this.nodes) {
			node = this.nodes[k];
			if (util.matchSelector(node, selector)) return node;
			if (_.isFunction(node.querySelector)) {
				if (queryResult = node.querySelector(selector)) return queryResult;
			}
		}

		return null;
	},

	findAll: function(selector) {
		var k, node, queryResult,
			matches = [];

		for (k in this.nodes) {
			node = this.nodes[k];
			
			if (util.matchSelector(node, selector)) {
				matches.push(node);
			}
			
			if (_.isFunction(node.querySelector)) {
				queryResult = _.toArray(node.querySelector(selector));
				if (queryResult.length) matches = matches.concat(queryResult);
			}
		}

		return matches;
	},

	toString: function() {
		return this.value;
	},

	destroy: function() {
		this.cleanNodes();
		var parent = this.placeholder.parentNode;
		if (parent != null) parent.removeChild(this.placeholder);

		return Binding.prototype.destroy.apply(this, arguments);
	}
});
},{"../util":20,"./index":6,"underscore":25}],6:[function(_dereq_,module,exports){
var _ = _dereq_("underscore"),
	util = _dereq_("../util"),
	Deps = _dereq_("../deps"),
	EventEmitter = _dereq_("events").EventEmitter;

var Binding = module.exports =
util.subclass.call(EventEmitter, {
	constructor: function() {
		this.children = [];
		this._comps = {};
		this._directives = {};

		var children = _.toArray(arguments);
		if (children.length) this.addChild(children);
	},

	addChild: function(child) {
		_.flatten(_.toArray(arguments)).forEach(function(child) {
			if (!(child instanceof Binding))
				throw new Error("Can only add instances of Binding as children.");

			if (child.parent != null) {
				if (child.parent !== this) throw new Error("Child binding already has a parent.");
				return this;
			}

			var self, removeChild, destroyChild;

			this.children.push(child);
			self = child.parent = this;

			child.on("destroy", child._parentDestroyEvent = function() {
				self.removeChild(child);
			});

			this.emit("child:add", child);
		}, this);

		return this;
	},

	removeChild: function(child) {
		_.flatten(_.toArray(arguments)).forEach(function(child) {
			var index = this.children.indexOf(child);
			if (~index) {
				this.children.splice(index, 1);
				child.removeListener("destroy", child._parentDestroyEvent);
				this.emit("child:remove", child);
			}
		}, this);

		return this;
	},

	// runs fn when deps change
	autorun: function(name, fn) {
		if (_.isFunction(name) && fn == null) {
			fn = name;
			name = _.uniqueId("f");
		}

		if (!_.isString(name)) throw new Error("Expecting string for computation identifier.");
		if (!_.isFunction(fn)) throw new Error("Expecting function for computation.");

		this.stopComputation(name);
		var self = this;

		return this._comps[name] = Deps.autorun(function(comp) {
			fn.call(self, comp);
			
			comp.onInvalidate(function() {
				if (comp.stopped && self._comps[name] === comp) {
					delete self._comps[name];
				}
			});
		});
	},

	stopComputation: function(name) {
		if (name == null) {
			_.each(this._comps, function(c) {
				c.stop();
			});

			this._comps = {};
		}

		else if (this._comps[name] != null) {
			this._comps[name].stop();
		}

		return this;
	},

	directive: function(fn) {
		if (typeof fn !== "function") throw new Error("Expecting function for computation.");
		this._directives[_.uniqueId("d")] = fn;
		return this;
	},

	killDirective: function(fn) {
		if (fn == null) {
			_.each(this._directives, function(fn) {
				this.killDirective(fn);
			}, this);

			this._directives = {};
		}

		else {
			_.reduce(this._directives, function(m, d, id) {
				if (d === fn) m.push(id);
				return m;
			}, []).forEach(function(id) {
				this.stopComputation(id);
				delete this._directives[id];
			}, this);
		}

		return this;
	},

	execDirectives: function(scope) {
		_.each(this._directives, function(fn, id) {
			this.autorun(id, function(comp) {
				fn.call(this, scope, comp);
			});
		}, this);

		return this;
	},

	render: function(scope) {
		// first directives
		this.execDirectives(scope);

		// then children
		this.children.slice(0).forEach(function(child) {
			child.render(scope);
		});

		return this;
	},

	appendTo: function(parent, before) {
		this.children.slice(0).forEach(function(child) {
			child.appendTo(parent, before);
		});

		return this;
	},

	find: function(selector) {
		var el = null;
		
		this.children.some(function(child) {
			return !!(el = child.find(selector));
		});

		return el;
	},

	findAll: function(selector) {
		var els = []

		this.children.forEach(function(child) {
			els = els.concat(child.findAll(selector));
		});

		return els;
	},

	toString: function() {
		return this.children.slice(0).map(function(child) {
			return child.toString();
		}).join("");
	},

	destroy: function() {
		this.children.slice(0).forEach(function(child) {
			child.destroy();
		});

		this.stopComputation();
		this.emit("destroy");
		return this;
	}
}, {
	extend: util.subclass
});

// Load the real bindings
Binding.Text		= _dereq_("./text");
Binding.Element		= _dereq_("./element");
Binding.HTML		= _dereq_("./html");
Binding.Context		= _dereq_("./context");
Binding.Each		= _dereq_("./each");
Binding.Component	= _dereq_("./component");
},{"../deps":8,"../util":20,"./component":1,"./context":2,"./each":3,"./element":4,"./html":5,"./text":7,"events":21,"underscore":25}],7:[function(_dereq_,module,exports){
var _ = _dereq_("underscore"),
	Binding = _dereq_("./index");

module.exports = Binding.extend({
	constructor: function(value) {
		if (_.isString(value)) {
			var str = value;
			value = function() { return str; }
		}

		if (!_.isFunction(value))
			throw new Error("Expecting string or function for text binding value.");

		this.compute = value;
		this.value = "";
		this.node = document.createTextNode("");

		Binding.call(this);
	},

	addChild: function() {
		throw new Error("Text bindings can't have children.");
	},

	render: function(scope) {
		this.autorun("render", function(comp) {
			var val = this.compute(scope);
			val = val != null ? val.toString() : "";
			this.node.nodeValue = this.value = val;
		});

		return Binding.prototype.render.apply(this, arguments);
	},

	appendTo: function(parent, before) {
		parent.insertBefore(this.node, before);
		return Binding.prototype.appendTo.apply(this, arguments);
	},

	find: function(selector) { return null; },
	findAll: function() { return []; },

	toString: function() {
		return this.value;
	},

	destroy: function() {
		var parent = this.node.parentNode;
		if (parent != null) parent.removeChild(this.node);

		return Binding.prototype.destroy.apply(this, arguments);
	}
});
},{"./index":6,"underscore":25}],8:[function(_dereq_,module,exports){
//////////////////////////////////////////////////
// Package docs at http://docs.meteor.com/#deps //
//////////////////////////////////////////////////

var Deps =
module.exports = {};

// http://docs.meteor.com/#deps_active
Deps.active = false;

// http://docs.meteor.com/#deps_currentcomputation
Deps.currentComputation = null;

var setCurrentComputation = function (c) {
  Deps.currentComputation = c;
  Deps.active = !! c;
};

// _assign is like _.extend or the upcoming Object.assign.
// Copy src's own, enumerable properties onto tgt and return
// tgt.
var _hasOwnProperty = Object.prototype.hasOwnProperty;
var _assign = function (tgt, src) {
  for (var k in src) {
    if (_hasOwnProperty.call(src, k))
      tgt[k] = src[k];
  }
  return tgt;
};

var _debugFunc = function () {
  // lazy evaluation because `Meteor` does not exist right away
  return (typeof Meteor !== "undefined" ? Meteor._debug :
          ((typeof console !== "undefined") && console.log ?
           function () { console.log.apply(console, arguments); } :
           function () {}));
};

var _throwOrLog = function (from, e) {
  if (throwFirstError) {
    throw e;
  } else {
    _debugFunc()("Exception from Deps " + from + " function:",
                 e.stack || e.message);
  }
};

// Like `Meteor._noYieldsAllowed(function () { f(comp); })` but shorter,
// and doesn't clutter the stack with an extra frame on the client,
// where `_noYieldsAllowed` is a no-op.  `f` may be a computation
// function or an onInvalidate callback.
var callWithNoYieldsAllowed = function (f, comp) {
  if ((typeof Meteor === 'undefined') || Meteor.isClient) {
    f(comp);
  } else {
    Meteor._noYieldsAllowed(function () {
      f(comp);
    });
  }
};

var nextId = 1;
// computations whose callbacks we should call at flush time
var pendingComputations = [];
// `true` if a Deps.flush is scheduled, or if we are in Deps.flush now
var willFlush = false;
// `true` if we are in Deps.flush now
var inFlush = false;
// `true` if we are computing a computation now, either first time
// or recompute.  This matches Deps.active unless we are inside
// Deps.nonreactive, which nullfies currentComputation even though
// an enclosing computation may still be running.
var inCompute = false;
// `true` if the `_throwFirstError` option was passed in to the call
// to Deps.flush that we are in. When set, throw rather than log the
// first error encountered while flushing. Before throwing the error,
// finish flushing (from a finally block), logging any subsequent
// errors.
var throwFirstError = false;

var afterFlushCallbacks = [];

var requireFlush = function () {
  if (! willFlush) {
    requestAnimationFrame(Deps.flush);
    willFlush = true;
  }
};

// Deps.Computation constructor is visible but private
// (throws an error if you try to call it)
var constructingComputation = false;

//
// http://docs.meteor.com/#deps_computation
//
Deps.Computation = function (f, parent) {
  if (! constructingComputation)
    throw new Error(
      "Deps.Computation constructor is private; use Deps.autorun");
  constructingComputation = false;

  var self = this;

  // http://docs.meteor.com/#computation_stopped
  self.stopped = false;

  // http://docs.meteor.com/#computation_invalidated
  self.invalidated = false;

  // http://docs.meteor.com/#computation_firstrun
  self.firstRun = true;

  self._id = nextId++;
  self._onInvalidateCallbacks = [];
  // the plan is at some point to use the parent relation
  // to constrain the order that computations are processed
  self._parent = parent;
  self._func = f;
  self._recomputing = false;

  var errored = true;
  try {
    self._compute();
    errored = false;
  } finally {
    self.firstRun = false;
    if (errored)
      self.stop();
  }
};

_assign(Deps.Computation.prototype, {

  // http://docs.meteor.com/#computation_oninvalidate
  onInvalidate: function (f) {
    var self = this;

    if (typeof f !== 'function')
      throw new Error("onInvalidate requires a function");

    if (self.invalidated) {
      Deps.nonreactive(function () {
        callWithNoYieldsAllowed(f, self);
      });
    } else {
      self._onInvalidateCallbacks.push(f);
    }
  },

  // http://docs.meteor.com/#computation_invalidate
  invalidate: function () {
    var self = this;
    if (! self.invalidated) {
      // if we're currently in _recompute(), don't enqueue
      // ourselves, since we'll rerun immediately anyway.
      if (! self._recomputing && ! self.stopped) {
        requireFlush();
        pendingComputations.push(this);
      }

      self.invalidated = true;

      // callbacks can't add callbacks, because
      // self.invalidated === true.
      for(var i = 0, f; f = self._onInvalidateCallbacks[i]; i++) {
        Deps.nonreactive(function () {
          callWithNoYieldsAllowed(f, self);
        });
      }
      self._onInvalidateCallbacks = [];
    }
  },

  // http://docs.meteor.com/#computation_stop
  stop: function () {
    if (! this.stopped) {
      this.stopped = true;
      this.invalidate();
    }
  },

  _compute: function () {
    var self = this;
    self.invalidated = false;

    var previous = Deps.currentComputation;
    setCurrentComputation(self);
    var previousInCompute = inCompute;
    inCompute = true;
    try {
      callWithNoYieldsAllowed(self._func, self);
    } finally {
      setCurrentComputation(previous);
      inCompute = false;
    }
  },

  _recompute: function () {
    var self = this;

    self._recomputing = true;
    try {
      while (self.invalidated && ! self.stopped) {
        try {
          self._compute();
        } catch (e) {
          _throwOrLog("recompute", e);
        }
        // If _compute() invalidated us, we run again immediately.
        // A computation that invalidates itself indefinitely is an
        // infinite loop, of course.
        //
        // We could put an iteration counter here and catch run-away
        // loops.
      }
    } finally {
      self._recomputing = false;
    }
  }
});

//
// http://docs.meteor.com/#deps_dependency
//
Deps.Dependency = function () {
  this._dependentsById = {};
};

_assign(Deps.Dependency.prototype, {
  // http://docs.meteor.com/#dependency_depend
  //
  // Adds `computation` to this set if it is not already
  // present.  Returns true if `computation` is a new member of the set.
  // If no argument, defaults to currentComputation, or does nothing
  // if there is no currentComputation.
  depend: function (computation) {
    if (! computation) {
      if (! Deps.active)
        return false;

      computation = Deps.currentComputation;
    }
    var self = this;
    var id = computation._id;
    if (! (id in self._dependentsById)) {
      self._dependentsById[id] = computation;
      computation.onInvalidate(function () {
        delete self._dependentsById[id];
      });
      return true;
    }
    return false;
  },

  // http://docs.meteor.com/#dependency_changed
  changed: function () {
    var self = this;
    for (var id in self._dependentsById)
      self._dependentsById[id].invalidate();
  },

  // http://docs.meteor.com/#dependency_hasdependents
  hasDependents: function () {
    var self = this;
    for(var id in self._dependentsById)
      return true;
    return false;
  }
});

_assign(Deps, {
  // http://docs.meteor.com/#deps_flush
  flush: function (_opts) {
    // XXX What part of the comment below is still true? (We no longer
    // have Spark)
    //
    // Nested flush could plausibly happen if, say, a flush causes
    // DOM mutation, which causes a "blur" event, which runs an
    // app event handler that calls Deps.flush.  At the moment
    // Spark blocks event handlers during DOM mutation anyway,
    // because the LiveRange tree isn't valid.  And we don't have
    // any useful notion of a nested flush.
    //
    // https://app.asana.com/0/159908330244/385138233856
    if (inFlush)
      throw new Error("Can't call Deps.flush while flushing");

    if (inCompute)
      throw new Error("Can't flush inside Deps.autorun");

    inFlush = true;
    willFlush = true;
    throwFirstError = !! (_opts && _opts._throwFirstError);

    var finishedTry = false;
    try {
      while (pendingComputations.length ||
             afterFlushCallbacks.length) {

        // recompute all pending computations
        while (pendingComputations.length) {
          var comp = pendingComputations.shift();
          comp._recompute();
        }

        if (afterFlushCallbacks.length) {
          // call one afterFlush callback, which may
          // invalidate more computations
          var func = afterFlushCallbacks.shift();
          try {
            func();
          } catch (e) {
            _throwOrLog("afterFlush function", e);
          }
        }
      }
      finishedTry = true;
    } finally {
      if (! finishedTry) {
        // we're erroring
        inFlush = false; // needed before calling `Deps.flush()` again
        Deps.flush({_throwFirstError: false}); // finish flushing
      }
      willFlush = false;
      inFlush = false;
    }
  },

  // http://docs.meteor.com/#deps_autorun
  //
  // Run f(). Record its dependencies. Rerun it whenever the
  // dependencies change.
  //
  // Returns a new Computation, which is also passed to f.
  //
  // Links the computation to the current computation
  // so that it is stopped if the current computation is invalidated.
  autorun: function (f) {
    if (typeof f !== 'function')
      throw new Error('Deps.autorun requires a function argument');

    constructingComputation = true;
    var c = new Deps.Computation(f, Deps.currentComputation);

    if (Deps.active)
      Deps.onInvalidate(function () {
        c.stop();
      });

    return c;
  },

  // http://docs.meteor.com/#deps_nonreactive
  //
  // Run `f` with no current computation, returning the return value
  // of `f`.  Used to turn off reactivity for the duration of `f`,
  // so that reactive data sources accessed by `f` will not result in any
  // computations being invalidated.
  nonreactive: function (f) {
    var previous = Deps.currentComputation;
    setCurrentComputation(null);
    try {
      return f();
    } finally {
      setCurrentComputation(previous);
    }
  },

  // http://docs.meteor.com/#deps_oninvalidate
  onInvalidate: function (f) {
    if (! Deps.active)
      throw new Error("Deps.onInvalidate requires a currentComputation");

    Deps.currentComputation.onInvalidate(f);
  },

  // http://docs.meteor.com/#deps_afterflush
  afterFlush: function (f) {
    afterFlushCallbacks.push(f);
    requireFlush();
  }
});
},{}],9:[function(_dereq_,module,exports){
var Temple = _dereq_("./temple"),
	_ = _dereq_("underscore"),
	util = _dereq_("./util");

var defaultHandler = {
	match			: function(target)				{ return false; },
	construct		: function(target)				{ },
	isLeaf			: function(target)				{ return true; },
	get				: function(target, path)		{ },
	set				: function(target, path, val)	{ return false; },
	keys			: function(target)				{ return []; },
	deleteProperty	: function(target, path)		{ return false; },
	merge			: function(target, mixin)		{ return false; },
	destroy			: function(target)				{ }
};

var objectHandler = _.defaults({
	match: function(target) {
		return util.isPlainObject(target);
	},
	isLeaf: function(target) {
		return false;
	},
	get: function(target, path) {
		return target[path];
	},
	set: function(target, path, val) {
		target[path] = val;
		return true;
	},
	keys: function(target) {
		return Object.keys(target);
	},
	merge: function(target, mixin) {
		if (!util.isPlainObject(mixin)) return false;
		_.each(mixin, function(v, k) { this.set(k, v); }, this);
		return true;
	},
	deleteProperty: function(target, path) {
		delete target[path];
	}
}, defaultHandler);

var arrayHandler = _.defaults({
	match: function(val) {
		return Array.isArray(val);
	},

	construct: function(arr) {
		util.patchArray(arr);
		this.set("length", arr.length);
		
		arr.observe(this._arrayObserver = (function(index, nval, oval) {
			this.notify(index.toString(), nval, oval, { remove: nval === void 0 });
			this.notify("length", arr.length);
		}).bind(this));
	},

	set: function(arr, path, val) {
		// sets on length *should* be ok but we need to notify
		// of any new or removed values. for now, ignored
		if (path === "length") return false;
		arr[path] = val;
		return true;
	},

	deleteProperty: function(arr, path) {
		var index = parseInt(path, 10);
		delete arr[path];
		
		// make the array smaller if we are deleting the last element
		if (!isNaN(index) && index >= 0 && index === arr.length - 1) {
			arr.length = arr.length - 1;
		}

		return true;
	},

	// arrays don't merge with any value
	merge: function() { return false; },

	destroy: function(arr) {
		arr.stopObserving(this._arrayObserver);
	}
}, objectHandler);

module.exports = [ arrayHandler, objectHandler ];
module.exports.default = defaultHandler;
},{"./temple":18,"./util":20,"underscore":25}],10:[function(_dereq_,module,exports){
var _ = _dereq_("underscore"),
	util = _dereq_("./util"),
	EventEmitter = _dereq_("events").EventEmitter,
	handlers = _dereq_("./handlers");

var Model =
module.exports = util.subclass.call(EventEmitter, {

	constructor: function(value) {
		EventEmitter.call(this);
		this.setMaxListeners(0);
		
		this._handlers = [];
		this.children = {};
		
		this.set([], value);
	},

	// returns the correct handler based on a value
	_handler: function(val) {
		var handler;

		// first look through local
		handler = _.find(this._handlers, function(h) {
			return h.match(val);
		});

		// then try up the tree
		if (handler == null && this.parent != null) {
			handler = this.parent._handler(val);
		}

		// lastly look through global defaults
		if (handler == null) {
			handler = _.find(Model._defaultHandlers, function(h) {
				return h.match(val);
			});
		}

		return handler != null ? handler : handlers.default;
	},

	// adds a handler to use on any future model values
	// secondary usage is to execute a handler method with arguments
	handle: function(handler) {
		if (_.isObject(handler)) {
			handler = _.extend({}, handlers.default, handler);
			this._handlers.unshift(handler);
			return this;
		}

		else if (_.isString(handler)) {
			var handle = this.__handle__;

			// create if doesn't exist
			if (handler == "construct" || !_.isFunction(handle) || handle.value !== this.value) {
				handle = Model.createHandle(this, this.value);
				handle.value = this.value;
				this.__handle__ = handle;
			}

			return handle.apply(null, _.toArray(arguments));
		}
	},

	// creates a child model from a value at local path
	_spawn: function(path) {
		if (!_.isString(path)) throw new Error("Expecting path to be a string.");

		var child, parent, val;
		parent = this;
		
		child = new (this.constructor)();
		child.parent = parent;
		child.set([], this.handle("get", path));
		child.on("change", onChange);
		
		return child;

		function onChange(summary, options) {
			if (options.bubble === false) return;
			
			if (!summary.keypath.length) {
				// reset value to generic object if parent is a leaf node
				if (parent.handle("isLeaf")) {
					if (!options.remove) {
						var reset = {};
						reset[path] = summary.value;
						parent.set([], reset, _.defaults({ reset: true }, options));
					}

					return;
				}

				// otherwise do a local set at the path
				else {
					if (options.remove) parent.handle("deleteProperty", path);
					else parent.handle("set", path, summary.value);
				}
			}
		
			parent.emit("change", _.defaults({
				keypath: [ path ].concat(summary.keypath)
			}, summary), options);
		}
	},

	// returns the model at path, deeply
	getModel: function(parts) {
		parts = util.splitPath(parts);
		if (!parts.length) return this;

		var path = parts[0],
			rest = parts.slice(1),
			model;

		if (this.children[path] != null) model = this.children[path];
		else model = this.children[path] = this._spawn(path);

		return model.getModel(rest);
	},

	// return the value of the model at path, deeply
	get: function(path) {
		return this.getModel(path).value;
	},

	// the own properties of the model's value
	keys: function(parts) {
		parts = util.splitPath(parts);
		if (parts.length) return this.getModel(parts).keys();
		return this.handle("keys");
	},

	// sets a value at path, deeply
	set: function(parts, value, options) {
		// accept .set(value)
		if (value == null && parts != null && !_.isArray(parts) && !_.isString(parts)) {
			value = parts;
			parts = [];
		}

		parts = util.splitPath(parts);
		options = options || {};

		// no path is a merge or reset
		if (!parts.length) {

			// try merge or reset
			if (options.reset || this.handle("isLeaf") || this.handle("merge", value) === false) {
				
				var oval = this.value;
				this.handle("destroy");
				this.value = options.remove ? void 0 : value;
				this.handle("construct");

				if (options.notify !== false && (oval !== this.value || options.remove)) {
					this.notify([], this.value, oval, options);
				}

			}
		}

		// otherwise recurse to the correct model and try again
		else {
			this.getModel(parts).set([], value, options);
		}

		return this;
	},

	// removes the value at path
	unset: function(path, options) {
		return this.set(path || [], true, _.extend({ remove: true }, options));
	},

	// let's the model and its children know that something changed
	notify: function(path, nval, oval, options) {
		var silent, summary, child, childOptions, nval;
		options = options || {};

		// notify only works on the model at path
		if (!_.isArray(path) || path.length) {
			return this.getModel(path).notify([], nval, oval, options);
		}

		// update the current value if hasn't been already
		if (nval !== this.value) {
			if (_.isUndefined(oval)) oval = this.value;
			this.set([], nval, _.extend(options, { notify: false }));
		}

		// if the values are identical, why are we here?
		if (nval === oval) return;

		childOptions = _.extend({ reset: true }, options, { bubble: false });
		summary = {
			model: this,
			type: util.changeType(nval, oval),
			keypath: [],
			value: nval,
			oldValue: oval
		};

		// reset all the children values
		_.each(this.children, function(c, p) {
			c.set([], this.handle("get", p), childOptions);
		}, this);

		// announce the change
		this.emit("change", summary, options);

		return summary;
	},

}, {

	extend: util.subclass,
	_defaultHandlers: _dereq_("./handlers"),

	isModel: function(obj) {
		return obj instanceof Model;
	},

	// creates a focused handle function from model and value
	createHandle: function(model, val) {
		var handler = model._handler(val);
		
		return function(m) {
			var args = _.toArray(arguments).slice(1),
				method = handler[m];

			return !_.isFunction(method) ? method : method.apply(model, [ val ].concat(args));
		}
	}

});
},{"./handlers":9,"./util":20,"events":21,"underscore":25}],11:[function(_dereq_,module,exports){
module.exports = (function() {
  /*
   * Generated by PEG.js 0.8.0.
   *
   * http://pegjs.majda.cz/
   */

  function peg$subclass(child, parent) {
    function ctor() { this.constructor = child; }
    ctor.prototype = parent.prototype;
    child.prototype = new ctor();
  }

  function SyntaxError(message, expected, found, offset, line, column) {
    this.message  = message;
    this.expected = expected;
    this.found    = found;
    this.offset   = offset;
    this.line     = line;
    this.column   = column;

    this.name     = "SyntaxError";
  }

  peg$subclass(SyntaxError, Error);

  function parse(input) {
    var options = arguments.length > 1 ? arguments[1] : {},

        peg$FAILED = {},

        peg$startRuleFunctions = { start: peg$parsestart },
        peg$startRuleFunction  = peg$parsestart,

        peg$c0 = peg$FAILED,
        peg$c1 = null,
        peg$c2 = ",",
        peg$c3 = { type: "literal", value: ",", description: "\",\"" },
        peg$c4 = function(l, r) { return r != null && r[1] != null ? [l].concat(r[1]) : [l]; },
        peg$c5 = function(v) { return v; },
        peg$c6 = "{{",
        peg$c7 = { type: "literal", value: "{{", description: "\"{{\"" },
        peg$c8 = [],
        peg$c9 = /^[^}]/,
        peg$c10 = { type: "class", value: "[^}]", description: "[^}]" },
        peg$c11 = "}}",
        peg$c12 = { type: "literal", value: "}}", description: "\"}}\"" },
        peg$c13 = function(s) {
        		var path = s.join("").trim();
        		// unfortunately, we must listen to changes at all deep paths
        		options.scope.depend(util.joinPathParts(path, "**"));
        		return options.scope.get(path);
        	},
        peg$c14 = "true",
        peg$c15 = { type: "literal", value: "true", description: "\"true\"" },
        peg$c16 = function() { return true; },
        peg$c17 = "false",
        peg$c18 = { type: "literal", value: "false", description: "\"false\"" },
        peg$c19 = function() { return false; },
        peg$c20 = "-",
        peg$c21 = { type: "literal", value: "-", description: "\"-\"" },
        peg$c22 = /^[0-9]/,
        peg$c23 = { type: "class", value: "[0-9]", description: "[0-9]" },
        peg$c24 = ".",
        peg$c25 = { type: "literal", value: ".", description: "\".\"" },
        peg$c26 = function(i, d) { return parseFloat(flatten(i.concat(d)).join("")); },
        peg$c27 = "\"",
        peg$c28 = { type: "literal", value: "\"", description: "\"\\\"\"" },
        peg$c29 = /^[^"]/,
        peg$c30 = { type: "class", value: "[^\"]", description: "[^\"]" },
        peg$c31 = function(v) { return v.join(""); },
        peg$c32 = "'",
        peg$c33 = { type: "literal", value: "'", description: "\"'\"" },
        peg$c34 = /^[^']/,
        peg$c35 = { type: "class", value: "[^']", description: "[^']" },
        peg$c36 = /^[^,]/,
        peg$c37 = { type: "class", value: "[^,]", description: "[^,]" },
        peg$c38 = function(v) { return v.join("").trim(); },
        peg$c39 = "null",
        peg$c40 = { type: "literal", value: "null", description: "\"null\"" },
        peg$c41 = function() { return null; },
        peg$c42 = "undefined",
        peg$c43 = { type: "literal", value: "undefined", description: "\"undefined\"" },
        peg$c44 = "void",
        peg$c45 = { type: "literal", value: "void", description: "\"void\"" },
        peg$c46 = function() { return void 0; },
        peg$c47 = { type: "other", description: "whitespace" },
        peg$c48 = /^[ \t\n\r]/,
        peg$c49 = { type: "class", value: "[ \\t\\n\\r]", description: "[ \\t\\n\\r]" },
        peg$c50 = "\\",
        peg$c51 = { type: "literal", value: "\\", description: "\"\\\\\"" },
        peg$c52 = { type: "any", description: "any character" },
        peg$c53 = function(char) { return char; },

        peg$currPos          = 0,
        peg$reportedPos      = 0,
        peg$cachedPos        = 0,
        peg$cachedPosDetails = { line: 1, column: 1, seenCR: false },
        peg$maxFailPos       = 0,
        peg$maxFailExpected  = [],
        peg$silentFails      = 0,

        peg$result;

    if ("startRule" in options) {
      if (!(options.startRule in peg$startRuleFunctions)) {
        throw new Error("Can't start parsing from rule \"" + options.startRule + "\".");
      }

      peg$startRuleFunction = peg$startRuleFunctions[options.startRule];
    }

    function text() {
      return input.substring(peg$reportedPos, peg$currPos);
    }

    function offset() {
      return peg$reportedPos;
    }

    function line() {
      return peg$computePosDetails(peg$reportedPos).line;
    }

    function column() {
      return peg$computePosDetails(peg$reportedPos).column;
    }

    function expected(description) {
      throw peg$buildException(
        null,
        [{ type: "other", description: description }],
        peg$reportedPos
      );
    }

    function error(message) {
      throw peg$buildException(message, null, peg$reportedPos);
    }

    function peg$computePosDetails(pos) {
      function advance(details, startPos, endPos) {
        var p, ch;

        for (p = startPos; p < endPos; p++) {
          ch = input.charAt(p);
          if (ch === "\n") {
            if (!details.seenCR) { details.line++; }
            details.column = 1;
            details.seenCR = false;
          } else if (ch === "\r" || ch === "\u2028" || ch === "\u2029") {
            details.line++;
            details.column = 1;
            details.seenCR = true;
          } else {
            details.column++;
            details.seenCR = false;
          }
        }
      }

      if (peg$cachedPos !== pos) {
        if (peg$cachedPos > pos) {
          peg$cachedPos = 0;
          peg$cachedPosDetails = { line: 1, column: 1, seenCR: false };
        }
        advance(peg$cachedPosDetails, peg$cachedPos, pos);
        peg$cachedPos = pos;
      }

      return peg$cachedPosDetails;
    }

    function peg$fail(expected) {
      if (peg$currPos < peg$maxFailPos) { return; }

      if (peg$currPos > peg$maxFailPos) {
        peg$maxFailPos = peg$currPos;
        peg$maxFailExpected = [];
      }

      peg$maxFailExpected.push(expected);
    }

    function peg$buildException(message, expected, pos) {
      function cleanupExpected(expected) {
        var i = 1;

        expected.sort(function(a, b) {
          if (a.description < b.description) {
            return -1;
          } else if (a.description > b.description) {
            return 1;
          } else {
            return 0;
          }
        });

        while (i < expected.length) {
          if (expected[i - 1] === expected[i]) {
            expected.splice(i, 1);
          } else {
            i++;
          }
        }
      }

      function buildMessage(expected, found) {
        function stringEscape(s) {
          function hex(ch) { return ch.charCodeAt(0).toString(16).toUpperCase(); }

          return s
            .replace(/\\/g,   '\\\\')
            .replace(/"/g,    '\\"')
            .replace(/\x08/g, '\\b')
            .replace(/\t/g,   '\\t')
            .replace(/\n/g,   '\\n')
            .replace(/\f/g,   '\\f')
            .replace(/\r/g,   '\\r')
            .replace(/[\x00-\x07\x0B\x0E\x0F]/g, function(ch) { return '\\x0' + hex(ch); })
            .replace(/[\x10-\x1F\x80-\xFF]/g,    function(ch) { return '\\x'  + hex(ch); })
            .replace(/[\u0180-\u0FFF]/g,         function(ch) { return '\\u0' + hex(ch); })
            .replace(/[\u1080-\uFFFF]/g,         function(ch) { return '\\u'  + hex(ch); });
        }

        var expectedDescs = new Array(expected.length),
            expectedDesc, foundDesc, i;

        for (i = 0; i < expected.length; i++) {
          expectedDescs[i] = expected[i].description;
        }

        expectedDesc = expected.length > 1
          ? expectedDescs.slice(0, -1).join(", ")
              + " or "
              + expectedDescs[expected.length - 1]
          : expectedDescs[0];

        foundDesc = found ? "\"" + stringEscape(found) + "\"" : "end of input";

        return "Expected " + expectedDesc + " but " + foundDesc + " found.";
      }

      var posDetails = peg$computePosDetails(pos),
          found      = pos < input.length ? input.charAt(pos) : null;

      if (expected !== null) {
        cleanupExpected(expected);
      }

      return new SyntaxError(
        message !== null ? message : buildMessage(expected, found),
        expected,
        found,
        pos,
        posDetails.line,
        posDetails.column
      );
    }

    function peg$parsestart() {
      var s0;

      s0 = peg$parsearray();

      return s0;
    }

    function peg$parsearray() {
      var s0, s1, s2, s3, s4;

      s0 = peg$currPos;
      s1 = peg$parsevalue();
      if (s1 !== peg$FAILED) {
        s2 = peg$currPos;
        if (input.charCodeAt(peg$currPos) === 44) {
          s3 = peg$c2;
          peg$currPos++;
        } else {
          s3 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c3); }
        }
        if (s3 !== peg$FAILED) {
          s4 = peg$parsearray();
          if (s4 !== peg$FAILED) {
            s3 = [s3, s4];
            s2 = s3;
          } else {
            peg$currPos = s2;
            s2 = peg$c0;
          }
        } else {
          peg$currPos = s2;
          s2 = peg$c0;
        }
        if (s2 === peg$FAILED) {
          s2 = peg$c1;
        }
        if (s2 !== peg$FAILED) {
          peg$reportedPos = s0;
          s1 = peg$c4(s1, s2);
          s0 = s1;
        } else {
          peg$currPos = s0;
          s0 = peg$c0;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$c0;
      }

      return s0;
    }

    function peg$parsevalue() {
      var s0, s1, s2, s3;

      s0 = peg$currPos;
      s1 = peg$parsews();
      if (s1 !== peg$FAILED) {
        s2 = peg$parsevariable();
        if (s2 === peg$FAILED) {
          s2 = peg$parsestring();
          if (s2 === peg$FAILED) {
            s2 = peg$parseboolean();
            if (s2 === peg$FAILED) {
              s2 = peg$parsenumber();
              if (s2 === peg$FAILED) {
                s2 = peg$parsenull();
                if (s2 === peg$FAILED) {
                  s2 = peg$parseundefined();
                  if (s2 === peg$FAILED) {
                    s2 = peg$parsedumb_string();
                  }
                }
              }
            }
          }
        }
        if (s2 !== peg$FAILED) {
          s3 = peg$parsews();
          if (s3 !== peg$FAILED) {
            peg$reportedPos = s0;
            s1 = peg$c5(s2);
            s0 = s1;
          } else {
            peg$currPos = s0;
            s0 = peg$c0;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$c0;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$c0;
      }

      return s0;
    }

    function peg$parsevariable() {
      var s0, s1, s2, s3;

      s0 = peg$currPos;
      if (input.substr(peg$currPos, 2) === peg$c6) {
        s1 = peg$c6;
        peg$currPos += 2;
      } else {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c7); }
      }
      if (s1 !== peg$FAILED) {
        s2 = [];
        s3 = peg$parseescape();
        if (s3 === peg$FAILED) {
          if (peg$c9.test(input.charAt(peg$currPos))) {
            s3 = input.charAt(peg$currPos);
            peg$currPos++;
          } else {
            s3 = peg$FAILED;
            if (peg$silentFails === 0) { peg$fail(peg$c10); }
          }
        }
        if (s3 !== peg$FAILED) {
          while (s3 !== peg$FAILED) {
            s2.push(s3);
            s3 = peg$parseescape();
            if (s3 === peg$FAILED) {
              if (peg$c9.test(input.charAt(peg$currPos))) {
                s3 = input.charAt(peg$currPos);
                peg$currPos++;
              } else {
                s3 = peg$FAILED;
                if (peg$silentFails === 0) { peg$fail(peg$c10); }
              }
            }
          }
        } else {
          s2 = peg$c0;
        }
        if (s2 !== peg$FAILED) {
          if (input.substr(peg$currPos, 2) === peg$c11) {
            s3 = peg$c11;
            peg$currPos += 2;
          } else {
            s3 = peg$FAILED;
            if (peg$silentFails === 0) { peg$fail(peg$c12); }
          }
          if (s3 !== peg$FAILED) {
            peg$reportedPos = s0;
            s1 = peg$c13(s2);
            s0 = s1;
          } else {
            peg$currPos = s0;
            s0 = peg$c0;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$c0;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$c0;
      }

      return s0;
    }

    function peg$parseboolean() {
      var s0, s1;

      s0 = peg$currPos;
      if (input.substr(peg$currPos, 4) === peg$c14) {
        s1 = peg$c14;
        peg$currPos += 4;
      } else {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c15); }
      }
      if (s1 !== peg$FAILED) {
        peg$reportedPos = s0;
        s1 = peg$c16();
      }
      s0 = s1;
      if (s0 === peg$FAILED) {
        s0 = peg$currPos;
        if (input.substr(peg$currPos, 5) === peg$c17) {
          s1 = peg$c17;
          peg$currPos += 5;
        } else {
          s1 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c18); }
        }
        if (s1 !== peg$FAILED) {
          peg$reportedPos = s0;
          s1 = peg$c19();
        }
        s0 = s1;
      }

      return s0;
    }

    function peg$parsenumber() {
      var s0, s1, s2, s3, s4, s5;

      s0 = peg$currPos;
      s1 = peg$currPos;
      if (input.charCodeAt(peg$currPos) === 45) {
        s2 = peg$c20;
        peg$currPos++;
      } else {
        s2 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c21); }
      }
      if (s2 === peg$FAILED) {
        s2 = peg$c1;
      }
      if (s2 !== peg$FAILED) {
        s3 = [];
        if (peg$c22.test(input.charAt(peg$currPos))) {
          s4 = input.charAt(peg$currPos);
          peg$currPos++;
        } else {
          s4 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c23); }
        }
        if (s4 !== peg$FAILED) {
          while (s4 !== peg$FAILED) {
            s3.push(s4);
            if (peg$c22.test(input.charAt(peg$currPos))) {
              s4 = input.charAt(peg$currPos);
              peg$currPos++;
            } else {
              s4 = peg$FAILED;
              if (peg$silentFails === 0) { peg$fail(peg$c23); }
            }
          }
        } else {
          s3 = peg$c0;
        }
        if (s3 !== peg$FAILED) {
          s2 = [s2, s3];
          s1 = s2;
        } else {
          peg$currPos = s1;
          s1 = peg$c0;
        }
      } else {
        peg$currPos = s1;
        s1 = peg$c0;
      }
      if (s1 !== peg$FAILED) {
        s2 = peg$currPos;
        if (input.charCodeAt(peg$currPos) === 46) {
          s3 = peg$c24;
          peg$currPos++;
        } else {
          s3 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c25); }
        }
        if (s3 !== peg$FAILED) {
          s4 = [];
          if (peg$c22.test(input.charAt(peg$currPos))) {
            s5 = input.charAt(peg$currPos);
            peg$currPos++;
          } else {
            s5 = peg$FAILED;
            if (peg$silentFails === 0) { peg$fail(peg$c23); }
          }
          if (s5 !== peg$FAILED) {
            while (s5 !== peg$FAILED) {
              s4.push(s5);
              if (peg$c22.test(input.charAt(peg$currPos))) {
                s5 = input.charAt(peg$currPos);
                peg$currPos++;
              } else {
                s5 = peg$FAILED;
                if (peg$silentFails === 0) { peg$fail(peg$c23); }
              }
            }
          } else {
            s4 = peg$c0;
          }
          if (s4 !== peg$FAILED) {
            s3 = [s3, s4];
            s2 = s3;
          } else {
            peg$currPos = s2;
            s2 = peg$c0;
          }
        } else {
          peg$currPos = s2;
          s2 = peg$c0;
        }
        if (s2 === peg$FAILED) {
          s2 = peg$c1;
        }
        if (s2 !== peg$FAILED) {
          peg$reportedPos = s0;
          s1 = peg$c26(s1, s2);
          s0 = s1;
        } else {
          peg$currPos = s0;
          s0 = peg$c0;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$c0;
      }

      return s0;
    }

    function peg$parsestring() {
      var s0, s1, s2, s3;

      s0 = peg$currPos;
      if (input.charCodeAt(peg$currPos) === 34) {
        s1 = peg$c27;
        peg$currPos++;
      } else {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c28); }
      }
      if (s1 !== peg$FAILED) {
        s2 = [];
        s3 = peg$parseescape();
        if (s3 === peg$FAILED) {
          if (peg$c29.test(input.charAt(peg$currPos))) {
            s3 = input.charAt(peg$currPos);
            peg$currPos++;
          } else {
            s3 = peg$FAILED;
            if (peg$silentFails === 0) { peg$fail(peg$c30); }
          }
        }
        while (s3 !== peg$FAILED) {
          s2.push(s3);
          s3 = peg$parseescape();
          if (s3 === peg$FAILED) {
            if (peg$c29.test(input.charAt(peg$currPos))) {
              s3 = input.charAt(peg$currPos);
              peg$currPos++;
            } else {
              s3 = peg$FAILED;
              if (peg$silentFails === 0) { peg$fail(peg$c30); }
            }
          }
        }
        if (s2 !== peg$FAILED) {
          if (input.charCodeAt(peg$currPos) === 34) {
            s3 = peg$c27;
            peg$currPos++;
          } else {
            s3 = peg$FAILED;
            if (peg$silentFails === 0) { peg$fail(peg$c28); }
          }
          if (s3 !== peg$FAILED) {
            peg$reportedPos = s0;
            s1 = peg$c31(s2);
            s0 = s1;
          } else {
            peg$currPos = s0;
            s0 = peg$c0;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$c0;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$c0;
      }
      if (s0 === peg$FAILED) {
        s0 = peg$currPos;
        if (input.charCodeAt(peg$currPos) === 39) {
          s1 = peg$c32;
          peg$currPos++;
        } else {
          s1 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c33); }
        }
        if (s1 !== peg$FAILED) {
          s2 = [];
          s3 = peg$parseescape();
          if (s3 === peg$FAILED) {
            if (peg$c34.test(input.charAt(peg$currPos))) {
              s3 = input.charAt(peg$currPos);
              peg$currPos++;
            } else {
              s3 = peg$FAILED;
              if (peg$silentFails === 0) { peg$fail(peg$c35); }
            }
          }
          while (s3 !== peg$FAILED) {
            s2.push(s3);
            s3 = peg$parseescape();
            if (s3 === peg$FAILED) {
              if (peg$c34.test(input.charAt(peg$currPos))) {
                s3 = input.charAt(peg$currPos);
                peg$currPos++;
              } else {
                s3 = peg$FAILED;
                if (peg$silentFails === 0) { peg$fail(peg$c35); }
              }
            }
          }
          if (s2 !== peg$FAILED) {
            if (input.charCodeAt(peg$currPos) === 39) {
              s3 = peg$c32;
              peg$currPos++;
            } else {
              s3 = peg$FAILED;
              if (peg$silentFails === 0) { peg$fail(peg$c33); }
            }
            if (s3 !== peg$FAILED) {
              peg$reportedPos = s0;
              s1 = peg$c31(s2);
              s0 = s1;
            } else {
              peg$currPos = s0;
              s0 = peg$c0;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$c0;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$c0;
        }
      }

      return s0;
    }

    function peg$parsedumb_string() {
      var s0, s1, s2;

      s0 = peg$currPos;
      s1 = [];
      if (peg$c36.test(input.charAt(peg$currPos))) {
        s2 = input.charAt(peg$currPos);
        peg$currPos++;
      } else {
        s2 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c37); }
      }
      while (s2 !== peg$FAILED) {
        s1.push(s2);
        if (peg$c36.test(input.charAt(peg$currPos))) {
          s2 = input.charAt(peg$currPos);
          peg$currPos++;
        } else {
          s2 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c37); }
        }
      }
      if (s1 !== peg$FAILED) {
        peg$reportedPos = s0;
        s1 = peg$c38(s1);
      }
      s0 = s1;

      return s0;
    }

    function peg$parsenull() {
      var s0, s1;

      s0 = peg$currPos;
      if (input.substr(peg$currPos, 4) === peg$c39) {
        s1 = peg$c39;
        peg$currPos += 4;
      } else {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c40); }
      }
      if (s1 !== peg$FAILED) {
        peg$reportedPos = s0;
        s1 = peg$c41();
      }
      s0 = s1;

      return s0;
    }

    function peg$parseundefined() {
      var s0, s1, s2, s3, s4, s5;

      s0 = peg$currPos;
      if (input.substr(peg$currPos, 9) === peg$c42) {
        s1 = peg$c42;
        peg$currPos += 9;
      } else {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c43); }
      }
      if (s1 === peg$FAILED) {
        s1 = peg$currPos;
        if (input.substr(peg$currPos, 4) === peg$c44) {
          s2 = peg$c44;
          peg$currPos += 4;
        } else {
          s2 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c45); }
        }
        if (s2 !== peg$FAILED) {
          s3 = peg$parsews();
          if (s3 !== peg$FAILED) {
            s4 = [];
            if (peg$c36.test(input.charAt(peg$currPos))) {
              s5 = input.charAt(peg$currPos);
              peg$currPos++;
            } else {
              s5 = peg$FAILED;
              if (peg$silentFails === 0) { peg$fail(peg$c37); }
            }
            if (s5 !== peg$FAILED) {
              while (s5 !== peg$FAILED) {
                s4.push(s5);
                if (peg$c36.test(input.charAt(peg$currPos))) {
                  s5 = input.charAt(peg$currPos);
                  peg$currPos++;
                } else {
                  s5 = peg$FAILED;
                  if (peg$silentFails === 0) { peg$fail(peg$c37); }
                }
              }
            } else {
              s4 = peg$c0;
            }
            if (s4 !== peg$FAILED) {
              s2 = [s2, s3, s4];
              s1 = s2;
            } else {
              peg$currPos = s1;
              s1 = peg$c0;
            }
          } else {
            peg$currPos = s1;
            s1 = peg$c0;
          }
        } else {
          peg$currPos = s1;
          s1 = peg$c0;
        }
      }
      if (s1 !== peg$FAILED) {
        peg$reportedPos = s0;
        s1 = peg$c46();
      }
      s0 = s1;

      return s0;
    }

    function peg$parsews() {
      var s0, s1;

      peg$silentFails++;
      s0 = [];
      if (peg$c48.test(input.charAt(peg$currPos))) {
        s1 = input.charAt(peg$currPos);
        peg$currPos++;
      } else {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c49); }
      }
      while (s1 !== peg$FAILED) {
        s0.push(s1);
        if (peg$c48.test(input.charAt(peg$currPos))) {
          s1 = input.charAt(peg$currPos);
          peg$currPos++;
        } else {
          s1 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c49); }
        }
      }
      peg$silentFails--;
      if (s0 === peg$FAILED) {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c47); }
      }

      return s0;
    }

    function peg$parseescape() {
      var s0, s1, s2;

      s0 = peg$currPos;
      if (input.charCodeAt(peg$currPos) === 92) {
        s1 = peg$c50;
        peg$currPos++;
      } else {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c51); }
      }
      if (s1 !== peg$FAILED) {
        if (input.length > peg$currPos) {
          s2 = input.charAt(peg$currPos);
          peg$currPos++;
        } else {
          s2 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c52); }
        }
        if (s2 !== peg$FAILED) {
          peg$reportedPos = s0;
          s1 = peg$c53(s2);
          s0 = s1;
        } else {
          peg$currPos = s0;
          s0 = peg$c0;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$c0;
      }

      return s0;
    }


    	var util = _dereq_("../util");

    	function flatten(arr) {
    		return arr.reduce(function(m, v) {
    			if (Array.isArray(v)) m = m.concat(flatten(v));
    			else m.push(v);
    			return m;
    		}, []);
    	}


    peg$result = peg$startRuleFunction();

    if (peg$result !== peg$FAILED && peg$currPos === input.length) {
      return peg$result;
    } else {
      if (peg$result !== peg$FAILED && peg$currPos < input.length) {
        peg$fail({ type: "end", description: "end of input" });
      }

      throw peg$buildException(null, peg$maxFailExpected, peg$maxFailPos);
    }
  }

  return {
    SyntaxError: SyntaxError,
    parse:       parse
  };
})();
},{"../util":20}],12:[function(_dereq_,module,exports){
var Temple = _dereq_("../temple"),
	Binding = _dereq_("../binding"),
	NODE_TYPE = _dereq_("../types"),
	_ = _dereq_("underscore"),
	parse = _dereq_("./parse"),
	util = _dereq_("../util"),
	Section = _dereq_("./section"),
	ArgParser = _dereq_("./arguments.js");

var Mustache =
module.exports = Temple.extend({
	constructor: function(template, data) {
		this._partials = {};
		this._components = {};

		// parse and add template
		template = template || _.result(this, "template");
		if (template != null) this.setTemplate(template);

		// check for class level decorators
		var decorators = _.result(this, "decorators");
		if (_.isObject(decorators)) this.decorate(decorators);

		// check for class level partials
		var partials = _.result(this, "partials");
		if (_.isObject(partials)) this.setPartial(partials);

		Temple.call(this, data);
	},

	render: function() {
		if (this._template == null)
			throw new Error("Expected a template to be set before rendering.");

		return this._processTemplate(this._template);
	},

	// parses and sets the root template
	setTemplate: function(template) {
		if (_.isString(template)) template = parse(template);
		
		if (!_.isObject(template) || template.type !== NODE_TYPE.ROOT)
			throw new Error("Expecting string or parsed template.");

		this._template = template;
		return this;
	},

	// creates a decorator
	decorate: function(name, fn) {
		if (typeof name === "object" && fn == null) {
			_.each(name, function(fn, n) { this.decorate(n, fn); }, this);
			return this;
		}

		if (typeof name !== "string" || name === "") throw new Error("Expecting non-empty string for decorator name.");
		if (typeof fn !== "function") throw new Error("Expecting function for decorator.");

		if (this._decorators == null) this._decorators = {};
		if (this._decorators[name] == null) this._decorators[name] = [];
		if (!~this._decorators[name].indexOf(fn)) this._decorators[name].push(fn);
		
		return this;
	},

	// finds all decorators, locally and in parent
	findDecorators: function(name) {
		var d = [];
		
		if (this._decorators != null && _.isArray(this._decorators[name]))
			d = d.concat(this._decorators[name]);

		if (this.parent != null) d = d.concat(this.parent.findDecorators(name));
		
		return _.unique(d);
	},

	// removes a decorator
	stopDecorating: function(name, fn) {
		if (typeof name === "function" && fn == null) {
			fn = name;
			name = null;
		}

		if (this._decorators == null || (name == null && fn == null)) {
			this._decorators = {};
		}

		else if (fn == null) {
			delete this._decorators[name];
		}

		else if (name == null) {
			_.each(this._decorators, function(d, n) {
				this._decorators[n] = d.filter(function(f) { return f !== fn });
			}, this);
		}

		else {
			var d = this._decorators[name], index;
			
			if (_.isArray(d)) {
				index = d.indexOf(fn);
				if (index > -1) d.splice(index, 1);
			}
		}

		return this;
	},

	// sets partial by name
	setPartial: function(name, partial) {
		if (_.isObject(name) && partial == null) {
			_.each(name, function(p, n) { this.setPartial(n, p); }, this);
			return this;
		}

		if (!_.isString(name) && name !== "")
			throw new Error("Expecting non-empty string for partial name.");
		
		if (_.isString(partial)) partial = parse(partial);
		if (_.isObject(partial) && partial.type === NODE_TYPE.ROOT) partial = Mustache.extend({ template: partial });
		if (partial != null && !util.isSubClass(Temple, partial))
			throw new Error("Expecting string template, parsed template or Temple subclass for partial.");

		if (partial == null) {
			delete this._partials[name];
			partial = void 0;
		} else {
			this._partials[name] = partial;
		}

		this.emit("partial", name, partial);
		this.emit("partial:" + name, partial);
		
		return this;
	},

	// looks through parents for partial
	findPartial: function(name) {
		var partial = this._partials[name];

		if (partial == null && this.parent != null) {
			partial = this.parent.findPartial(name);
		}

		return partial;
	},

	// returns all the component instances as specified by partial name
	getComponents: function(name) {
		return this._components[name] || [];
	},

	_attrToDecorator: function(attr, binding) {
		var decorators = this.findDecorators(attr.name),
			temple = this,
			processed, targs, directive;
		
		if (decorators.length) {
			processed = decorators.map(function(fn) {
				return fn.call(temple, binding.node, attr.children);
			}).filter(function(d) {
				return typeof d === "object";
			});

			processed.some(function(d) {
				if (d.parse !== false) {
					targs = convertTemplateToArgs(attr.children);
					return true;
				}
			});

			directive = function(scope) {
				var raw, args = [];

				if (targs != null) {
					raw = temple._processStringTemplate(targs, scope);
					args = ArgParser.parse(raw, { scope: scope });
				}

				processed.forEach(function(d) {
					if (typeof d.update === "function") {
						d.update.apply(scope, d.parse !== false ? args : []);
					}
				}, this);
			}

			binding.directive(directive);

			binding.once("destroy", function() {
				processed.forEach(function(d) {
					if (typeof d.destroy === "function") d.destroy.call(temple);
				});

				binding.killDirective(directive);
			});
		}

		else {
			binding.attr(attr.name, function(scope) {
				return temple._processStringTemplate(attr.children, scope);
			});
		}
	},

	_processTemplate: function(template) {
		if (_.isArray(template)) return template.map(function(t) {
			return this._processTemplate(t);
		}, this).filter(function(b) { return b != null; });

		var temple = this;

		switch(template.type) {
			case NODE_TYPE.ROOT:
				return new Binding(this._processTemplate(template.children));

			case NODE_TYPE.ELEMENT:
				var binding = new Binding.Element(template.name, this._processTemplate(template.children));

				template.attributes.forEach(function(attr) {
					this._attrToDecorator(attr, binding);
				}, this);

				return binding;

			case NODE_TYPE.TEXT:
				return new Binding.Text(template.value);

			case NODE_TYPE.INTERPOLATOR:
				return new Binding.Text(function(scope) {
					return scope.get(template.value);
				});

			case NODE_TYPE.TRIPLE:
				return new Binding.HTML(function(scope) {
					return scope.get(template.value);
				});

			case NODE_TYPE.INVERTED:
			case NODE_TYPE.SECTION:
				var body = function() { return temple._processTemplate(template.children); }
				return new Section(template.value, body, template.type === NODE_TYPE.INVERTED);

			case NODE_TYPE.PARTIAL:
				var name = template.value,
					partial = this.findPartial(name),
					comps = this._components,
					comp;

				if (partial != null) {
					comp = new partial;
					comp.parent = this;
					
					if (comps[name] == null) comps[name] = [];
					comps[name].push(comp);

					comp.once("destroy", function() {
						var index = comps[name].indexOf(comp);
						if (~index) comps[name].splice(index, 1);
					});
					
					return new Binding.Component(comp);
				}

				break;

			default:
				console.log(template);
		}
	},

	_processStringTemplate: function(template, scope) {
		if (_.isArray(template)) return template.map(function(t) {
			return this._processStringTemplate(t, scope);
		},this).filter(function(b) { return b != null; }).join("");

		switch(template.type) {
			case NODE_TYPE.TEXT:
				return template.value;

			case NODE_TYPE.INTERPOLATOR:
			case NODE_TYPE.TRIPLE:
				var val = scope.get(template.value);
				return val != null ? val.toString() : "";

			case NODE_TYPE.SECTION:
			case NODE_TYPE.INVERTED:
				var inverted = template.type === NODE_TYPE.INVERTED,
					path = template.value,
					val = scope.get(path),
					isEmpty = Section.isEmpty(val);

				scope.depend(util.joinPathParts(path, "*"));

				if (!(isEmpty ^ inverted)) {
					if (_.isArray(val) && !inverted) {
						return val.map(function(v, i) {
							var nscope = scope.createScopeFromPath(util.joinPathParts(path, i));
							return this._processStringTemplate(template.children, nscope);
						}, this).join("");
					} else {
						var nscope = scope.createScopeFromPath(template.value);
						return this._processStringTemplate(template.children, nscope);
					}
				} else {
					return;
				}
				
			default:
				console.log(template);
		}
	}
}, {
	parse: parse
});

function convertTemplateToArgs(template) {
	if (_.isArray(template)) return template.map(function(t) {
		return convertTemplateToArgs(t);
	}).filter(function(b) { return b != null; });

	switch (template.type) {
		case NODE_TYPE.INTERPOLATOR:
		case NODE_TYPE.TRIPLE:
			template = {
				type: NODE_TYPE.TEXT,
				value: "{{" + template.value + "}}"
			}
			break;

		case NODE_TYPE.SECTION:
		case NODE_TYPE.INVERTED:
			template = _.clone(template);
			template.children = convertTemplateToArgs(template.children);
			break;
	}

	return template;
}
},{"../binding":6,"../temple":18,"../types":19,"../util":20,"./arguments.js":11,"./parse":13,"./section":14,"underscore":25}],13:[function(_dereq_,module,exports){
var Hogan = _dereq_("hogan.js"),
	xml = _dereq_('./xml.js'),
	NODE_TYPE = _dereq_("../types"),
	HTML_DELIMITERS = [ "[#@!", "!@#]" ];

var parse =
module.exports = function(text, delimiters) {
	var tree = toTree(text.trim(), delimiters);
	
	return {
		type: NODE_TYPE.ROOT,
		children: compileXML(tree)
	}
}

function toTree(text, delimiters){
	return Hogan.parse(Hogan.scan(text, delimiters));
}

function parseXML(tree) {
	var src = "",
		d = HTML_DELIMITERS;

	tree.forEach(function(node, index) {
		if (node.tag === "_t") {
			src += node.text.toString();
		} else {
			src += d[0] + index + d[1];
		}
	});

	return xml.parse(src);
}

function parseXMLText(text, tree) {
	var d = HTML_DELIMITERS;

	return text.split(d[0]).reduce(function(m, v) {
		var end = v.indexOf(d[1]), toPush;
		
		if (end >= 0) {
			var index = parseInt(v.substr(0, end), 10);
			if (!isNaN(index) && index >= 0) m.push(index);
			
			toPush = v.substr(end + d[1].length);
		} else {
			toPush = v;
		}

		if (toPush !== "") m.push(toPush);

		return m;
	}, []).map(function(v) {
		if (typeof v !== "number") return v;
		return tree[v];
	});
}

function appendText(m, text) {
	var last = m[m.length - 1];
	if (last != null && last.type === NODE_TYPE.TEXT) {
		last.value += text;
	} else {
		m.push({
			type: NODE_TYPE.TEXT,
			value: text
		});
	}
}

function compileStash(nodes, isXML) {
	var processNodes = isXML ? compileXML : compileStash;

	return nodes.reduce(function(m, part) {
		if (typeof part === "string") {
			appendText(m, part);
		} else {
			switch (part.tag) {
				case "_t":
					appendText(m, part.text.toString());
					break;

				case "\n":
					appendText(m, "\n");
					break;

				case "_v":
					m.push({
						type: NODE_TYPE.INTERPOLATOR,
						value: part.n
					});
					break;

				case "&":
				case "{":
					m.push({
						type: NODE_TYPE.TRIPLE,
						value: part.n
					});
					break;

				case "#":
					m.push({
						type: NODE_TYPE.SECTION,
						value: part.n,
						children: processNodes(part.nodes, isXML)
					});
					break;

				case "^":
					m.push({
						type: NODE_TYPE.INVERTED,
						value: part.n,
						children: processNodes(part.nodes, isXML)
					});
					break;

				case ">":
					m.push({
						type: NODE_TYPE.PARTIAL,
						value: part.n
					});
					break;

				case "!":
					break;

				default:
					console.log(part);
					break;
			}
		}

		return m;
	}, []);
}

function compileAttributes(attrs, tree) {
	var parsed = [], attr, i;

	for (i in attrs) {
		attr = attrs[i];

		parsed.push({
			type: NODE_TYPE.ATTRIBUTE,
			name: attr.name,
			children: compileStash(parseXMLText(attr.value, tree), false)
		});
	}

	return parsed;
}

function compileElements(nodes, tree) {
	return nodes.map(function(el) {
		if (el.type === "text") {
			return compileStash(parseXMLText(el.value, tree), true);
		} else if (el.type === "element") {
			return {
				type: NODE_TYPE.ELEMENT,
				name: el.name,
				attributes: compileAttributes(el.attributes, tree),
				children: compileElements(el.children, tree)
			}
		}
	}).reduce(function(m, el) {
		if (Array.isArray(el)) m = m.concat(el);
		else if (el != null) m.push(el);
		return m;
	}, []);
}

function compileXML(tree) {
	return compileElements(parseXML(tree), tree);
}
},{"../types":19,"./xml.js":15,"hogan.js":23}],14:[function(_dereq_,module,exports){
var _ = _dereq_("underscore"),
	Binding = _dereq_("../binding"),
	util = _dereq_("../util"),
	Model = _dereq_("../model"),
	Deps = _dereq_("../deps");

var Section =
module.exports = Binding.extend({
	constructor: function(path, body, inverted) {
		if (!_.isString(path))
			throw new Error("Expecting string path.");

		if (!_.isFunction(body))
			throw new Error("Expecting function for body.");

		this.path = path;
		this.body = function() {
			var args = arguments, ctx = this;
			return Deps.nonreactive(function() {
				return body.apply(ctx, args);
			});
		}
		this.inverted = !!inverted;
		this.binding = null;
		this.placeholder = document.createComment(_.uniqueId("$"));

		Binding.call(this);
	},

	addChild: function() {
		throw new Error("Section bindings can't have children.");
	},

	destroyBinding: function() {
		if (this.binding != null) {
			this.binding.destroy();
			delete this.binding;
		}

		return this;
	},

	refreshBinding: function() {
		if (this.binding != null) {
			var parent = this.placeholder.parentNode;
			if (parent != null) this.binding.appendTo(parent, this.placeholder);
		}

		return this;
	},

	dependOnLength: function(scope) {
		if (!Deps.active) return this;
		
		var path, self = this,
			dep = new Deps.Dependency;

		path = util.joinPathParts(this.path, "length");
		scope.observe(path, onChange);

		function onChange(s) {
			if ((self.inverted && s.value > 0) ||
				(!self.inverted && s.value === 0)) dep.changed();
		}

		Deps.currentComputation.onInvalidate(function() {
			scope.stopObserving(path, onChange);
		});

		dep.depend();
		return this;
	},

	render: function(scope) {
		this.autorun("render", function(comp) {
			this.destroyBinding();

			var model = (scope.findModel(this.path) || scope).getModel(this.path),
				val = model.handle("toArray"),
				isEmpty;

			scope.depend(this.path);
			if (!_.isArray(val)) val = scope.get(this.path);
			isEmpty = Section.isEmpty(val);
			
			if (isEmpty && this.inverted) {
				if (_.isArray(val)) this.dependOnLength(scope);
				this.binding = new Binding.Context(this.path, this.body(0));
			} else if (!isEmpty && !this.inverted) {
				if (_.isArray(val)) {
					this.dependOnLength(scope);
					this.binding = new Binding.Each(this.path, this.body.bind(this));
				} else this.binding = new Binding.Context(this.path, this.body(0));
			} else {
				// listen for changes to children to update the binding type
				scope.depend(util.joinPathParts(this.path, "*" ));
			}

			if (this.binding != null) {
				this.binding.render(scope);
				this.refreshBinding();
			}
		});

		return this;
	},

	appendTo: function(parent, before) {
		parent.insertBefore(this.placeholder, before);
		this.refreshBinding();
		return this;
	},

	find: function(selector) {
		return this.binding != null ? this.binding.find(selector) : null;
	},

	findAll: function(selector) {
		return this.binding != null ? this.binding.findAll(selector) : [];
	},

	destroy: function() {
		this.destroyBinding();
		var parent = this.placeholder.parentNode;
		if (parent != null) parent.removeChild(this.placeholder);

		return Binding.prototype.destroy.apply(this, arguments);
	}
}, {
	isEmpty: function(val) {
		return !val || (_.isArray(val) && !val.length);
	}
});
},{"../binding":6,"../deps":8,"../model":10,"../util":20,"underscore":25}],15:[function(_dereq_,module,exports){
module.exports = (function() {
  /*
   * Generated by PEG.js 0.8.0.
   *
   * http://pegjs.majda.cz/
   */

  function peg$subclass(child, parent) {
    function ctor() { this.constructor = child; }
    ctor.prototype = parent.prototype;
    child.prototype = new ctor();
  }

  function SyntaxError(message, expected, found, offset, line, column) {
    this.message  = message;
    this.expected = expected;
    this.found    = found;
    this.offset   = offset;
    this.line     = line;
    this.column   = column;

    this.name     = "SyntaxError";
  }

  peg$subclass(SyntaxError, Error);

  function parse(input) {
    var options = arguments.length > 1 ? arguments[1] : {},

        peg$FAILED = {},

        peg$startRuleFunctions = { start: peg$parsestart },
        peg$startRuleFunction  = peg$parsestart,

        peg$c0 = [],
        peg$c1 = function(nodes) { return _.compact(nodes); },
        peg$c2 = peg$FAILED,
        peg$c3 = /^[^<]/,
        peg$c4 = { type: "class", value: "[^<]", description: "[^<]" },
        peg$c5 = function(text) { return { type: "text", value: text.join("") }; },
        peg$c6 = "<!--",
        peg$c7 = { type: "literal", value: "<!--", description: "\"<!--\"" },
        peg$c8 = "-->",
        peg$c9 = { type: "literal", value: "-->", description: "\"-->\"" },
        peg$c10 = function(v) {
        		return { type: "comment", value: v.trim() };
        	},
        peg$c11 = void 0,
        peg$c12 = { type: "any", description: "any character" },
        peg$c13 = null,
        peg$c14 = function(l, r) { return l + (r != null ? r : ""); },
        peg$c15 = function(start, nodes, end) {
        		if (start.name.toLowerCase() !== end.toLowerCase()) {
        			throw new Error("Element tag mismatch: " + start.name + " !== " + end);
        		}

        		start.type = "element";
        		start.children = nodes;
        		return start;
        	},
        peg$c16 = "<",
        peg$c17 = { type: "literal", value: "<", description: "\"<\"" },
        peg$c18 = "/>",
        peg$c19 = { type: "literal", value: "/>", description: "\"/>\"" },
        peg$c20 = function(tagname, attributes) {
        		return {
        			name: tagname,
        			attributes: attributes,
        			children: [],
        			type: "element"
        		};
        	},
        peg$c21 = ">",
        peg$c22 = { type: "literal", value: ">", description: "\">\"" },
        peg$c23 = function(tagname, attributes) {
        		return { name: tagname, attributes: attributes };
        	},
        peg$c24 = "</",
        peg$c25 = { type: "literal", value: "</", description: "\"</\"" },
        peg$c26 = function(tagname) { return tagname; },
        peg$c27 = "=",
        peg$c28 = { type: "literal", value: "=", description: "\"=\"" },
        peg$c29 = function(key, value) { return { name: key, value: value != null ? value[2] : "" }; },
        peg$c30 = /^[a-z0-9_\-]/i,
        peg$c31 = { type: "class", value: "[a-z0-9_\\-]i", description: "[a-z0-9_\\-]i" },
        peg$c32 = function(k) { return k.join(""); },
        peg$c33 = "\"",
        peg$c34 = { type: "literal", value: "\"", description: "\"\\\"\"" },
        peg$c35 = /^[^"]/,
        peg$c36 = { type: "class", value: "[^\"]", description: "[^\"]" },
        peg$c37 = function(v) { return v.join(""); },
        peg$c38 = "'",
        peg$c39 = { type: "literal", value: "'", description: "\"'\"" },
        peg$c40 = /^[^']/,
        peg$c41 = { type: "class", value: "[^']", description: "[^']" },
        peg$c42 = { type: "other", description: "whitespace" },
        peg$c43 = /^[ \t\n\r]/,
        peg$c44 = { type: "class", value: "[ \\t\\n\\r]", description: "[ \\t\\n\\r]" },
        peg$c45 = "\\",
        peg$c46 = { type: "literal", value: "\\", description: "\"\\\\\"" },
        peg$c47 = function(char) { return char; },

        peg$currPos          = 0,
        peg$reportedPos      = 0,
        peg$cachedPos        = 0,
        peg$cachedPosDetails = { line: 1, column: 1, seenCR: false },
        peg$maxFailPos       = 0,
        peg$maxFailExpected  = [],
        peg$silentFails      = 0,

        peg$result;

    if ("startRule" in options) {
      if (!(options.startRule in peg$startRuleFunctions)) {
        throw new Error("Can't start parsing from rule \"" + options.startRule + "\".");
      }

      peg$startRuleFunction = peg$startRuleFunctions[options.startRule];
    }

    function text() {
      return input.substring(peg$reportedPos, peg$currPos);
    }

    function offset() {
      return peg$reportedPos;
    }

    function line() {
      return peg$computePosDetails(peg$reportedPos).line;
    }

    function column() {
      return peg$computePosDetails(peg$reportedPos).column;
    }

    function expected(description) {
      throw peg$buildException(
        null,
        [{ type: "other", description: description }],
        peg$reportedPos
      );
    }

    function error(message) {
      throw peg$buildException(message, null, peg$reportedPos);
    }

    function peg$computePosDetails(pos) {
      function advance(details, startPos, endPos) {
        var p, ch;

        for (p = startPos; p < endPos; p++) {
          ch = input.charAt(p);
          if (ch === "\n") {
            if (!details.seenCR) { details.line++; }
            details.column = 1;
            details.seenCR = false;
          } else if (ch === "\r" || ch === "\u2028" || ch === "\u2029") {
            details.line++;
            details.column = 1;
            details.seenCR = true;
          } else {
            details.column++;
            details.seenCR = false;
          }
        }
      }

      if (peg$cachedPos !== pos) {
        if (peg$cachedPos > pos) {
          peg$cachedPos = 0;
          peg$cachedPosDetails = { line: 1, column: 1, seenCR: false };
        }
        advance(peg$cachedPosDetails, peg$cachedPos, pos);
        peg$cachedPos = pos;
      }

      return peg$cachedPosDetails;
    }

    function peg$fail(expected) {
      if (peg$currPos < peg$maxFailPos) { return; }

      if (peg$currPos > peg$maxFailPos) {
        peg$maxFailPos = peg$currPos;
        peg$maxFailExpected = [];
      }

      peg$maxFailExpected.push(expected);
    }

    function peg$buildException(message, expected, pos) {
      function cleanupExpected(expected) {
        var i = 1;

        expected.sort(function(a, b) {
          if (a.description < b.description) {
            return -1;
          } else if (a.description > b.description) {
            return 1;
          } else {
            return 0;
          }
        });

        while (i < expected.length) {
          if (expected[i - 1] === expected[i]) {
            expected.splice(i, 1);
          } else {
            i++;
          }
        }
      }

      function buildMessage(expected, found) {
        function stringEscape(s) {
          function hex(ch) { return ch.charCodeAt(0).toString(16).toUpperCase(); }

          return s
            .replace(/\\/g,   '\\\\')
            .replace(/"/g,    '\\"')
            .replace(/\x08/g, '\\b')
            .replace(/\t/g,   '\\t')
            .replace(/\n/g,   '\\n')
            .replace(/\f/g,   '\\f')
            .replace(/\r/g,   '\\r')
            .replace(/[\x00-\x07\x0B\x0E\x0F]/g, function(ch) { return '\\x0' + hex(ch); })
            .replace(/[\x10-\x1F\x80-\xFF]/g,    function(ch) { return '\\x'  + hex(ch); })
            .replace(/[\u0180-\u0FFF]/g,         function(ch) { return '\\u0' + hex(ch); })
            .replace(/[\u1080-\uFFFF]/g,         function(ch) { return '\\u'  + hex(ch); });
        }

        var expectedDescs = new Array(expected.length),
            expectedDesc, foundDesc, i;

        for (i = 0; i < expected.length; i++) {
          expectedDescs[i] = expected[i].description;
        }

        expectedDesc = expected.length > 1
          ? expectedDescs.slice(0, -1).join(", ")
              + " or "
              + expectedDescs[expected.length - 1]
          : expectedDescs[0];

        foundDesc = found ? "\"" + stringEscape(found) + "\"" : "end of input";

        return "Expected " + expectedDesc + " but " + foundDesc + " found.";
      }

      var posDetails = peg$computePosDetails(pos),
          found      = pos < input.length ? input.charAt(pos) : null;

      if (expected !== null) {
        cleanupExpected(expected);
      }

      return new SyntaxError(
        message !== null ? message : buildMessage(expected, found),
        expected,
        found,
        pos,
        posDetails.line,
        posDetails.column
      );
    }

    function peg$parsestart() {
      var s0;

      s0 = peg$parsehtml();

      return s0;
    }

    function peg$parsehtml() {
      var s0, s1, s2;

      s0 = peg$currPos;
      s1 = [];
      s2 = peg$parsecommentNode();
      if (s2 === peg$FAILED) {
        s2 = peg$parseelementNode();
        if (s2 === peg$FAILED) {
          s2 = peg$parsetextNode();
        }
      }
      while (s2 !== peg$FAILED) {
        s1.push(s2);
        s2 = peg$parsecommentNode();
        if (s2 === peg$FAILED) {
          s2 = peg$parseelementNode();
          if (s2 === peg$FAILED) {
            s2 = peg$parsetextNode();
          }
        }
      }
      if (s1 !== peg$FAILED) {
        peg$reportedPos = s0;
        s1 = peg$c1(s1);
      }
      s0 = s1;

      return s0;
    }

    function peg$parsetextNode() {
      var s0, s1, s2;

      s0 = peg$currPos;
      s1 = [];
      if (peg$c3.test(input.charAt(peg$currPos))) {
        s2 = input.charAt(peg$currPos);
        peg$currPos++;
      } else {
        s2 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c4); }
      }
      if (s2 !== peg$FAILED) {
        while (s2 !== peg$FAILED) {
          s1.push(s2);
          if (peg$c3.test(input.charAt(peg$currPos))) {
            s2 = input.charAt(peg$currPos);
            peg$currPos++;
          } else {
            s2 = peg$FAILED;
            if (peg$silentFails === 0) { peg$fail(peg$c4); }
          }
        }
      } else {
        s1 = peg$c2;
      }
      if (s1 !== peg$FAILED) {
        peg$reportedPos = s0;
        s1 = peg$c5(s1);
      }
      s0 = s1;

      return s0;
    }

    function peg$parsecommentNode() {
      var s0, s1, s2, s3;

      s0 = peg$currPos;
      if (input.substr(peg$currPos, 4) === peg$c6) {
        s1 = peg$c6;
        peg$currPos += 4;
      } else {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c7); }
      }
      if (s1 !== peg$FAILED) {
        s2 = peg$parsecommentValue();
        if (s2 !== peg$FAILED) {
          if (input.substr(peg$currPos, 3) === peg$c8) {
            s3 = peg$c8;
            peg$currPos += 3;
          } else {
            s3 = peg$FAILED;
            if (peg$silentFails === 0) { peg$fail(peg$c9); }
          }
          if (s3 !== peg$FAILED) {
            peg$reportedPos = s0;
            s1 = peg$c10(s2);
            s0 = s1;
          } else {
            peg$currPos = s0;
            s0 = peg$c2;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$c2;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$c2;
      }

      return s0;
    }

    function peg$parsecommentValue() {
      var s0, s1, s2;

      s0 = peg$currPos;
      peg$silentFails++;
      if (input.substr(peg$currPos, 3) === peg$c8) {
        s1 = peg$c8;
        peg$currPos += 3;
      } else {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c9); }
      }
      peg$silentFails--;
      if (s1 !== peg$FAILED) {
        peg$currPos = s0;
        s0 = peg$c11;
      } else {
        s0 = peg$c2;
      }
      if (s0 === peg$FAILED) {
        s0 = peg$currPos;
        if (input.length > peg$currPos) {
          s1 = input.charAt(peg$currPos);
          peg$currPos++;
        } else {
          s1 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c12); }
        }
        if (s1 !== peg$FAILED) {
          s2 = peg$parsecommentValue();
          if (s2 === peg$FAILED) {
            s2 = peg$c13;
          }
          if (s2 !== peg$FAILED) {
            peg$reportedPos = s0;
            s1 = peg$c14(s1, s2);
            s0 = s1;
          } else {
            peg$currPos = s0;
            s0 = peg$c2;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$c2;
        }
      }

      return s0;
    }

    function peg$parseelementNode() {
      var s0, s1, s2, s3;

      s0 = peg$parseelementSelfClosed();
      if (s0 === peg$FAILED) {
        s0 = peg$currPos;
        s1 = peg$parseelementStart();
        if (s1 !== peg$FAILED) {
          s2 = peg$parsehtml();
          if (s2 !== peg$FAILED) {
            s3 = peg$parseelementEnd();
            if (s3 !== peg$FAILED) {
              peg$reportedPos = s0;
              s1 = peg$c15(s1, s2, s3);
              s0 = s1;
            } else {
              peg$currPos = s0;
              s0 = peg$c2;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$c2;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$c2;
        }
      }

      return s0;
    }

    function peg$parseelementSelfClosed() {
      var s0, s1, s2, s3, s4;

      s0 = peg$currPos;
      if (input.charCodeAt(peg$currPos) === 60) {
        s1 = peg$c16;
        peg$currPos++;
      } else {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c17); }
      }
      if (s1 !== peg$FAILED) {
        s2 = peg$parsekey();
        if (s2 !== peg$FAILED) {
          s3 = [];
          s4 = peg$parseattribute();
          while (s4 !== peg$FAILED) {
            s3.push(s4);
            s4 = peg$parseattribute();
          }
          if (s3 !== peg$FAILED) {
            if (input.substr(peg$currPos, 2) === peg$c18) {
              s4 = peg$c18;
              peg$currPos += 2;
            } else {
              s4 = peg$FAILED;
              if (peg$silentFails === 0) { peg$fail(peg$c19); }
            }
            if (s4 !== peg$FAILED) {
              peg$reportedPos = s0;
              s1 = peg$c20(s2, s3);
              s0 = s1;
            } else {
              peg$currPos = s0;
              s0 = peg$c2;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$c2;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$c2;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$c2;
      }

      return s0;
    }

    function peg$parseelementStart() {
      var s0, s1, s2, s3, s4;

      s0 = peg$currPos;
      if (input.charCodeAt(peg$currPos) === 60) {
        s1 = peg$c16;
        peg$currPos++;
      } else {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c17); }
      }
      if (s1 !== peg$FAILED) {
        s2 = peg$parsekey();
        if (s2 !== peg$FAILED) {
          s3 = [];
          s4 = peg$parseattribute();
          while (s4 !== peg$FAILED) {
            s3.push(s4);
            s4 = peg$parseattribute();
          }
          if (s3 !== peg$FAILED) {
            if (input.charCodeAt(peg$currPos) === 62) {
              s4 = peg$c21;
              peg$currPos++;
            } else {
              s4 = peg$FAILED;
              if (peg$silentFails === 0) { peg$fail(peg$c22); }
            }
            if (s4 !== peg$FAILED) {
              peg$reportedPos = s0;
              s1 = peg$c23(s2, s3);
              s0 = s1;
            } else {
              peg$currPos = s0;
              s0 = peg$c2;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$c2;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$c2;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$c2;
      }

      return s0;
    }

    function peg$parseelementEnd() {
      var s0, s1, s2, s3;

      s0 = peg$currPos;
      if (input.substr(peg$currPos, 2) === peg$c24) {
        s1 = peg$c24;
        peg$currPos += 2;
      } else {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c25); }
      }
      if (s1 !== peg$FAILED) {
        s2 = peg$parsekey();
        if (s2 !== peg$FAILED) {
          if (input.charCodeAt(peg$currPos) === 62) {
            s3 = peg$c21;
            peg$currPos++;
          } else {
            s3 = peg$FAILED;
            if (peg$silentFails === 0) { peg$fail(peg$c22); }
          }
          if (s3 !== peg$FAILED) {
            peg$reportedPos = s0;
            s1 = peg$c26(s2);
            s0 = s1;
          } else {
            peg$currPos = s0;
            s0 = peg$c2;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$c2;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$c2;
      }

      return s0;
    }

    function peg$parseattribute() {
      var s0, s1, s2, s3, s4, s5, s6;

      s0 = peg$currPos;
      s1 = peg$parsekey();
      if (s1 !== peg$FAILED) {
        s2 = peg$currPos;
        if (input.charCodeAt(peg$currPos) === 61) {
          s3 = peg$c27;
          peg$currPos++;
        } else {
          s3 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c28); }
        }
        if (s3 !== peg$FAILED) {
          s4 = peg$parsews();
          if (s4 !== peg$FAILED) {
            s5 = peg$parsestring();
            if (s5 !== peg$FAILED) {
              s6 = peg$parsews();
              if (s6 !== peg$FAILED) {
                s3 = [s3, s4, s5, s6];
                s2 = s3;
              } else {
                peg$currPos = s2;
                s2 = peg$c2;
              }
            } else {
              peg$currPos = s2;
              s2 = peg$c2;
            }
          } else {
            peg$currPos = s2;
            s2 = peg$c2;
          }
        } else {
          peg$currPos = s2;
          s2 = peg$c2;
        }
        if (s2 === peg$FAILED) {
          s2 = peg$c13;
        }
        if (s2 !== peg$FAILED) {
          peg$reportedPos = s0;
          s1 = peg$c29(s1, s2);
          s0 = s1;
        } else {
          peg$currPos = s0;
          s0 = peg$c2;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$c2;
      }

      return s0;
    }

    function peg$parsekey() {
      var s0, s1, s2, s3;

      s0 = peg$currPos;
      s1 = peg$parsews();
      if (s1 !== peg$FAILED) {
        s2 = [];
        if (peg$c30.test(input.charAt(peg$currPos))) {
          s3 = input.charAt(peg$currPos);
          peg$currPos++;
        } else {
          s3 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c31); }
        }
        if (s3 !== peg$FAILED) {
          while (s3 !== peg$FAILED) {
            s2.push(s3);
            if (peg$c30.test(input.charAt(peg$currPos))) {
              s3 = input.charAt(peg$currPos);
              peg$currPos++;
            } else {
              s3 = peg$FAILED;
              if (peg$silentFails === 0) { peg$fail(peg$c31); }
            }
          }
        } else {
          s2 = peg$c2;
        }
        if (s2 !== peg$FAILED) {
          s3 = peg$parsews();
          if (s3 !== peg$FAILED) {
            peg$reportedPos = s0;
            s1 = peg$c32(s2);
            s0 = s1;
          } else {
            peg$currPos = s0;
            s0 = peg$c2;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$c2;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$c2;
      }

      return s0;
    }

    function peg$parsestring() {
      var s0, s1, s2, s3;

      s0 = peg$currPos;
      if (input.charCodeAt(peg$currPos) === 34) {
        s1 = peg$c33;
        peg$currPos++;
      } else {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c34); }
      }
      if (s1 !== peg$FAILED) {
        s2 = [];
        s3 = peg$parseescape();
        if (s3 === peg$FAILED) {
          if (peg$c35.test(input.charAt(peg$currPos))) {
            s3 = input.charAt(peg$currPos);
            peg$currPos++;
          } else {
            s3 = peg$FAILED;
            if (peg$silentFails === 0) { peg$fail(peg$c36); }
          }
        }
        while (s3 !== peg$FAILED) {
          s2.push(s3);
          s3 = peg$parseescape();
          if (s3 === peg$FAILED) {
            if (peg$c35.test(input.charAt(peg$currPos))) {
              s3 = input.charAt(peg$currPos);
              peg$currPos++;
            } else {
              s3 = peg$FAILED;
              if (peg$silentFails === 0) { peg$fail(peg$c36); }
            }
          }
        }
        if (s2 !== peg$FAILED) {
          if (input.charCodeAt(peg$currPos) === 34) {
            s3 = peg$c33;
            peg$currPos++;
          } else {
            s3 = peg$FAILED;
            if (peg$silentFails === 0) { peg$fail(peg$c34); }
          }
          if (s3 !== peg$FAILED) {
            peg$reportedPos = s0;
            s1 = peg$c37(s2);
            s0 = s1;
          } else {
            peg$currPos = s0;
            s0 = peg$c2;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$c2;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$c2;
      }
      if (s0 === peg$FAILED) {
        s0 = peg$currPos;
        if (input.charCodeAt(peg$currPos) === 39) {
          s1 = peg$c38;
          peg$currPos++;
        } else {
          s1 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c39); }
        }
        if (s1 !== peg$FAILED) {
          s2 = [];
          s3 = peg$parseescape();
          if (s3 === peg$FAILED) {
            if (peg$c40.test(input.charAt(peg$currPos))) {
              s3 = input.charAt(peg$currPos);
              peg$currPos++;
            } else {
              s3 = peg$FAILED;
              if (peg$silentFails === 0) { peg$fail(peg$c41); }
            }
          }
          while (s3 !== peg$FAILED) {
            s2.push(s3);
            s3 = peg$parseescape();
            if (s3 === peg$FAILED) {
              if (peg$c40.test(input.charAt(peg$currPos))) {
                s3 = input.charAt(peg$currPos);
                peg$currPos++;
              } else {
                s3 = peg$FAILED;
                if (peg$silentFails === 0) { peg$fail(peg$c41); }
              }
            }
          }
          if (s2 !== peg$FAILED) {
            if (input.charCodeAt(peg$currPos) === 39) {
              s3 = peg$c38;
              peg$currPos++;
            } else {
              s3 = peg$FAILED;
              if (peg$silentFails === 0) { peg$fail(peg$c39); }
            }
            if (s3 !== peg$FAILED) {
              peg$reportedPos = s0;
              s1 = peg$c37(s2);
              s0 = s1;
            } else {
              peg$currPos = s0;
              s0 = peg$c2;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$c2;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$c2;
        }
      }

      return s0;
    }

    function peg$parsews() {
      var s0, s1;

      peg$silentFails++;
      s0 = [];
      if (peg$c43.test(input.charAt(peg$currPos))) {
        s1 = input.charAt(peg$currPos);
        peg$currPos++;
      } else {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c44); }
      }
      while (s1 !== peg$FAILED) {
        s0.push(s1);
        if (peg$c43.test(input.charAt(peg$currPos))) {
          s1 = input.charAt(peg$currPos);
          peg$currPos++;
        } else {
          s1 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c44); }
        }
      }
      peg$silentFails--;
      if (s0 === peg$FAILED) {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c42); }
      }

      return s0;
    }

    function peg$parseescape() {
      var s0, s1, s2;

      s0 = peg$currPos;
      if (input.charCodeAt(peg$currPos) === 92) {
        s1 = peg$c45;
        peg$currPos++;
      } else {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c46); }
      }
      if (s1 !== peg$FAILED) {
        if (input.length > peg$currPos) {
          s2 = input.charAt(peg$currPos);
          peg$currPos++;
        } else {
          s2 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c12); }
        }
        if (s2 !== peg$FAILED) {
          peg$reportedPos = s0;
          s1 = peg$c47(s2);
          s0 = s1;
        } else {
          peg$currPos = s0;
          s0 = peg$c2;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$c2;
      }

      return s0;
    }


    	var _ = _dereq_("underscore");


    peg$result = peg$startRuleFunction();

    if (peg$result !== peg$FAILED && peg$currPos === input.length) {
      return peg$result;
    } else {
      if (peg$result !== peg$FAILED && peg$currPos < input.length) {
        peg$fail({ type: "end", description: "end of input" });
      }

      throw peg$buildException(null, peg$maxFailExpected, peg$maxFailPos);
    }
  }

  return {
    SyntaxError: SyntaxError,
    parse:       parse
  };
})();
},{"underscore":25}],16:[function(_dereq_,module,exports){
var util = _dereq_("./util"),
	_ = _dereq_("underscore"),
	Binding = _dereq_("./binding"),
	Scope = _dereq_("./scope");

exports.forceUpdate = function() {
	if (this.binding != null) this.binding.render(this);
	return this;
}

exports.paint = function(parent, beforeNode) {
	if (this.binding == null) {
		var binding = this.render();
		if (Array.isArray(binding)) binding = new Binding(binding);
		if (!(binding instanceof Binding)) throw new Error("Expecting template render method to return an instance of Binding.");
		this.binding = binding;

		this.forceUpdate();
		this.emit("render", this.binding);
	}

	if (_.isString(parent)) parent = document.querySelector(parent);
	if (_.isString(beforeNode)) beforeNode = parent.querySelector(beforeNode);
	if (parent == null) parent = document.createDocumentFragment();
	
	this.binding.appendTo(parent, beforeNode);
	this.emit("paint", parent, beforeNode);

	return this;
}

exports.render = function() {
	throw new Error("Missing render method.");
}

exports.erase = function() {
	if (this.binding != null) {
		this.binding.destroy();
		delete this.binding;
		this.emit("erase");
	}

	return this;
}

exports.toString =
exports.toHTML = function() {
	var binding, html;

	binding = this.render();
	binding.render(this);
	html = binding.toString();
	binding.destroy();
	
	return html;
}

exports.find = function(selector) {
	if (this.binding != null) return this.binding.find(selector);
	return null;
}

exports.findAll = function(selector) {
	if (this.binding != null) return this.binding.findAll(selector);
	return [];
}

exports.destroy = function() {
	this.erase();
	return Scope.prototype.destroy.apply(this, arguments);
}
},{"./binding":6,"./scope":17,"./util":20,"underscore":25}],17:[function(_dereq_,module,exports){
var _ = _dereq_("underscore"),
	util = _dereq_("./util"),
	EventEmitter = _dereq_("events").EventEmitter,
	Model = _dereq_("./model"),
	Deps = _dereq_("./deps");

var proto = {

	constructor: function(model) {
		EventEmitter.call(this);
		this.setMaxListeners(0);

		// convert data to model if isn't one already
		if (!Scope.isScope(model) && !Model.isModel(model)) {
			var data = model;
			model = new Model(_.result(this, "defaults"));
			if (!_.isUndefined(data)) model.set([], data);
		}

		this.models = [];
		this._observers = [];
		this._deps = [];
		this._hidden = {};

		this.addModel(model);
		this.initialize();
	},

	initialize: function() {},

	createScopeFromPath: function(path) {
		if (!_.isString(path)) throw new Error("Expecting string path.");
		var model = (this.findModel(path) || this).getModel(path);
		return new Scope(model).addModel(this);
	},

	// adds a model to the set
	addModel: function(model) {
		// accept scopes and arrays, but reduce them to models
		if (Scope.isScope(model)) this.addModel(model.models);
		else if (_.isArray(model)) {
			model.forEach(function(m) { this.addModel(m); }, this);
		}

		else {
			if (!Model.isModel(model)) throw new Error("Expecting model.");
			if (!~this.models.indexOf(model)) {
				this.models.push(model);

				// add observers
				this._observers.forEach(function(ob) {
					model.on("change", ob.onChange);
				});

				this.emit("model:add", model);
			}
		}

		return this;
	},
 
	// removes a previously added model
	removeModel: function(model) {
		if (Scope.isScope(model)) this.removeModel(model.models);
		else if (_.isArray(model)) {
			model.forEach(function(m) { this.removeModel(m); }, this);
		}

		else {
			var index = this.models.indexOf(model);
			if (~index) {
				this.models.splice(index, 1);

				// strip observers
				this._observers.forEach(function(ob) {
					model.removeListener("change", ob.onChange);
				});

				this.emit("model:remove", model);
			}
		}

		return this;
	},

	// returns the first model whose value at path isn't undefined
	findModel: function(path) {
		return _.find(this.models, function(model) {
			return !_.isUndefined(model.get(path));
		});
	},

	get: function(parts) {
		var val, model;

		parts = util.splitPath(parts);

		if (parts[0] === "this") {
			parts.shift();
			val = this.models[0].get(parts);
		}

		else {
			model = this.findModel(parts);
			if (model != null) val = model.get(parts);

			// check hidden values
			if (_.isUndefined(val) && parts.length) {
				val = util.get(this._hidden, parts);
			}
		}

		// execute functions
		if (_.isFunction(val)) val = val.call(this);

		// always depend
		if (Deps.active) this.depend(parts);

		return val;
	},

	// registers a dependency at path and observes changes
	depend: function(parts) {
		var path = util.joinPathParts(parts),
			dep = this._deps[path];

		// create if doesn't exist
		if (dep == null) {
			dep = this._deps[path] = new Deps.Dependency;
			dep._observer = this.observe(parts, function() { dep.changed(); });
		}

		dep.depend();
		return this;
	},

	// reruns fn anytime dependencies change
	autorun: function(fn) {
		return Deps.autorun(fn.bind(this));
	},

	// calls fn when path changes
	observe: function(path, fn) {
		if (!_.isFunction(fn)) throw new Error("Expecting a function to call on change.");

		var matchParts = _.isArray(path) ? path : util.parsePath(path),
			self = this;

		// remember the observer so we can kill it later
		this._observers.push({
			path: path,
			fn: fn,
			onChange: onChange
		});

		// apply to all existing models
		this.models.forEach(function(m) {
			m.on("change", onChange);
		});
		
		return this;

		function onChange(chg) {
			var keys, newval, oldval, model,
				ngetter, ogetter, parts, part, base, paths, i,
				cmodel, cindex, pmodel, omodel;

			// clone parts so we don't affect the original
			parts = matchParts.slice(0);
			keys = chg.keypath;
			newval = chg.value;
			oldval = chg.oldValue;
			model = chg.model;
			pmodel = model;

			// we need to get the true old and new values based on all the models
			if (chg.type !== "update") {
				cmodel = self.findModel(chg.keypath);

				if (cmodel != null) {
					cindex = self.models.indexOf(cmodel);
					
					if (cmodel === this) {
						omodel = _.find(self.models.slice(cindex + 1), function(model) {
							return !_.isUndefined(model.get(path));
						});

						if (omodel != null) {
							pmodel = omodel.getModel(keys);
							oldval = pmodel.value;
						}
					
					} else if (cindex > self.models.indexOf(this)) {
						pmodel = model;
						model = cmodel.getModel(keys);
						newval = model.value;

					} else return;
				}
			}

			// traverse through cparts
			// a mismatch means we don't need to be here
			for (i = 0; i < keys.length; i++) {
				part = parts.shift();
				if (_.isRegExp(part) && part.test(keys[i])) continue;
				if (part === "**") {
					// look ahead
					if (parts[0] == null || parts[0] !== keys[i + 1]) {
						parts.unshift(part);
					}
					continue;
				}
				if (part !== keys[i]) return;
			}

			paths = [];
			base = util.joinPathParts(keys);

			// generate a list of effected paths
			findAllMatchingPaths.call(this, model, newval, parts, paths);
			findAllMatchingPaths.call(this, pmodel, oldval, parts, paths);
			paths = util.findShallowestUniquePaths(paths);

			// getters for retrieving values at path
			ngetter = function(obj, path) {
				return Model.createHandle(model, obj)("get", path);
			}

			if (model === pmodel) ogetter = ngetter;
			else ogetter = function(obj, path) {
				return Model.createHandle(pmodel, obj)("get", path);
			}
			
			// fire the callback on each path that changed
			paths.forEach(function(keys, index, list) {
				var path, localModel, nval, oval;

				nval = util.get(newval, keys, ngetter),
				oval = util.get(oldval, keys, ogetter);
				if (nval === oval) return;

				fn.call(self, {
					model: model.getModel(keys),
					previousModel: pmodel.getModel(keys),
					path: util.joinPathParts(base, keys),
					type: util.changeType(nval, oval),
					value: nval,
					oldValue: oval
				});
			});
		}
	},

	stopObserving: function(path, fn) {
		var obs;

		if (_.isFunction(path) && fn == null) {
			fn = path;
			path = null;
		}

		if (path == null && fn == null) {
			obs = this._observers;
			this._observers = [];
		}

		else {
			obs = this._observers.filter(function(o) {
				return (path == null || path === o.path) && (fn == null || fn === o.fn);
			});
		}

		obs.forEach(function(o) {
			this.models.forEach(function(m) {
				m.removeListener("change", o.onChange);
			});

			var index = this._observers.indexOf(o);
			if (~index) this._observers.splice(index, 1);
		}, this);

		return this;
	},

	// set a hidden value
	setHidden: function(path, value) {
		if (_.isUndefined(value)) delete this._hidden[path];
		else this._hidden[path] = value;
		return this;
	},

	// cleans up the scope so it can be properly garbage collected
	destroy: function() {
		this.removeModel(this.models.slice(0));
		this.stopObserving();
		this.emit("destroy");
		return this;
	}

};

// chainable proxy methods
[ "handle", "set", "unset" ]
.forEach(function(method) {
	proto[method] = function() {
		var model = this.models[0];
		model[method].apply(model, arguments);
		return this;
	}
});

// proxy methods which don't return this
[ "getModel", "keys", "notify" ]
.forEach(function(method) {
	proto[method] = function() {
		var model = this.models[0];
		return model[method].apply(model, arguments);
	}
});

var Scope =
module.exports = util.subclass.call(EventEmitter, proto, {

	extend: util.subclass,

	isScope: function(obj) {
		return obj instanceof Scope;
	}

});

// deeply traverses a value in search of all paths that match parts
function findAllMatchingPaths(model, value, parts, paths, base) {
	if (paths == null) paths = [];
	if (base == null) base = [];

	if (!parts.length) {
		paths.push(base);
		return paths;
	}

	var handle = Model.createHandle(model, value),
		part = parts[0],
		rest = parts.slice(1);

	if (_.isRegExp(part)) {
		handle("keys").forEach(function(k) {
			findAllMatchingPaths.call(this, model.getModel(k), handle("get", k), rest, paths, base.concat(k));
		}, this);
	} else if (part === "**") {
		if (handle("isLeaf")) {
			if (!rest.length) paths.push(base);
			return paths;
		}

		handle("keys").forEach(function(k) {
			var _rest = rest,
				_base = base;

			// look ahead
			if (rest[0] == null || rest[0] !== k) {
				_rest = [part].concat(rest);
				_base = base.concat(k);
			}

			findAllMatchingPaths.call(this, model.getModel(k), handle("get", k), _rest, paths, _base);
		}, this);
	} else {
		findAllMatchingPaths.call(this, model.getModel(part), handle("get", part), rest, paths, base.concat(part));
	}

	return paths;
}
},{"./deps":8,"./model":10,"./util":20,"events":21,"underscore":25}],18:[function(_dereq_,module,exports){
var EventEmitter = _dereq_("events").EventEmitter,
	_ = _dereq_("underscore"),
	util = _dereq_("./util"),
	Scope = _dereq_("./scope"),
	Binding = _dereq_("./binding");

// base prototype
var proto = {
	use: function(fn) {
		var args = _.toArray(arguments).slice(1);
		fn.apply(this, args);
		return this;
	}
};

// render methods
_.each(_dereq_("./render"), function(method, key) {
	proto[key] = method;
});

// export
var Temple =
module.exports = Scope.extend(proto);

// class properties/methods
Temple.VERSION = "0.2.9-rc1";
Temple.util = util;

Temple.Deps = _dereq_("./deps");
Temple.Scope = Scope;
Temple.Model = _dereq_("./model");

Temple.Mustache = _dereq_("./mustache");
Temple.NODE_TYPE = _dereq_("./types");
Temple.Binding = Binding;
},{"./binding":6,"./deps":8,"./model":10,"./mustache":12,"./render":16,"./scope":17,"./types":19,"./util":20,"events":21,"underscore":25}],19:[function(_dereq_,module,exports){
module.exports = {
	ROOT              : 0,

	// XML/HTML
	TEXT              : 1,
	ELEMENT           : 2,
	ATTRIBUTE         : 3,
	
	// Mustache
	INTERPOLATOR      : 4,
	TRIPLE            : 5,
	SECTION           : 6,
	INVERTED          : 7,
	PARTIAL           : 8
}
},{}],20:[function(_dereq_,module,exports){
var _ = _dereq_("underscore");

// tests value as pojo (plain old javascript object)
var isPlainObject =
exports.isPlainObject = function(obj) {
	return obj != null && obj.__proto__ === Object.prototype;
}

// tests obj as a subclass of parent
// here, a class is technically a subclass of itself
exports.isSubClass = function(parent, obj) {
	return obj === parent || (obj != null && obj.prototype instanceof parent);
}

// the subclassing function found in Backbone
var subclass =
exports.subclass = function(protoProps, staticProps) {
	var parent = this;
	var child;

	// The constructor function for the new subclass is either defined by you
	// (the "constructor" property in your `extend` definition), or defaulted
	// by us to simply call the parent's constructor.
	if (protoProps && _.has(protoProps, 'constructor')) {
		child = protoProps.constructor;
	} else {
		child = function(){ return parent.apply(this, arguments); };
	}

	// Add static properties to the constructor function, if supplied.
	_.extend(child, parent, staticProps);

	// Set the prototype chain to inherit from `parent`, without calling
	// `parent`'s constructor function.
	var Surrogate = function(){ this.constructor = child; };
	Surrogate.prototype = parent.prototype;
	child.prototype = new Surrogate;

	// Add prototype properties (instance properties) to the subclass,
	// if supplied.
	if (protoProps) _.extend(child.prototype, protoProps);

	// Set a convenience property in case the parent's prototype is needed
	// later.
	child.__super__ = parent.prototype;

	return child;
}

// cleans an array of path parts
var sanitizePathParts =
exports.sanitizePathParts = function(parts) {
	return parts.filter(function(a) {
		return a != null && a !== "";
	}).map(function(a) {
		var s = a.toString();
		if (s[0] === ".") s = s.substr(1);
		if (s.substr(-1) === ".") s = s.substr(0, s.length - 1);
		return s;
	});
}

// splits a path by period
var splitPath =
exports.splitPath = function(path) {
	var parts = _.isArray(path) ? path : _.isString(path) ? path.split(".") : [ path ];
	if (parts.length > 1 && parts[0] === "") parts[0] = "this";
	return sanitizePathParts(parts);
}

// parses a string path as a dynamic path
var parsePath =
exports.parsePath = function(path) {
	return splitPath(path).map(function(part) {
		if (part.indexOf("*") > -1 && part !== "**") {
			return new RegExp("^" + part.split("*").join("([^\\.]*)") + "$");
		}

		return part;
	});
}

// concats path parts together into a string
var joinPathParts =
exports.joinPathParts = function() {
	return sanitizePathParts(_.flatten(_.toArray(arguments))).join(".");
}

// deeply looks for a value at path in obj
var get =
exports.get = function(obj, parts, getter) {
	parts = splitPath(parts);

	// custom getter
	if (!_.isFunction(getter)) {
		getter = function(obj, path) { return obj[path]; }
	}

	while (parts.length) {
		if (obj == null) return;
		obj = getter(obj, parts.shift());
	}

	return obj;
}

// reduces paths so they are unique and short
var findShallowestUniquePaths =
exports.findShallowestUniquePaths = function(paths) {
	return paths.reduce(function(m, keys) {
		// first check if a shorter or equal path exists
		if (m.some(function(k) {
			return arrayStartsWith(keys, k);
		})) return m;

		// next check for any longer paths that need to be removed
		m.slice(0).forEach(function(k, index) {
			if (arrayStartsWith(k, keys)) m.splice(index, 1);
		});

		// and lastly add the path to output
		m.push(keys);
		return m;
	}, []);
}

// determines if the values of array match the start of another array
// can be read as: does [a1] start with [a2]
var arrayStartsWith =
exports.arrayStartsWith = function(a1, a2) {
	var max = a2.length;
	return max <= a1.length && _.isEqual(a2, a1.slice(0, max));
}

// array write operations
var mutatorMethods = [ 'pop', 'push', 'reverse', 'shift', 'sort', 'splice', 'unshift' ];

// patches an array so we can listen to write operations
var patchArray =
exports.patchArray = function(arr) {
	if (arr._patched) return arr;
	
	var patchedArrayProto = [],
		observers = [];
	
	Object.defineProperty(patchedArrayProto, "_patched", { value: true });
	Object.defineProperty(patchedArrayProto, "_observers", { value: [] });

	Object.defineProperty(patchedArrayProto, "observe", {
		value: function(fn) {
			if (typeof fn !== "function") throw new Error("Expecting function to observe with.");
			this._observers.push(fn);
			return this;
		}
	});

	Object.defineProperty(patchedArrayProto, "stopObserving", {
		value: function(fn) {
			var index = this._observers.indexOf(fn);
			if (index > -1) this._observers.splice(index, 1);
			return this;
		}
	});

	mutatorMethods.forEach(function(methodName) {
		Object.defineProperty(patchedArrayProto, methodName, {
			value: method
		});

		function method() {
			var spliceEquivalent, summary, start,
				original, size, i, index, result;

			// push, pop, shift and unshift can all be represented as a splice operation.
			// this makes life easier later
			spliceEquivalent = getSpliceEquivalent(this, methodName, _.toArray(arguments));
			summary = summariseSpliceOperation(this, spliceEquivalent);

			// make a copy of the original values
			if (summary != null) {
				start = summary.start;
				original = Array.prototype.slice.call(this, start, !summary.balance ? start + summary.added : void 0);
				size = (summary.balance > 0 ? summary.added : 0) + original.length;
			} else {
				start = 0;
				original = Array.prototype.slice.call(this, 0);
				size = original.length;
			}

			// apply the underlying method
			result = Array.prototype[methodName].apply(this, arguments);

			// trigger changes
			for (i = 0; i < size; i++) {
				index = i + start;
				this._observers.forEach(function(fn) {
					fn.call(this, index, this[index], original[i]);
				}, this);
			}

			return result;
		};
	});

	if (({}).__proto__) arr.__proto__ = patchedArrayProto;
	else {
		mutatorMethods.forEach(function(methodName) {
			Object.defineProperty(arr, methodName, {
				value: patchedArrayProto[methodName],
				configurable: true
			});
		});
	}

	return arr;
}

// converts array write operations into splice equivalent arguments
var getSpliceEquivalent =
exports.getSpliceEquivalent = function ( array, methodName, args ) {
	switch ( methodName ) {
		case 'splice':
			return args;

		case 'sort':
		case 'reverse':
			return null;

		case 'pop':
			if ( array.length ) {
				return [ -1 ];
			}
			return null;

		case 'push':
			return [ array.length, 0 ].concat( args );

		case 'shift':
			return [ 0, 1 ];

		case 'unshift':
			return [ 0, 0 ].concat( args );
	}
}

// returns a summary pf how an array will be changed after the splice operation
var summariseSpliceOperation =
exports.summariseSpliceOperation = function ( array, args ) {
	var start, addedItems, removedItems, balance;

	if ( !args ) {
		return null;
	}

	// figure out where the changes started...
	start = +( args[0] < 0 ? array.length + args[0] : args[0] );

	// ...and how many items were added to or removed from the array
	addedItems = Math.max( 0, args.length - 2 );
	removedItems = ( args[1] !== undefined ? args[1] : array.length - start );

	// It's possible to do e.g. [ 1, 2, 3 ].splice( 2, 2 ) - i.e. the second argument
	// means removing more items from the end of the array than there are. In these
	// cases we need to curb JavaScript's enthusiasm or we'll get out of sync
	removedItems = Math.min( removedItems, array.length - start );

	balance = addedItems - removedItems;

	return {
		start: start,
		balance: balance,
		added: addedItems,
		removed: removedItems
	};
}

// tests a node against a selector
exports.matchSelector = function(node, selector) {
	var nodes, i;

	nodes = ( node.parentNode || node.ownerDocument ).querySelectorAll( selector );

	i = nodes.length;
	while ( i-- ) {
		if ( nodes[i] === node ) {
			return true;
		}
	}

	return false;
}

// returns the type of changes based on old and new values
// expects oval !== nval
exports.changeType = function(nval, oval) {
	return _.isUndefined(oval) ? "add" : _.isUndefined(nval) ? "delete" : "update";
}
},{"underscore":25}],21:[function(_dereq_,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

function EventEmitter() {
  this._events = this._events || {};
  this._maxListeners = this._maxListeners || undefined;
}
module.exports = EventEmitter;

// Backwards-compat with node 0.10.x
EventEmitter.EventEmitter = EventEmitter;

EventEmitter.prototype._events = undefined;
EventEmitter.prototype._maxListeners = undefined;

// By default EventEmitters will print a warning if more than 10 listeners are
// added to it. This is a useful default which helps finding memory leaks.
EventEmitter.defaultMaxListeners = 10;

// Obviously not all Emitters should be limited to 10. This function allows
// that to be increased. Set to zero for unlimited.
EventEmitter.prototype.setMaxListeners = function(n) {
  if (!isNumber(n) || n < 0 || isNaN(n))
    throw TypeError('n must be a positive number');
  this._maxListeners = n;
  return this;
};

EventEmitter.prototype.emit = function(type) {
  var er, handler, len, args, i, listeners;

  if (!this._events)
    this._events = {};

  // If there is no 'error' event listener then throw.
  if (type === 'error') {
    if (!this._events.error ||
        (isObject(this._events.error) && !this._events.error.length)) {
      er = arguments[1];
      if (er instanceof Error) {
        throw er; // Unhandled 'error' event
      } else {
        throw TypeError('Uncaught, unspecified "error" event.');
      }
      return false;
    }
  }

  handler = this._events[type];

  if (isUndefined(handler))
    return false;

  if (isFunction(handler)) {
    switch (arguments.length) {
      // fast cases
      case 1:
        handler.call(this);
        break;
      case 2:
        handler.call(this, arguments[1]);
        break;
      case 3:
        handler.call(this, arguments[1], arguments[2]);
        break;
      // slower
      default:
        len = arguments.length;
        args = new Array(len - 1);
        for (i = 1; i < len; i++)
          args[i - 1] = arguments[i];
        handler.apply(this, args);
    }
  } else if (isObject(handler)) {
    len = arguments.length;
    args = new Array(len - 1);
    for (i = 1; i < len; i++)
      args[i - 1] = arguments[i];

    listeners = handler.slice();
    len = listeners.length;
    for (i = 0; i < len; i++)
      listeners[i].apply(this, args);
  }

  return true;
};

EventEmitter.prototype.addListener = function(type, listener) {
  var m;

  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events)
    this._events = {};

  // To avoid recursion in the case that type === "newListener"! Before
  // adding it to the listeners, first emit "newListener".
  if (this._events.newListener)
    this.emit('newListener', type,
              isFunction(listener.listener) ?
              listener.listener : listener);

  if (!this._events[type])
    // Optimize the case of one listener. Don't need the extra array object.
    this._events[type] = listener;
  else if (isObject(this._events[type]))
    // If we've already got an array, just append.
    this._events[type].push(listener);
  else
    // Adding the second element, need to change to array.
    this._events[type] = [this._events[type], listener];

  // Check for listener leak
  if (isObject(this._events[type]) && !this._events[type].warned) {
    var m;
    if (!isUndefined(this._maxListeners)) {
      m = this._maxListeners;
    } else {
      m = EventEmitter.defaultMaxListeners;
    }

    if (m && m > 0 && this._events[type].length > m) {
      this._events[type].warned = true;
      console.error('(node) warning: possible EventEmitter memory ' +
                    'leak detected. %d listeners added. ' +
                    'Use emitter.setMaxListeners() to increase limit.',
                    this._events[type].length);
      if (typeof console.trace === 'function') {
        // not supported in IE 10
        console.trace();
      }
    }
  }

  return this;
};

EventEmitter.prototype.on = EventEmitter.prototype.addListener;

EventEmitter.prototype.once = function(type, listener) {
  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  var fired = false;

  function g() {
    this.removeListener(type, g);

    if (!fired) {
      fired = true;
      listener.apply(this, arguments);
    }
  }

  g.listener = listener;
  this.on(type, g);

  return this;
};

// emits a 'removeListener' event iff the listener was removed
EventEmitter.prototype.removeListener = function(type, listener) {
  var list, position, length, i;

  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events || !this._events[type])
    return this;

  list = this._events[type];
  length = list.length;
  position = -1;

  if (list === listener ||
      (isFunction(list.listener) && list.listener === listener)) {
    delete this._events[type];
    if (this._events.removeListener)
      this.emit('removeListener', type, listener);

  } else if (isObject(list)) {
    for (i = length; i-- > 0;) {
      if (list[i] === listener ||
          (list[i].listener && list[i].listener === listener)) {
        position = i;
        break;
      }
    }

    if (position < 0)
      return this;

    if (list.length === 1) {
      list.length = 0;
      delete this._events[type];
    } else {
      list.splice(position, 1);
    }

    if (this._events.removeListener)
      this.emit('removeListener', type, listener);
  }

  return this;
};

EventEmitter.prototype.removeAllListeners = function(type) {
  var key, listeners;

  if (!this._events)
    return this;

  // not listening for removeListener, no need to emit
  if (!this._events.removeListener) {
    if (arguments.length === 0)
      this._events = {};
    else if (this._events[type])
      delete this._events[type];
    return this;
  }

  // emit removeListener for all listeners on all events
  if (arguments.length === 0) {
    for (key in this._events) {
      if (key === 'removeListener') continue;
      this.removeAllListeners(key);
    }
    this.removeAllListeners('removeListener');
    this._events = {};
    return this;
  }

  listeners = this._events[type];

  if (isFunction(listeners)) {
    this.removeListener(type, listeners);
  } else {
    // LIFO order
    while (listeners.length)
      this.removeListener(type, listeners[listeners.length - 1]);
  }
  delete this._events[type];

  return this;
};

EventEmitter.prototype.listeners = function(type) {
  var ret;
  if (!this._events || !this._events[type])
    ret = [];
  else if (isFunction(this._events[type]))
    ret = [this._events[type]];
  else
    ret = this._events[type].slice();
  return ret;
};

EventEmitter.listenerCount = function(emitter, type) {
  var ret;
  if (!emitter._events || !emitter._events[type])
    ret = 0;
  else if (isFunction(emitter._events[type]))
    ret = 1;
  else
    ret = emitter._events[type].length;
  return ret;
};

function isFunction(arg) {
  return typeof arg === 'function';
}

function isNumber(arg) {
  return typeof arg === 'number';
}

function isObject(arg) {
  return typeof arg === 'object' && arg !== null;
}

function isUndefined(arg) {
  return arg === void 0;
}

},{}],22:[function(_dereq_,module,exports){
/*
 *  Copyright 2011 Twitter, Inc.
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *
 *  http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

(function (Hogan) {
  // Setup regex  assignments
  // remove whitespace according to Mustache spec
  var rIsWhitespace = /\S/,
      rQuot = /\"/g,
      rNewline =  /\n/g,
      rCr = /\r/g,
      rSlash = /\\/g;

  Hogan.tags = {
    '#': 1, '^': 2, '<': 3, '$': 4,
    '/': 5, '!': 6, '>': 7, '=': 8, '_v': 9,
    '{': 10, '&': 11, '_t': 12
  };

  Hogan.scan = function scan(text, delimiters) {
    var len = text.length,
        IN_TEXT = 0,
        IN_TAG_TYPE = 1,
        IN_TAG = 2,
        state = IN_TEXT,
        tagType = null,
        tag = null,
        buf = '',
        tokens = [],
        seenTag = false,
        i = 0,
        lineStart = 0,
        otag = '{{',
        ctag = '}}';

    function addBuf() {
      if (buf.length > 0) {
        tokens.push({tag: '_t', text: new String(buf)});
        buf = '';
      }
    }

    function lineIsWhitespace() {
      var isAllWhitespace = true;
      for (var j = lineStart; j < tokens.length; j++) {
        isAllWhitespace =
          (Hogan.tags[tokens[j].tag] < Hogan.tags['_v']) ||
          (tokens[j].tag == '_t' && tokens[j].text.match(rIsWhitespace) === null);
        if (!isAllWhitespace) {
          return false;
        }
      }

      return isAllWhitespace;
    }

    function filterLine(haveSeenTag, noNewLine) {
      addBuf();

      if (haveSeenTag && lineIsWhitespace()) {
        for (var j = lineStart, next; j < tokens.length; j++) {
          if (tokens[j].text) {
            if ((next = tokens[j+1]) && next.tag == '>') {
              // set indent to token value
              next.indent = tokens[j].text.toString()
            }
            tokens.splice(j, 1);
          }
        }
      } else if (!noNewLine) {
        tokens.push({tag:'\n'});
      }

      seenTag = false;
      lineStart = tokens.length;
    }

    function changeDelimiters(text, index) {
      var close = '=' + ctag,
          closeIndex = text.indexOf(close, index),
          delimiters = trim(
            text.substring(text.indexOf('=', index) + 1, closeIndex)
          ).split(' ');

      otag = delimiters[0];
      ctag = delimiters[delimiters.length - 1];

      return closeIndex + close.length - 1;
    }

    if (delimiters) {
      delimiters = delimiters.split(' ');
      otag = delimiters[0];
      ctag = delimiters[1];
    }

    for (i = 0; i < len; i++) {
      if (state == IN_TEXT) {
        if (tagChange(otag, text, i)) {
          --i;
          addBuf();
          state = IN_TAG_TYPE;
        } else {
          if (text.charAt(i) == '\n') {
            filterLine(seenTag);
          } else {
            buf += text.charAt(i);
          }
        }
      } else if (state == IN_TAG_TYPE) {
        i += otag.length - 1;
        tag = Hogan.tags[text.charAt(i + 1)];
        tagType = tag ? text.charAt(i + 1) : '_v';
        if (tagType == '=') {
          i = changeDelimiters(text, i);
          state = IN_TEXT;
        } else {
          if (tag) {
            i++;
          }
          state = IN_TAG;
        }
        seenTag = i;
      } else {
        if (tagChange(ctag, text, i)) {
          tokens.push({tag: tagType, n: trim(buf), otag: otag, ctag: ctag,
                       i: (tagType == '/') ? seenTag - otag.length : i + ctag.length});
          buf = '';
          i += ctag.length - 1;
          state = IN_TEXT;
          if (tagType == '{') {
            if (ctag == '}}') {
              i++;
            } else {
              cleanTripleStache(tokens[tokens.length - 1]);
            }
          }
        } else {
          buf += text.charAt(i);
        }
      }
    }

    filterLine(seenTag, true);

    return tokens;
  }

  function cleanTripleStache(token) {
    if (token.n.substr(token.n.length - 1) === '}') {
      token.n = token.n.substring(0, token.n.length - 1);
    }
  }

  function trim(s) {
    if (s.trim) {
      return s.trim();
    }

    return s.replace(/^\s*|\s*$/g, '');
  }

  function tagChange(tag, text, index) {
    if (text.charAt(index) != tag.charAt(0)) {
      return false;
    }

    for (var i = 1, l = tag.length; i < l; i++) {
      if (text.charAt(index + i) != tag.charAt(i)) {
        return false;
      }
    }

    return true;
  }

  // the tags allowed inside super templates
  var allowedInSuper = {'_t': true, '\n': true, '$': true, '/': true};

  function buildTree(tokens, kind, stack, customTags) {
    var instructions = [],
        opener = null,
        tail = null,
        token = null;

    tail = stack[stack.length - 1];

    while (tokens.length > 0) {
      token = tokens.shift();

      if (tail && tail.tag == '<' && !(token.tag in allowedInSuper)) {
        throw new Error('Illegal content in < super tag.');
      }

      if (Hogan.tags[token.tag] <= Hogan.tags['$'] || isOpener(token, customTags)) {
        stack.push(token);
        token.nodes = buildTree(tokens, token.tag, stack, customTags);
      } else if (token.tag == '/') {
        if (stack.length === 0) {
          throw new Error('Closing tag without opener: /' + token.n);
        }
        opener = stack.pop();
        if (token.n != opener.n && !isCloser(token.n, opener.n, customTags)) {
          throw new Error('Nesting error: ' + opener.n + ' vs. ' + token.n);
        }
        opener.end = token.i;
        return instructions;
      } else if (token.tag == '\n') {
        token.last = (tokens.length == 0) || (tokens[0].tag == '\n');
      }

      instructions.push(token);
    }

    if (stack.length > 0) {
      throw new Error('missing closing tag: ' + stack.pop().n);
    }

    return instructions;
  }

  function isOpener(token, tags) {
    for (var i = 0, l = tags.length; i < l; i++) {
      if (tags[i].o == token.n) {
        token.tag = '#';
        return true;
      }
    }
  }

  function isCloser(close, open, tags) {
    for (var i = 0, l = tags.length; i < l; i++) {
      if (tags[i].c == close && tags[i].o == open) {
        return true;
      }
    }
  }

  function stringifySubstitutions(obj) {
    var items = [];
    for (var key in obj) {
      items.push('"' + esc(key) + '": function(c,p,t,i) {' + obj[key] + '}');
    }
    return "{ " + items.join(",") + " }";
  }

  function stringifyPartials(codeObj) {
    var partials = [];
    for (var key in codeObj.partials) {
      partials.push('"' + esc(key) + '":{name:"' + esc(codeObj.partials[key].name) + '", ' + stringifyPartials(codeObj.partials[key]) + "}");
    }
    return "partials: {" + partials.join(",") + "}, subs: " + stringifySubstitutions(codeObj.subs);
  }

  Hogan.stringify = function(codeObj, text, options) {
    return "{code: function (c,p,i) { " + Hogan.wrapMain(codeObj.code) + " }," + stringifyPartials(codeObj) +  "}";
  }

  var serialNo = 0;
  Hogan.generate = function(tree, text, options) {
    serialNo = 0;
    var context = { code: '', subs: {}, partials: {} };
    Hogan.walk(tree, context);

    if (options.asString) {
      return this.stringify(context, text, options);
    }

    return this.makeTemplate(context, text, options);
  }

  Hogan.wrapMain = function(code) {
    return 'var t=this;t.b(i=i||"");' + code + 'return t.fl();';
  }

  Hogan.template = Hogan.Template;

  Hogan.makeTemplate = function(codeObj, text, options) {
    var template = this.makePartials(codeObj);
    template.code = new Function('c', 'p', 'i', this.wrapMain(codeObj.code));
    return new this.template(template, text, this, options);
  }

  Hogan.makePartials = function(codeObj) {
    var key, template = {subs: {}, partials: codeObj.partials, name: codeObj.name};
    for (key in template.partials) {
      template.partials[key] = this.makePartials(template.partials[key]);
    }
    for (key in codeObj.subs) {
      template.subs[key] = new Function('c', 'p', 't', 'i', codeObj.subs[key]);
    }
    return template;
  }

  function esc(s) {
    return s.replace(rSlash, '\\\\')
            .replace(rQuot, '\\\"')
            .replace(rNewline, '\\n')
            .replace(rCr, '\\r');
  }

  function chooseMethod(s) {
    return (~s.indexOf('.')) ? 'd' : 'f';
  }

  function createPartial(node, context) {
    var prefix = "<" + (context.prefix || "");
    var sym = prefix + node.n + serialNo++;
    context.partials[sym] = {name: node.n, partials: {}};
    context.code += 't.b(t.rp("' +  esc(sym) + '",c,p,"' + (node.indent || '') + '"));';
    return sym;
  }

  Hogan.codegen = {
    '#': function(node, context) {
      context.code += 'if(t.s(t.' + chooseMethod(node.n) + '("' + esc(node.n) + '",c,p,1),' +
                      'c,p,0,' + node.i + ',' + node.end + ',"' + node.otag + " " + node.ctag + '")){' +
                      't.rs(c,p,' + 'function(c,p,t){';
      Hogan.walk(node.nodes, context);
      context.code += '});c.pop();}';
    },

    '^': function(node, context) {
      context.code += 'if(!t.s(t.' + chooseMethod(node.n) + '("' + esc(node.n) + '",c,p,1),c,p,1,0,0,"")){';
      Hogan.walk(node.nodes, context);
      context.code += '};';
    },

    '>': createPartial,
    '<': function(node, context) {
      var ctx = {partials: {}, code: '', subs: {}, inPartial: true};
      Hogan.walk(node.nodes, ctx);
      var template = context.partials[createPartial(node, context)];
      template.subs = ctx.subs;
      template.partials = ctx.partials;
    },

    '$': function(node, context) {
      var ctx = {subs: {}, code: '', partials: context.partials, prefix: node.n};
      Hogan.walk(node.nodes, ctx);
      context.subs[node.n] = ctx.code;
      if (!context.inPartial) {
        context.code += 't.sub("' + esc(node.n) + '",c,p,i);';
      }
    },

    '\n': function(node, context) {
      context.code += write('"\\n"' + (node.last ? '' : ' + i'));
    },

    '_v': function(node, context) {
      context.code += 't.b(t.v(t.' + chooseMethod(node.n) + '("' + esc(node.n) + '",c,p,0)));';
    },

    '_t': function(node, context) {
      context.code += write('"' + esc(node.text) + '"');
    },

    '{': tripleStache,

    '&': tripleStache
  }

  function tripleStache(node, context) {
    context.code += 't.b(t.t(t.' + chooseMethod(node.n) + '("' + esc(node.n) + '",c,p,0)));';
  }

  function write(s) {
    return 't.b(' + s + ');';
  }

  Hogan.walk = function(nodelist, context) {
    var func;
    for (var i = 0, l = nodelist.length; i < l; i++) {
      func = Hogan.codegen[nodelist[i].tag];
      func && func(nodelist[i], context);
    }
    return context;
  }

  Hogan.parse = function(tokens, text, options) {
    options = options || {};
    return buildTree(tokens, '', [], options.sectionTags || []);
  }

  Hogan.cache = {};

  Hogan.cacheKey = function(text, options) {
    return [text, !!options.asString, !!options.disableLambda, options.delimiters, !!options.modelGet].join('||');
  }

  Hogan.compile = function(text, options) {
    options = options || {};
    var key = Hogan.cacheKey(text, options);
    var template = this.cache[key];

    if (template) {
      var partials = template.partials;
      for (var name in partials) {
        delete partials[name].instance;
      }
      return template;
    }

    template = this.generate(this.parse(this.scan(text, options.delimiters), text, options), text, options);
    return this.cache[key] = template;
  }
})(typeof exports !== 'undefined' ? exports : Hogan);

},{}],23:[function(_dereq_,module,exports){
/*
 *  Copyright 2011 Twitter, Inc.
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *
 *  http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

// This file is for use with Node.js. See dist/ for browser files.

var Hogan = _dereq_('./compiler');
Hogan.Template = _dereq_('./template').Template;
Hogan.template = Hogan.Template;
module.exports = Hogan;

},{"./compiler":22,"./template":24}],24:[function(_dereq_,module,exports){
/*
 *  Copyright 2011 Twitter, Inc.
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *
 *  http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

var Hogan = {};

(function (Hogan) {
  Hogan.Template = function (codeObj, text, compiler, options) {
    codeObj = codeObj || {};
    this.r = codeObj.code || this.r;
    this.c = compiler;
    this.options = options || {};
    this.text = text || '';
    this.partials = codeObj.partials || {};
    this.subs = codeObj.subs || {};
    this.buf = '';
  }

  Hogan.Template.prototype = {
    // render: replaced by generated code.
    r: function (context, partials, indent) { return ''; },

    // variable escaping
    v: hoganEscape,

    // triple stache
    t: coerceToString,

    render: function render(context, partials, indent) {
      return this.ri([context], partials || {}, indent);
    },

    // render internal -- a hook for overrides that catches partials too
    ri: function (context, partials, indent) {
      return this.r(context, partials, indent);
    },

    // ensurePartial
    ep: function(symbol, partials) {
      var partial = this.partials[symbol];

      // check to see that if we've instantiated this partial before
      var template = partials[partial.name];
      if (partial.instance && partial.base == template) {
        return partial.instance;
      }

      if (typeof template == 'string') {
        if (!this.c) {
          throw new Error("No compiler available.");
        }
        template = this.c.compile(template, this.options);
      }

      if (!template) {
        return null;
      }

      // We use this to check whether the partials dictionary has changed
      this.partials[symbol].base = template;

      if (partial.subs) {
        // Make sure we consider parent template now
        if (!partials.stackText) partials.stackText = {};
        for (key in partial.subs) {
          if (!partials.stackText[key]) {
            partials.stackText[key] = (this.activeSub !== undefined && partials.stackText[this.activeSub]) ? partials.stackText[this.activeSub] : this.text;
          }
        }
        template = createSpecializedPartial(template, partial.subs, partial.partials,
          this.stackSubs, this.stackPartials, partials.stackText);
      }
      this.partials[symbol].instance = template;

      return template;
    },

    // tries to find a partial in the current scope and render it
    rp: function(symbol, context, partials, indent) {
      var partial = this.ep(symbol, partials);
      if (!partial) {
        return '';
      }

      return partial.ri(context, partials, indent);
    },

    // render a section
    rs: function(context, partials, section) {
      var tail = context[context.length - 1];

      if (!isArray(tail)) {
        section(context, partials, this);
        return;
      }

      for (var i = 0; i < tail.length; i++) {
        context.push(tail[i]);
        section(context, partials, this);
        context.pop();
      }
    },

    // maybe start a section
    s: function(val, ctx, partials, inverted, start, end, tags) {
      var pass;

      if (isArray(val) && val.length === 0) {
        return false;
      }

      if (typeof val == 'function') {
        val = this.ms(val, ctx, partials, inverted, start, end, tags);
      }

      pass = !!val;

      if (!inverted && pass && ctx) {
        ctx.push((typeof val == 'object') ? val : ctx[ctx.length - 1]);
      }

      return pass;
    },

    // find values with dotted names
    d: function(key, ctx, partials, returnFound) {
      var found,
          names = key.split('.'),
          val = this.f(names[0], ctx, partials, returnFound),
          doModelGet = this.options.modelGet,
          cx = null;

      if (key === '.' && isArray(ctx[ctx.length - 2])) {
        val = ctx[ctx.length - 1];
      } else {
        for (var i = 1; i < names.length; i++) {
          found = findInScope(names[i], val, doModelGet);
          if (found != null) {
            cx = val;
            val = found;
          } else {
            val = '';
          }
        }
      }

      if (returnFound && !val) {
        return false;
      }

      if (!returnFound && typeof val == 'function') {
        ctx.push(cx);
        val = this.mv(val, ctx, partials);
        ctx.pop();
      }

      return val;
    },

    // find values with normal names
    f: function(key, ctx, partials, returnFound) {
      var val = false,
          v = null,
          found = false,
          doModelGet = this.options.modelGet;

      for (var i = ctx.length - 1; i >= 0; i--) {
        v = ctx[i];
        val = findInScope(key, v, doModelGet);
        if (val != null) {
          found = true;
          break;
        }
      }

      if (!found) {
        return (returnFound) ? false : "";
      }

      if (!returnFound && typeof val == 'function') {
        val = this.mv(val, ctx, partials);
      }

      return val;
    },

    // higher order templates
    ls: function(func, cx, partials, text, tags) {
      var oldTags = this.options.delimiters;

      this.options.delimiters = tags;
      this.b(this.ct(coerceToString(func.call(cx, text)), cx, partials));
      this.options.delimiters = oldTags;

      return false;
    },

    // compile text
    ct: function(text, cx, partials) {
      if (this.options.disableLambda) {
        throw new Error('Lambda features disabled.');
      }
      return this.c.compile(text, this.options).render(cx, partials);
    },

    // template result buffering
    b: function(s) { this.buf += s; },

    fl: function() { var r = this.buf; this.buf = ''; return r; },

    // method replace section
    ms: function(func, ctx, partials, inverted, start, end, tags) {
      var textSource,
          cx = ctx[ctx.length - 1],
          result = func.call(cx);

      if (typeof result == 'function') {
        if (inverted) {
          return true;
        } else {
          textSource = (this.activeSub && this.subsText && this.subsText[this.activeSub]) ? this.subsText[this.activeSub] : this.text;
          return this.ls(result, cx, partials, textSource.substring(start, end), tags);
        }
      }

      return result;
    },

    // method replace variable
    mv: function(func, ctx, partials) {
      var cx = ctx[ctx.length - 1];
      var result = func.call(cx);

      if (typeof result == 'function') {
        return this.ct(coerceToString(result.call(cx)), cx, partials);
      }

      return result;
    },

    sub: function(name, context, partials, indent) {
      var f = this.subs[name];
      if (f) {
        this.activeSub = name;
        f(context, partials, this, indent);
        this.activeSub = false;
      }
    }

  };

  //Find a key in an object
  function findInScope(key, scope, doModelGet) {
    var val, checkVal;

    if (scope && typeof scope == 'object') {

      if (scope[key] != null) {
        val = scope[key];

      // try lookup with get for backbone or similar model data
      } else if (doModelGet && scope.get && typeof scope.get == 'function') {
        val = scope.get(key);
      }
    }

    return val;
  }

  function createSpecializedPartial(instance, subs, partials, stackSubs, stackPartials, stackText) {
    function PartialTemplate() {};
    PartialTemplate.prototype = instance;
    function Substitutions() {};
    Substitutions.prototype = instance.subs;
    var key;
    var partial = new PartialTemplate();
    partial.subs = new Substitutions();
    partial.subsText = {};  //hehe. substext.
    partial.buf = '';

    stackSubs = stackSubs || {};
    partial.stackSubs = stackSubs;
    partial.subsText = stackText;
    for (key in subs) {
      if (!stackSubs[key]) stackSubs[key] = subs[key];
    }
    for (key in stackSubs) {
      partial.subs[key] = stackSubs[key];
    }

    stackPartials = stackPartials || {};
    partial.stackPartials = stackPartials;
    for (key in partials) {
      if (!stackPartials[key]) stackPartials[key] = partials[key];
    }
    for (key in stackPartials) {
      partial.partials[key] = stackPartials[key];
    }

    return partial;
  }

  var rAmp = /&/g,
      rLt = /</g,
      rGt = />/g,
      rApos = /\'/g,
      rQuot = /\"/g,
      hChars = /[&<>\"\']/;

  function coerceToString(val) {
    return String((val === null || val === undefined) ? '' : val);
  }

  function hoganEscape(str) {
    str = coerceToString(str);
    return hChars.test(str) ?
      str
        .replace(rAmp, '&amp;')
        .replace(rLt, '&lt;')
        .replace(rGt, '&gt;')
        .replace(rApos, '&#39;')
        .replace(rQuot, '&quot;') :
      str;
  }

  var isArray = Array.isArray || function(a) {
    return Object.prototype.toString.call(a) === '[object Array]';
  };

})(typeof exports !== 'undefined' ? exports : Hogan);

},{}],25:[function(_dereq_,module,exports){
//     Underscore.js 1.6.0
//     http://underscorejs.org
//     (c) 2009-2014 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
//     Underscore may be freely distributed under the MIT license.

(function() {

  // Baseline setup
  // --------------

  // Establish the root object, `window` in the browser, or `exports` on the server.
  var root = this;

  // Save the previous value of the `_` variable.
  var previousUnderscore = root._;

  // Establish the object that gets returned to break out of a loop iteration.
  var breaker = {};

  // Save bytes in the minified (but not gzipped) version:
  var ArrayProto = Array.prototype, ObjProto = Object.prototype, FuncProto = Function.prototype;

  // Create quick reference variables for speed access to core prototypes.
  var
    push             = ArrayProto.push,
    slice            = ArrayProto.slice,
    concat           = ArrayProto.concat,
    toString         = ObjProto.toString,
    hasOwnProperty   = ObjProto.hasOwnProperty;

  // All **ECMAScript 5** native function implementations that we hope to use
  // are declared here.
  var
    nativeForEach      = ArrayProto.forEach,
    nativeMap          = ArrayProto.map,
    nativeReduce       = ArrayProto.reduce,
    nativeReduceRight  = ArrayProto.reduceRight,
    nativeFilter       = ArrayProto.filter,
    nativeEvery        = ArrayProto.every,
    nativeSome         = ArrayProto.some,
    nativeIndexOf      = ArrayProto.indexOf,
    nativeLastIndexOf  = ArrayProto.lastIndexOf,
    nativeIsArray      = Array.isArray,
    nativeKeys         = Object.keys,
    nativeBind         = FuncProto.bind;

  // Create a safe reference to the Underscore object for use below.
  var _ = function(obj) {
    if (obj instanceof _) return obj;
    if (!(this instanceof _)) return new _(obj);
    this._wrapped = obj;
  };

  // Export the Underscore object for **Node.js**, with
  // backwards-compatibility for the old `require()` API. If we're in
  // the browser, add `_` as a global object via a string identifier,
  // for Closure Compiler "advanced" mode.
  if (typeof exports !== 'undefined') {
    if (typeof module !== 'undefined' && module.exports) {
      exports = module.exports = _;
    }
    exports._ = _;
  } else {
    root._ = _;
  }

  // Current version.
  _.VERSION = '1.6.0';

  // Collection Functions
  // --------------------

  // The cornerstone, an `each` implementation, aka `forEach`.
  // Handles objects with the built-in `forEach`, arrays, and raw objects.
  // Delegates to **ECMAScript 5**'s native `forEach` if available.
  var each = _.each = _.forEach = function(obj, iterator, context) {
    if (obj == null) return obj;
    if (nativeForEach && obj.forEach === nativeForEach) {
      obj.forEach(iterator, context);
    } else if (obj.length === +obj.length) {
      for (var i = 0, length = obj.length; i < length; i++) {
        if (iterator.call(context, obj[i], i, obj) === breaker) return;
      }
    } else {
      var keys = _.keys(obj);
      for (var i = 0, length = keys.length; i < length; i++) {
        if (iterator.call(context, obj[keys[i]], keys[i], obj) === breaker) return;
      }
    }
    return obj;
  };

  // Return the results of applying the iterator to each element.
  // Delegates to **ECMAScript 5**'s native `map` if available.
  _.map = _.collect = function(obj, iterator, context) {
    var results = [];
    if (obj == null) return results;
    if (nativeMap && obj.map === nativeMap) return obj.map(iterator, context);
    each(obj, function(value, index, list) {
      results.push(iterator.call(context, value, index, list));
    });
    return results;
  };

  var reduceError = 'Reduce of empty array with no initial value';

  // **Reduce** builds up a single result from a list of values, aka `inject`,
  // or `foldl`. Delegates to **ECMAScript 5**'s native `reduce` if available.
  _.reduce = _.foldl = _.inject = function(obj, iterator, memo, context) {
    var initial = arguments.length > 2;
    if (obj == null) obj = [];
    if (nativeReduce && obj.reduce === nativeReduce) {
      if (context) iterator = _.bind(iterator, context);
      return initial ? obj.reduce(iterator, memo) : obj.reduce(iterator);
    }
    each(obj, function(value, index, list) {
      if (!initial) {
        memo = value;
        initial = true;
      } else {
        memo = iterator.call(context, memo, value, index, list);
      }
    });
    if (!initial) throw new TypeError(reduceError);
    return memo;
  };

  // The right-associative version of reduce, also known as `foldr`.
  // Delegates to **ECMAScript 5**'s native `reduceRight` if available.
  _.reduceRight = _.foldr = function(obj, iterator, memo, context) {
    var initial = arguments.length > 2;
    if (obj == null) obj = [];
    if (nativeReduceRight && obj.reduceRight === nativeReduceRight) {
      if (context) iterator = _.bind(iterator, context);
      return initial ? obj.reduceRight(iterator, memo) : obj.reduceRight(iterator);
    }
    var length = obj.length;
    if (length !== +length) {
      var keys = _.keys(obj);
      length = keys.length;
    }
    each(obj, function(value, index, list) {
      index = keys ? keys[--length] : --length;
      if (!initial) {
        memo = obj[index];
        initial = true;
      } else {
        memo = iterator.call(context, memo, obj[index], index, list);
      }
    });
    if (!initial) throw new TypeError(reduceError);
    return memo;
  };

  // Return the first value which passes a truth test. Aliased as `detect`.
  _.find = _.detect = function(obj, predicate, context) {
    var result;
    any(obj, function(value, index, list) {
      if (predicate.call(context, value, index, list)) {
        result = value;
        return true;
      }
    });
    return result;
  };

  // Return all the elements that pass a truth test.
  // Delegates to **ECMAScript 5**'s native `filter` if available.
  // Aliased as `select`.
  _.filter = _.select = function(obj, predicate, context) {
    var results = [];
    if (obj == null) return results;
    if (nativeFilter && obj.filter === nativeFilter) return obj.filter(predicate, context);
    each(obj, function(value, index, list) {
      if (predicate.call(context, value, index, list)) results.push(value);
    });
    return results;
  };

  // Return all the elements for which a truth test fails.
  _.reject = function(obj, predicate, context) {
    return _.filter(obj, function(value, index, list) {
      return !predicate.call(context, value, index, list);
    }, context);
  };

  // Determine whether all of the elements match a truth test.
  // Delegates to **ECMAScript 5**'s native `every` if available.
  // Aliased as `all`.
  _.every = _.all = function(obj, predicate, context) {
    predicate || (predicate = _.identity);
    var result = true;
    if (obj == null) return result;
    if (nativeEvery && obj.every === nativeEvery) return obj.every(predicate, context);
    each(obj, function(value, index, list) {
      if (!(result = result && predicate.call(context, value, index, list))) return breaker;
    });
    return !!result;
  };

  // Determine if at least one element in the object matches a truth test.
  // Delegates to **ECMAScript 5**'s native `some` if available.
  // Aliased as `any`.
  var any = _.some = _.any = function(obj, predicate, context) {
    predicate || (predicate = _.identity);
    var result = false;
    if (obj == null) return result;
    if (nativeSome && obj.some === nativeSome) return obj.some(predicate, context);
    each(obj, function(value, index, list) {
      if (result || (result = predicate.call(context, value, index, list))) return breaker;
    });
    return !!result;
  };

  // Determine if the array or object contains a given value (using `===`).
  // Aliased as `include`.
  _.contains = _.include = function(obj, target) {
    if (obj == null) return false;
    if (nativeIndexOf && obj.indexOf === nativeIndexOf) return obj.indexOf(target) != -1;
    return any(obj, function(value) {
      return value === target;
    });
  };

  // Invoke a method (with arguments) on every item in a collection.
  _.invoke = function(obj, method) {
    var args = slice.call(arguments, 2);
    var isFunc = _.isFunction(method);
    return _.map(obj, function(value) {
      return (isFunc ? method : value[method]).apply(value, args);
    });
  };

  // Convenience version of a common use case of `map`: fetching a property.
  _.pluck = function(obj, key) {
    return _.map(obj, _.property(key));
  };

  // Convenience version of a common use case of `filter`: selecting only objects
  // containing specific `key:value` pairs.
  _.where = function(obj, attrs) {
    return _.filter(obj, _.matches(attrs));
  };

  // Convenience version of a common use case of `find`: getting the first object
  // containing specific `key:value` pairs.
  _.findWhere = function(obj, attrs) {
    return _.find(obj, _.matches(attrs));
  };

  // Return the maximum element or (element-based computation).
  // Can't optimize arrays of integers longer than 65,535 elements.
  // See [WebKit Bug 80797](https://bugs.webkit.org/show_bug.cgi?id=80797)
  _.max = function(obj, iterator, context) {
    if (!iterator && _.isArray(obj) && obj[0] === +obj[0] && obj.length < 65535) {
      return Math.max.apply(Math, obj);
    }
    var result = -Infinity, lastComputed = -Infinity;
    each(obj, function(value, index, list) {
      var computed = iterator ? iterator.call(context, value, index, list) : value;
      if (computed > lastComputed) {
        result = value;
        lastComputed = computed;
      }
    });
    return result;
  };

  // Return the minimum element (or element-based computation).
  _.min = function(obj, iterator, context) {
    if (!iterator && _.isArray(obj) && obj[0] === +obj[0] && obj.length < 65535) {
      return Math.min.apply(Math, obj);
    }
    var result = Infinity, lastComputed = Infinity;
    each(obj, function(value, index, list) {
      var computed = iterator ? iterator.call(context, value, index, list) : value;
      if (computed < lastComputed) {
        result = value;
        lastComputed = computed;
      }
    });
    return result;
  };

  // Shuffle an array, using the modern version of the
  // [Fisher-Yates shuffle](http://en.wikipedia.org/wiki/Fisher–Yates_shuffle).
  _.shuffle = function(obj) {
    var rand;
    var index = 0;
    var shuffled = [];
    each(obj, function(value) {
      rand = _.random(index++);
      shuffled[index - 1] = shuffled[rand];
      shuffled[rand] = value;
    });
    return shuffled;
  };

  // Sample **n** random values from a collection.
  // If **n** is not specified, returns a single random element.
  // The internal `guard` argument allows it to work with `map`.
  _.sample = function(obj, n, guard) {
    if (n == null || guard) {
      if (obj.length !== +obj.length) obj = _.values(obj);
      return obj[_.random(obj.length - 1)];
    }
    return _.shuffle(obj).slice(0, Math.max(0, n));
  };

  // An internal function to generate lookup iterators.
  var lookupIterator = function(value) {
    if (value == null) return _.identity;
    if (_.isFunction(value)) return value;
    return _.property(value);
  };

  // Sort the object's values by a criterion produced by an iterator.
  _.sortBy = function(obj, iterator, context) {
    iterator = lookupIterator(iterator);
    return _.pluck(_.map(obj, function(value, index, list) {
      return {
        value: value,
        index: index,
        criteria: iterator.call(context, value, index, list)
      };
    }).sort(function(left, right) {
      var a = left.criteria;
      var b = right.criteria;
      if (a !== b) {
        if (a > b || a === void 0) return 1;
        if (a < b || b === void 0) return -1;
      }
      return left.index - right.index;
    }), 'value');
  };

  // An internal function used for aggregate "group by" operations.
  var group = function(behavior) {
    return function(obj, iterator, context) {
      var result = {};
      iterator = lookupIterator(iterator);
      each(obj, function(value, index) {
        var key = iterator.call(context, value, index, obj);
        behavior(result, key, value);
      });
      return result;
    };
  };

  // Groups the object's values by a criterion. Pass either a string attribute
  // to group by, or a function that returns the criterion.
  _.groupBy = group(function(result, key, value) {
    _.has(result, key) ? result[key].push(value) : result[key] = [value];
  });

  // Indexes the object's values by a criterion, similar to `groupBy`, but for
  // when you know that your index values will be unique.
  _.indexBy = group(function(result, key, value) {
    result[key] = value;
  });

  // Counts instances of an object that group by a certain criterion. Pass
  // either a string attribute to count by, or a function that returns the
  // criterion.
  _.countBy = group(function(result, key) {
    _.has(result, key) ? result[key]++ : result[key] = 1;
  });

  // Use a comparator function to figure out the smallest index at which
  // an object should be inserted so as to maintain order. Uses binary search.
  _.sortedIndex = function(array, obj, iterator, context) {
    iterator = lookupIterator(iterator);
    var value = iterator.call(context, obj);
    var low = 0, high = array.length;
    while (low < high) {
      var mid = (low + high) >>> 1;
      iterator.call(context, array[mid]) < value ? low = mid + 1 : high = mid;
    }
    return low;
  };

  // Safely create a real, live array from anything iterable.
  _.toArray = function(obj) {
    if (!obj) return [];
    if (_.isArray(obj)) return slice.call(obj);
    if (obj.length === +obj.length) return _.map(obj, _.identity);
    return _.values(obj);
  };

  // Return the number of elements in an object.
  _.size = function(obj) {
    if (obj == null) return 0;
    return (obj.length === +obj.length) ? obj.length : _.keys(obj).length;
  };

  // Array Functions
  // ---------------

  // Get the first element of an array. Passing **n** will return the first N
  // values in the array. Aliased as `head` and `take`. The **guard** check
  // allows it to work with `_.map`.
  _.first = _.head = _.take = function(array, n, guard) {
    if (array == null) return void 0;
    if ((n == null) || guard) return array[0];
    if (n < 0) return [];
    return slice.call(array, 0, n);
  };

  // Returns everything but the last entry of the array. Especially useful on
  // the arguments object. Passing **n** will return all the values in
  // the array, excluding the last N. The **guard** check allows it to work with
  // `_.map`.
  _.initial = function(array, n, guard) {
    return slice.call(array, 0, array.length - ((n == null) || guard ? 1 : n));
  };

  // Get the last element of an array. Passing **n** will return the last N
  // values in the array. The **guard** check allows it to work with `_.map`.
  _.last = function(array, n, guard) {
    if (array == null) return void 0;
    if ((n == null) || guard) return array[array.length - 1];
    return slice.call(array, Math.max(array.length - n, 0));
  };

  // Returns everything but the first entry of the array. Aliased as `tail` and `drop`.
  // Especially useful on the arguments object. Passing an **n** will return
  // the rest N values in the array. The **guard**
  // check allows it to work with `_.map`.
  _.rest = _.tail = _.drop = function(array, n, guard) {
    return slice.call(array, (n == null) || guard ? 1 : n);
  };

  // Trim out all falsy values from an array.
  _.compact = function(array) {
    return _.filter(array, _.identity);
  };

  // Internal implementation of a recursive `flatten` function.
  var flatten = function(input, shallow, output) {
    if (shallow && _.every(input, _.isArray)) {
      return concat.apply(output, input);
    }
    each(input, function(value) {
      if (_.isArray(value) || _.isArguments(value)) {
        shallow ? push.apply(output, value) : flatten(value, shallow, output);
      } else {
        output.push(value);
      }
    });
    return output;
  };

  // Flatten out an array, either recursively (by default), or just one level.
  _.flatten = function(array, shallow) {
    return flatten(array, shallow, []);
  };

  // Return a version of the array that does not contain the specified value(s).
  _.without = function(array) {
    return _.difference(array, slice.call(arguments, 1));
  };

  // Split an array into two arrays: one whose elements all satisfy the given
  // predicate, and one whose elements all do not satisfy the predicate.
  _.partition = function(array, predicate) {
    var pass = [], fail = [];
    each(array, function(elem) {
      (predicate(elem) ? pass : fail).push(elem);
    });
    return [pass, fail];
  };

  // Produce a duplicate-free version of the array. If the array has already
  // been sorted, you have the option of using a faster algorithm.
  // Aliased as `unique`.
  _.uniq = _.unique = function(array, isSorted, iterator, context) {
    if (_.isFunction(isSorted)) {
      context = iterator;
      iterator = isSorted;
      isSorted = false;
    }
    var initial = iterator ? _.map(array, iterator, context) : array;
    var results = [];
    var seen = [];
    each(initial, function(value, index) {
      if (isSorted ? (!index || seen[seen.length - 1] !== value) : !_.contains(seen, value)) {
        seen.push(value);
        results.push(array[index]);
      }
    });
    return results;
  };

  // Produce an array that contains the union: each distinct element from all of
  // the passed-in arrays.
  _.union = function() {
    return _.uniq(_.flatten(arguments, true));
  };

  // Produce an array that contains every item shared between all the
  // passed-in arrays.
  _.intersection = function(array) {
    var rest = slice.call(arguments, 1);
    return _.filter(_.uniq(array), function(item) {
      return _.every(rest, function(other) {
        return _.contains(other, item);
      });
    });
  };

  // Take the difference between one array and a number of other arrays.
  // Only the elements present in just the first array will remain.
  _.difference = function(array) {
    var rest = concat.apply(ArrayProto, slice.call(arguments, 1));
    return _.filter(array, function(value){ return !_.contains(rest, value); });
  };

  // Zip together multiple lists into a single array -- elements that share
  // an index go together.
  _.zip = function() {
    var length = _.max(_.pluck(arguments, 'length').concat(0));
    var results = new Array(length);
    for (var i = 0; i < length; i++) {
      results[i] = _.pluck(arguments, '' + i);
    }
    return results;
  };

  // Converts lists into objects. Pass either a single array of `[key, value]`
  // pairs, or two parallel arrays of the same length -- one of keys, and one of
  // the corresponding values.
  _.object = function(list, values) {
    if (list == null) return {};
    var result = {};
    for (var i = 0, length = list.length; i < length; i++) {
      if (values) {
        result[list[i]] = values[i];
      } else {
        result[list[i][0]] = list[i][1];
      }
    }
    return result;
  };

  // If the browser doesn't supply us with indexOf (I'm looking at you, **MSIE**),
  // we need this function. Return the position of the first occurrence of an
  // item in an array, or -1 if the item is not included in the array.
  // Delegates to **ECMAScript 5**'s native `indexOf` if available.
  // If the array is large and already in sort order, pass `true`
  // for **isSorted** to use binary search.
  _.indexOf = function(array, item, isSorted) {
    if (array == null) return -1;
    var i = 0, length = array.length;
    if (isSorted) {
      if (typeof isSorted == 'number') {
        i = (isSorted < 0 ? Math.max(0, length + isSorted) : isSorted);
      } else {
        i = _.sortedIndex(array, item);
        return array[i] === item ? i : -1;
      }
    }
    if (nativeIndexOf && array.indexOf === nativeIndexOf) return array.indexOf(item, isSorted);
    for (; i < length; i++) if (array[i] === item) return i;
    return -1;
  };

  // Delegates to **ECMAScript 5**'s native `lastIndexOf` if available.
  _.lastIndexOf = function(array, item, from) {
    if (array == null) return -1;
    var hasIndex = from != null;
    if (nativeLastIndexOf && array.lastIndexOf === nativeLastIndexOf) {
      return hasIndex ? array.lastIndexOf(item, from) : array.lastIndexOf(item);
    }
    var i = (hasIndex ? from : array.length);
    while (i--) if (array[i] === item) return i;
    return -1;
  };

  // Generate an integer Array containing an arithmetic progression. A port of
  // the native Python `range()` function. See
  // [the Python documentation](http://docs.python.org/library/functions.html#range).
  _.range = function(start, stop, step) {
    if (arguments.length <= 1) {
      stop = start || 0;
      start = 0;
    }
    step = arguments[2] || 1;

    var length = Math.max(Math.ceil((stop - start) / step), 0);
    var idx = 0;
    var range = new Array(length);

    while(idx < length) {
      range[idx++] = start;
      start += step;
    }

    return range;
  };

  // Function (ahem) Functions
  // ------------------

  // Reusable constructor function for prototype setting.
  var ctor = function(){};

  // Create a function bound to a given object (assigning `this`, and arguments,
  // optionally). Delegates to **ECMAScript 5**'s native `Function.bind` if
  // available.
  _.bind = function(func, context) {
    var args, bound;
    if (nativeBind && func.bind === nativeBind) return nativeBind.apply(func, slice.call(arguments, 1));
    if (!_.isFunction(func)) throw new TypeError;
    args = slice.call(arguments, 2);
    return bound = function() {
      if (!(this instanceof bound)) return func.apply(context, args.concat(slice.call(arguments)));
      ctor.prototype = func.prototype;
      var self = new ctor;
      ctor.prototype = null;
      var result = func.apply(self, args.concat(slice.call(arguments)));
      if (Object(result) === result) return result;
      return self;
    };
  };

  // Partially apply a function by creating a version that has had some of its
  // arguments pre-filled, without changing its dynamic `this` context. _ acts
  // as a placeholder, allowing any combination of arguments to be pre-filled.
  _.partial = function(func) {
    var boundArgs = slice.call(arguments, 1);
    return function() {
      var position = 0;
      var args = boundArgs.slice();
      for (var i = 0, length = args.length; i < length; i++) {
        if (args[i] === _) args[i] = arguments[position++];
      }
      while (position < arguments.length) args.push(arguments[position++]);
      return func.apply(this, args);
    };
  };

  // Bind a number of an object's methods to that object. Remaining arguments
  // are the method names to be bound. Useful for ensuring that all callbacks
  // defined on an object belong to it.
  _.bindAll = function(obj) {
    var funcs = slice.call(arguments, 1);
    if (funcs.length === 0) throw new Error('bindAll must be passed function names');
    each(funcs, function(f) { obj[f] = _.bind(obj[f], obj); });
    return obj;
  };

  // Memoize an expensive function by storing its results.
  _.memoize = function(func, hasher) {
    var memo = {};
    hasher || (hasher = _.identity);
    return function() {
      var key = hasher.apply(this, arguments);
      return _.has(memo, key) ? memo[key] : (memo[key] = func.apply(this, arguments));
    };
  };

  // Delays a function for the given number of milliseconds, and then calls
  // it with the arguments supplied.
  _.delay = function(func, wait) {
    var args = slice.call(arguments, 2);
    return setTimeout(function(){ return func.apply(null, args); }, wait);
  };

  // Defers a function, scheduling it to run after the current call stack has
  // cleared.
  _.defer = function(func) {
    return _.delay.apply(_, [func, 1].concat(slice.call(arguments, 1)));
  };

  // Returns a function, that, when invoked, will only be triggered at most once
  // during a given window of time. Normally, the throttled function will run
  // as much as it can, without ever going more than once per `wait` duration;
  // but if you'd like to disable the execution on the leading edge, pass
  // `{leading: false}`. To disable execution on the trailing edge, ditto.
  _.throttle = function(func, wait, options) {
    var context, args, result;
    var timeout = null;
    var previous = 0;
    options || (options = {});
    var later = function() {
      previous = options.leading === false ? 0 : _.now();
      timeout = null;
      result = func.apply(context, args);
      context = args = null;
    };
    return function() {
      var now = _.now();
      if (!previous && options.leading === false) previous = now;
      var remaining = wait - (now - previous);
      context = this;
      args = arguments;
      if (remaining <= 0) {
        clearTimeout(timeout);
        timeout = null;
        previous = now;
        result = func.apply(context, args);
        context = args = null;
      } else if (!timeout && options.trailing !== false) {
        timeout = setTimeout(later, remaining);
      }
      return result;
    };
  };

  // Returns a function, that, as long as it continues to be invoked, will not
  // be triggered. The function will be called after it stops being called for
  // N milliseconds. If `immediate` is passed, trigger the function on the
  // leading edge, instead of the trailing.
  _.debounce = function(func, wait, immediate) {
    var timeout, args, context, timestamp, result;

    var later = function() {
      var last = _.now() - timestamp;
      if (last < wait) {
        timeout = setTimeout(later, wait - last);
      } else {
        timeout = null;
        if (!immediate) {
          result = func.apply(context, args);
          context = args = null;
        }
      }
    };

    return function() {
      context = this;
      args = arguments;
      timestamp = _.now();
      var callNow = immediate && !timeout;
      if (!timeout) {
        timeout = setTimeout(later, wait);
      }
      if (callNow) {
        result = func.apply(context, args);
        context = args = null;
      }

      return result;
    };
  };

  // Returns a function that will be executed at most one time, no matter how
  // often you call it. Useful for lazy initialization.
  _.once = function(func) {
    var ran = false, memo;
    return function() {
      if (ran) return memo;
      ran = true;
      memo = func.apply(this, arguments);
      func = null;
      return memo;
    };
  };

  // Returns the first function passed as an argument to the second,
  // allowing you to adjust arguments, run code before and after, and
  // conditionally execute the original function.
  _.wrap = function(func, wrapper) {
    return _.partial(wrapper, func);
  };

  // Returns a function that is the composition of a list of functions, each
  // consuming the return value of the function that follows.
  _.compose = function() {
    var funcs = arguments;
    return function() {
      var args = arguments;
      for (var i = funcs.length - 1; i >= 0; i--) {
        args = [funcs[i].apply(this, args)];
      }
      return args[0];
    };
  };

  // Returns a function that will only be executed after being called N times.
  _.after = function(times, func) {
    return function() {
      if (--times < 1) {
        return func.apply(this, arguments);
      }
    };
  };

  // Object Functions
  // ----------------

  // Retrieve the names of an object's properties.
  // Delegates to **ECMAScript 5**'s native `Object.keys`
  _.keys = function(obj) {
    if (!_.isObject(obj)) return [];
    if (nativeKeys) return nativeKeys(obj);
    var keys = [];
    for (var key in obj) if (_.has(obj, key)) keys.push(key);
    return keys;
  };

  // Retrieve the values of an object's properties.
  _.values = function(obj) {
    var keys = _.keys(obj);
    var length = keys.length;
    var values = new Array(length);
    for (var i = 0; i < length; i++) {
      values[i] = obj[keys[i]];
    }
    return values;
  };

  // Convert an object into a list of `[key, value]` pairs.
  _.pairs = function(obj) {
    var keys = _.keys(obj);
    var length = keys.length;
    var pairs = new Array(length);
    for (var i = 0; i < length; i++) {
      pairs[i] = [keys[i], obj[keys[i]]];
    }
    return pairs;
  };

  // Invert the keys and values of an object. The values must be serializable.
  _.invert = function(obj) {
    var result = {};
    var keys = _.keys(obj);
    for (var i = 0, length = keys.length; i < length; i++) {
      result[obj[keys[i]]] = keys[i];
    }
    return result;
  };

  // Return a sorted list of the function names available on the object.
  // Aliased as `methods`
  _.functions = _.methods = function(obj) {
    var names = [];
    for (var key in obj) {
      if (_.isFunction(obj[key])) names.push(key);
    }
    return names.sort();
  };

  // Extend a given object with all the properties in passed-in object(s).
  _.extend = function(obj) {
    each(slice.call(arguments, 1), function(source) {
      if (source) {
        for (var prop in source) {
          obj[prop] = source[prop];
        }
      }
    });
    return obj;
  };

  // Return a copy of the object only containing the whitelisted properties.
  _.pick = function(obj) {
    var copy = {};
    var keys = concat.apply(ArrayProto, slice.call(arguments, 1));
    each(keys, function(key) {
      if (key in obj) copy[key] = obj[key];
    });
    return copy;
  };

   // Return a copy of the object without the blacklisted properties.
  _.omit = function(obj) {
    var copy = {};
    var keys = concat.apply(ArrayProto, slice.call(arguments, 1));
    for (var key in obj) {
      if (!_.contains(keys, key)) copy[key] = obj[key];
    }
    return copy;
  };

  // Fill in a given object with default properties.
  _.defaults = function(obj) {
    each(slice.call(arguments, 1), function(source) {
      if (source) {
        for (var prop in source) {
          if (obj[prop] === void 0) obj[prop] = source[prop];
        }
      }
    });
    return obj;
  };

  // Create a (shallow-cloned) duplicate of an object.
  _.clone = function(obj) {
    if (!_.isObject(obj)) return obj;
    return _.isArray(obj) ? obj.slice() : _.extend({}, obj);
  };

  // Invokes interceptor with the obj, and then returns obj.
  // The primary purpose of this method is to "tap into" a method chain, in
  // order to perform operations on intermediate results within the chain.
  _.tap = function(obj, interceptor) {
    interceptor(obj);
    return obj;
  };

  // Internal recursive comparison function for `isEqual`.
  var eq = function(a, b, aStack, bStack) {
    // Identical objects are equal. `0 === -0`, but they aren't identical.
    // See the [Harmony `egal` proposal](http://wiki.ecmascript.org/doku.php?id=harmony:egal).
    if (a === b) return a !== 0 || 1 / a == 1 / b;
    // A strict comparison is necessary because `null == undefined`.
    if (a == null || b == null) return a === b;
    // Unwrap any wrapped objects.
    if (a instanceof _) a = a._wrapped;
    if (b instanceof _) b = b._wrapped;
    // Compare `[[Class]]` names.
    var className = toString.call(a);
    if (className != toString.call(b)) return false;
    switch (className) {
      // Strings, numbers, dates, and booleans are compared by value.
      case '[object String]':
        // Primitives and their corresponding object wrappers are equivalent; thus, `"5"` is
        // equivalent to `new String("5")`.
        return a == String(b);
      case '[object Number]':
        // `NaN`s are equivalent, but non-reflexive. An `egal` comparison is performed for
        // other numeric values.
        return a != +a ? b != +b : (a == 0 ? 1 / a == 1 / b : a == +b);
      case '[object Date]':
      case '[object Boolean]':
        // Coerce dates and booleans to numeric primitive values. Dates are compared by their
        // millisecond representations. Note that invalid dates with millisecond representations
        // of `NaN` are not equivalent.
        return +a == +b;
      // RegExps are compared by their source patterns and flags.
      case '[object RegExp]':
        return a.source == b.source &&
               a.global == b.global &&
               a.multiline == b.multiline &&
               a.ignoreCase == b.ignoreCase;
    }
    if (typeof a != 'object' || typeof b != 'object') return false;
    // Assume equality for cyclic structures. The algorithm for detecting cyclic
    // structures is adapted from ES 5.1 section 15.12.3, abstract operation `JO`.
    var length = aStack.length;
    while (length--) {
      // Linear search. Performance is inversely proportional to the number of
      // unique nested structures.
      if (aStack[length] == a) return bStack[length] == b;
    }
    // Objects with different constructors are not equivalent, but `Object`s
    // from different frames are.
    var aCtor = a.constructor, bCtor = b.constructor;
    if (aCtor !== bCtor && !(_.isFunction(aCtor) && (aCtor instanceof aCtor) &&
                             _.isFunction(bCtor) && (bCtor instanceof bCtor))
                        && ('constructor' in a && 'constructor' in b)) {
      return false;
    }
    // Add the first object to the stack of traversed objects.
    aStack.push(a);
    bStack.push(b);
    var size = 0, result = true;
    // Recursively compare objects and arrays.
    if (className == '[object Array]') {
      // Compare array lengths to determine if a deep comparison is necessary.
      size = a.length;
      result = size == b.length;
      if (result) {
        // Deep compare the contents, ignoring non-numeric properties.
        while (size--) {
          if (!(result = eq(a[size], b[size], aStack, bStack))) break;
        }
      }
    } else {
      // Deep compare objects.
      for (var key in a) {
        if (_.has(a, key)) {
          // Count the expected number of properties.
          size++;
          // Deep compare each member.
          if (!(result = _.has(b, key) && eq(a[key], b[key], aStack, bStack))) break;
        }
      }
      // Ensure that both objects contain the same number of properties.
      if (result) {
        for (key in b) {
          if (_.has(b, key) && !(size--)) break;
        }
        result = !size;
      }
    }
    // Remove the first object from the stack of traversed objects.
    aStack.pop();
    bStack.pop();
    return result;
  };

  // Perform a deep comparison to check if two objects are equal.
  _.isEqual = function(a, b) {
    return eq(a, b, [], []);
  };

  // Is a given array, string, or object empty?
  // An "empty" object has no enumerable own-properties.
  _.isEmpty = function(obj) {
    if (obj == null) return true;
    if (_.isArray(obj) || _.isString(obj)) return obj.length === 0;
    for (var key in obj) if (_.has(obj, key)) return false;
    return true;
  };

  // Is a given value a DOM element?
  _.isElement = function(obj) {
    return !!(obj && obj.nodeType === 1);
  };

  // Is a given value an array?
  // Delegates to ECMA5's native Array.isArray
  _.isArray = nativeIsArray || function(obj) {
    return toString.call(obj) == '[object Array]';
  };

  // Is a given variable an object?
  _.isObject = function(obj) {
    return obj === Object(obj);
  };

  // Add some isType methods: isArguments, isFunction, isString, isNumber, isDate, isRegExp.
  each(['Arguments', 'Function', 'String', 'Number', 'Date', 'RegExp'], function(name) {
    _['is' + name] = function(obj) {
      return toString.call(obj) == '[object ' + name + ']';
    };
  });

  // Define a fallback version of the method in browsers (ahem, IE), where
  // there isn't any inspectable "Arguments" type.
  if (!_.isArguments(arguments)) {
    _.isArguments = function(obj) {
      return !!(obj && _.has(obj, 'callee'));
    };
  }

  // Optimize `isFunction` if appropriate.
  if (typeof (/./) !== 'function') {
    _.isFunction = function(obj) {
      return typeof obj === 'function';
    };
  }

  // Is a given object a finite number?
  _.isFinite = function(obj) {
    return isFinite(obj) && !isNaN(parseFloat(obj));
  };

  // Is the given value `NaN`? (NaN is the only number which does not equal itself).
  _.isNaN = function(obj) {
    return _.isNumber(obj) && obj != +obj;
  };

  // Is a given value a boolean?
  _.isBoolean = function(obj) {
    return obj === true || obj === false || toString.call(obj) == '[object Boolean]';
  };

  // Is a given value equal to null?
  _.isNull = function(obj) {
    return obj === null;
  };

  // Is a given variable undefined?
  _.isUndefined = function(obj) {
    return obj === void 0;
  };

  // Shortcut function for checking if an object has a given property directly
  // on itself (in other words, not on a prototype).
  _.has = function(obj, key) {
    return hasOwnProperty.call(obj, key);
  };

  // Utility Functions
  // -----------------

  // Run Underscore.js in *noConflict* mode, returning the `_` variable to its
  // previous owner. Returns a reference to the Underscore object.
  _.noConflict = function() {
    root._ = previousUnderscore;
    return this;
  };

  // Keep the identity function around for default iterators.
  _.identity = function(value) {
    return value;
  };

  _.constant = function(value) {
    return function () {
      return value;
    };
  };

  _.property = function(key) {
    return function(obj) {
      return obj[key];
    };
  };

  // Returns a predicate for checking whether an object has a given set of `key:value` pairs.
  _.matches = function(attrs) {
    return function(obj) {
      if (obj === attrs) return true; //avoid comparing an object to itself.
      for (var key in attrs) {
        if (attrs[key] !== obj[key])
          return false;
      }
      return true;
    }
  };

  // Run a function **n** times.
  _.times = function(n, iterator, context) {
    var accum = Array(Math.max(0, n));
    for (var i = 0; i < n; i++) accum[i] = iterator.call(context, i);
    return accum;
  };

  // Return a random integer between min and max (inclusive).
  _.random = function(min, max) {
    if (max == null) {
      max = min;
      min = 0;
    }
    return min + Math.floor(Math.random() * (max - min + 1));
  };

  // A (possibly faster) way to get the current timestamp as an integer.
  _.now = Date.now || function() { return new Date().getTime(); };

  // List of HTML entities for escaping.
  var entityMap = {
    escape: {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#x27;'
    }
  };
  entityMap.unescape = _.invert(entityMap.escape);

  // Regexes containing the keys and values listed immediately above.
  var entityRegexes = {
    escape:   new RegExp('[' + _.keys(entityMap.escape).join('') + ']', 'g'),
    unescape: new RegExp('(' + _.keys(entityMap.unescape).join('|') + ')', 'g')
  };

  // Functions for escaping and unescaping strings to/from HTML interpolation.
  _.each(['escape', 'unescape'], function(method) {
    _[method] = function(string) {
      if (string == null) return '';
      return ('' + string).replace(entityRegexes[method], function(match) {
        return entityMap[method][match];
      });
    };
  });

  // If the value of the named `property` is a function then invoke it with the
  // `object` as context; otherwise, return it.
  _.result = function(object, property) {
    if (object == null) return void 0;
    var value = object[property];
    return _.isFunction(value) ? value.call(object) : value;
  };

  // Add your own custom functions to the Underscore object.
  _.mixin = function(obj) {
    each(_.functions(obj), function(name) {
      var func = _[name] = obj[name];
      _.prototype[name] = function() {
        var args = [this._wrapped];
        push.apply(args, arguments);
        return result.call(this, func.apply(_, args));
      };
    });
  };

  // Generate a unique integer id (unique within the entire client session).
  // Useful for temporary DOM ids.
  var idCounter = 0;
  _.uniqueId = function(prefix) {
    var id = ++idCounter + '';
    return prefix ? prefix + id : id;
  };

  // By default, Underscore uses ERB-style template delimiters, change the
  // following template settings to use alternative delimiters.
  _.templateSettings = {
    evaluate    : /<%([\s\S]+?)%>/g,
    interpolate : /<%=([\s\S]+?)%>/g,
    escape      : /<%-([\s\S]+?)%>/g
  };

  // When customizing `templateSettings`, if you don't want to define an
  // interpolation, evaluation or escaping regex, we need one that is
  // guaranteed not to match.
  var noMatch = /(.)^/;

  // Certain characters need to be escaped so that they can be put into a
  // string literal.
  var escapes = {
    "'":      "'",
    '\\':     '\\',
    '\r':     'r',
    '\n':     'n',
    '\t':     't',
    '\u2028': 'u2028',
    '\u2029': 'u2029'
  };

  var escaper = /\\|'|\r|\n|\t|\u2028|\u2029/g;

  // JavaScript micro-templating, similar to John Resig's implementation.
  // Underscore templating handles arbitrary delimiters, preserves whitespace,
  // and correctly escapes quotes within interpolated code.
  _.template = function(text, data, settings) {
    var render;
    settings = _.defaults({}, settings, _.templateSettings);

    // Combine delimiters into one regular expression via alternation.
    var matcher = new RegExp([
      (settings.escape || noMatch).source,
      (settings.interpolate || noMatch).source,
      (settings.evaluate || noMatch).source
    ].join('|') + '|$', 'g');

    // Compile the template source, escaping string literals appropriately.
    var index = 0;
    var source = "__p+='";
    text.replace(matcher, function(match, escape, interpolate, evaluate, offset) {
      source += text.slice(index, offset)
        .replace(escaper, function(match) { return '\\' + escapes[match]; });

      if (escape) {
        source += "'+\n((__t=(" + escape + "))==null?'':_.escape(__t))+\n'";
      }
      if (interpolate) {
        source += "'+\n((__t=(" + interpolate + "))==null?'':__t)+\n'";
      }
      if (evaluate) {
        source += "';\n" + evaluate + "\n__p+='";
      }
      index = offset + match.length;
      return match;
    });
    source += "';\n";

    // If a variable is not specified, place data values in local scope.
    if (!settings.variable) source = 'with(obj||{}){\n' + source + '}\n';

    source = "var __t,__p='',__j=Array.prototype.join," +
      "print=function(){__p+=__j.call(arguments,'');};\n" +
      source + "return __p;\n";

    try {
      render = new Function(settings.variable || 'obj', '_', source);
    } catch (e) {
      e.source = source;
      throw e;
    }

    if (data) return render(data, _);
    var template = function(data) {
      return render.call(this, data, _);
    };

    // Provide the compiled function source as a convenience for precompilation.
    template.source = 'function(' + (settings.variable || 'obj') + '){\n' + source + '}';

    return template;
  };

  // Add a "chain" function, which will delegate to the wrapper.
  _.chain = function(obj) {
    return _(obj).chain();
  };

  // OOP
  // ---------------
  // If Underscore is called as a function, it returns a wrapped object that
  // can be used OO-style. This wrapper holds altered versions of all the
  // underscore functions. Wrapped objects may be chained.

  // Helper function to continue chaining intermediate results.
  var result = function(obj) {
    return this._chain ? _(obj).chain() : obj;
  };

  // Add all of the Underscore functions to the wrapper object.
  _.mixin(_);

  // Add all mutator Array functions to the wrapper.
  each(['pop', 'push', 'reverse', 'shift', 'sort', 'splice', 'unshift'], function(name) {
    var method = ArrayProto[name];
    _.prototype[name] = function() {
      var obj = this._wrapped;
      method.apply(obj, arguments);
      if ((name == 'shift' || name == 'splice') && obj.length === 0) delete obj[0];
      return result.call(this, obj);
    };
  });

  // Add all accessor Array functions to the wrapper.
  each(['concat', 'join', 'slice'], function(name) {
    var method = ArrayProto[name];
    _.prototype[name] = function() {
      return result.call(this, method.apply(this._wrapped, arguments));
    };
  });

  _.extend(_.prototype, {

    // Start chaining a wrapped Underscore object.
    chain: function() {
      this._chain = true;
      return this;
    },

    // Extracts the result from a wrapped and chained object.
    value: function() {
      return this._wrapped;
    }

  });

  // AMD registration happens at the end for compatibility with AMD loaders
  // that may not enforce next-turn semantics on modules. Even though general
  // practice for AMD registration is to be anonymous, underscore registers
  // as a named module because, like jQuery, it is a base library that is
  // popular enough to be bundled in a third party lib, but not be part of
  // an AMD load request. Those cases could generate an error when an
  // anonymous define() is called outside of a loader request.
  if (typeof define === 'function' && define.amd) {
    define('underscore', [], function() {
      return _;
    });
  }
}).call(this);

},{}]},{},[18])
(18)
});