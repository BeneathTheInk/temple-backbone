# Temple Backbone

Adds Backbone specific handlers to [Temple](https://github.com/BeneathTheInk/Temple).

## Install

Download the latest version `dist/` folder and use via a script tag. The Backbone source is not included with this plugin, so it must be made available externally. Backbone depends on Underscore and, optionally, jQuery, so those should be included as well.

```html
<script type="text/javascript" src="underscore.js"></script>
<script type="text/javascript" src="backbone.js"></script>
<script type="text/javascript" src="temple.js"></script>
<script type="text/javascript" src="temple.backbone.js"></script>
```

If using Browserify or Node.js, you can install via NPM and use via `require("temple-backbone")`.

	$ npm install temple-backbone

## Usage

To use this plugin, call `.use("backbone")` on a Temple view. This will enable Backbone models and collections as a compatible data type.

```javascript
view.use("backbone");
view.set(new Backbone.Model({ foo: "bar" }));
view.get("foo"); // "bar"
```

By default, Models are non-reactive, meaning that the view will not update as data changes. To enable, you can install and manage `Dependency` instances yourself, or use the built in `trackModel()` and `trackCollection()` methods.

```javascript
var model = new Backbone.Model({ foo: "bar" });
Temple.Backbone.trackModel(model);
view.set(model);
```