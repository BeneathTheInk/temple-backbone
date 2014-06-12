describe("Backbone", function() {
	var tpl, doc;

	this.timeout(1000);

	before(function() {
		doc = document.createDocumentFragment();
	});

	afterEach(function() {
		if (tpl != null) {
			tpl.erase();
			tpl = null;
		}

		expect(doc.childNodes.length).to.equal(0);
	});

	function render(template, scope) {
		tpl = new Temple.Mustache(template || "<span></span>", scope);
		tpl.use(Temple.Backbone);
		tpl.paint(doc);
		return tpl;
	}

	function getNodes() {
		var nodes = [];
		for (var i = 0; i < doc.childNodes.length; i++) {
			nodes.push(doc.childNodes[i]);
		}
		return nodes;
	}

	describe("Model Handler", function() {
		it("gets from backbone model", function() {
			render();
			var model = new Backbone.Model({ foo: "bar" });
			tpl.set("model", model);

			expect(tpl.get("model.foo")).to.equal("bar");
		});

		it("sets to backbone model", function() {
			render();
			var model = new Backbone.Model({ foo: "bar" });
			tpl.set("model", model);

			tpl.set("model.foo", "Hello World");
			expect(model.get("foo")).to.equal("Hello World");
		});

		it("unsets from backbone model", function() {
			render();
			var model = new Backbone.Model({ foo: "bar" });
			tpl.set("model", model);

			tpl.unset("model.foo");
			expect(model.get("foo")).to.be.undefined;
		});

		it("returns all properties in model", function() {
			render();
			var model = new Backbone.Model({ foo: "bar", baz: "buz" });
			tpl.set("model", model);

			expect(tpl.keys("model")).to.deep.equal([ "foo", "baz" ]);
		});

		it("merges plain objects with model", function() {
			render();
			var model = new Backbone.Model({ foo: "bar" });
			tpl.set("model", model);

			tpl.set("model", { baz: "buz" });
			expect(model.toJSON()).to.deep.equal({ foo: "bar", baz: "buz" });
		});

		it("notifies temple model of changes to backbone model", function() {
			render();
			var model = new Backbone.Model({ foo: "bar" });
			tpl.set("model", model);

			expect(tpl.get("model.baz")).to.be.undefined;
			model.set("baz", "buz");
			expect(tpl.get("model.baz")).to.equal("buz");
		});
	});

	describe("Collection Handler", function() {
		it("gets model from collection by index", function() {
			render();
			var col = new Backbone.Collection([ { foo: "bar" } ]);
			tpl.set("col", col);

			expect(tpl.get("col.0")).to.be.instanceof(Backbone.Model);
			expect(tpl.get("col.0").toJSON()).to.deep.equal({ foo: "bar" });
		});

		it("gets model from collection by id", function() {
			render();
			var col = new Backbone.Collection([ { id: "foo" } ]);
			tpl.set("col", col);

			expect(tpl.get("col.foo")).to.be.instanceof(Backbone.Model);
			expect(tpl.get("col.foo").toJSON()).to.deep.equal({ id: "foo" });
		});

		it("sets model by id", function() {
			render();
			var col = new Backbone.Collection([ { id: "foo" } ]);
			tpl.set("col", col);

			tpl.set("col.foo", { bar: "baz" });
			expect(col.get("foo").toJSON()).to.deep.equal({ id: "foo", bar: "baz" });
		});

		it("sets model by index", function() {
			render();
			var col = new Backbone.Collection();
			tpl.set("col", col);

			tpl.set("col.0", { id: "foo" });
			expect(col.get("foo").toJSON()).to.deep.equal({ id: "foo" });
		});

		it("notifies temple model of changes to backbone collection", function() {
			render();
			var col = new Backbone.Collection();
			tpl.set("col", col);

			expect(tpl.get("col.foo")).to.be.undefined;
			col.add({ id: "foo" });
			expect(tpl.get("col.foo")).to.be.instanceof(Backbone.Model);
			expect(tpl.get("col.foo").toJSON()).to.deep.equal({ id: "foo" });
		});
	});
});