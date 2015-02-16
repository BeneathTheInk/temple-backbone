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

To use this plugin, call `.use(Temple.Backbone)` on a Temple view or viewmodel. This will enable Backbone models and collections as a compatible data type.

```javascript
view.use(Temple.Backbone);
view.set("bone", new Backbone.Model({ foo: "bar" }));
view.get("bone.foo"); // "bar"
```
