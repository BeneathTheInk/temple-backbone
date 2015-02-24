var Backbone = require("backbone"),
	Mustache = require("temple-mustache"),
	expect = require("./utils/expect");

// load & register the plugin
require("../");

describe("Backbone", function() {
	var tpl, doc;

	this.timeout(1000);

	before(function() {
		doc = document.createDocumentFragment();
	});

	afterEach(function() {
		if (tpl != null) {
			tpl.detach();
			tpl = null;
		}

		expect(doc.childNodes.length).to.equal(0);
	});

	function render(template, data) {
		tpl = Mustache.render(template || "<span></span>", data);
		tpl.use("backbone");
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
			var model = new Backbone.Model({ foo: "bar" });
			render(null, { model: model });

			expect(tpl.get("model.foo")).to.equal("bar");
		});

		it("gets are reactive on tracked models", function() {
			var model = new Backbone.Model({ foo: "bar" });
			Mustache.Backbone.trackModel(model);
			render(null, { model: model });
			var seen = 0;

			tpl.autorun(function() {
				if (seen === 0) expect(tpl.get("model.baz")).to.be.undefined;
				if (seen === 1) expect(tpl.get("model.baz")).to.equal("buz");
				seen++;
			});

			model.set("baz", "buz");
			Mustache.Deps.flush();
			expect(seen).to.equal(2);
		});
	});

	describe("Collection Handler", function() {
		it("gets model from collection by index", function() {
			var col = new Backbone.Collection([ { foo: "bar" } ]);
			render(null, { col: col });

			expect(tpl.get("col.0")).to.be.instanceof(Backbone.Model);
			expect(tpl.get("col.0").toJSON()).to.deep.equal({ foo: "bar" });
		});

		it("gets model from collection by id", function() {
			var col = new Backbone.Collection([ { id: "foo" } ]);
			render(null, { col: col });

			expect(tpl.get("col.foo")).to.be.instanceof(Backbone.Model);
			expect(tpl.get("col.foo").toJSON()).to.deep.equal({ id: "foo" });
		});

		it("gets are reactive on tracked collections", function() {
			var col = new Backbone.Collection();
			Mustache.Backbone.trackCollection(col);
			render(null, { col: col });var seen = 0;

			tpl.autorun(function() {
				if (seen === 0) expect(tpl.get("col.foo")).to.be.undefined;
				if (seen === 1) {
					expect(tpl.get("col.foo")).to.be.instanceof(Backbone.Model);
					expect(tpl.get("col.foo").toJSON()).to.deep.equal({ id: "foo" });
				}

				seen++;
			});

			col.add({ id: "foo" });
			Mustache.Deps.flush();
			expect(seen).to.equal(2);
		});
	});
});