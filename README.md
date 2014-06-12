# Temple Bacbone

Makes Temple more compatible with Backbone.

## Install

Download the latest version `dist/` folder and use via a script tag. The Backbone source is not included with this plugin, so it must be made available externally. Backbone depends on Underscore and, optionally, jQuery, so those should be included as well.

```html
<script type="text/javascript" src="jquery.js"></script>
<script type="text/javascript" src="underscore.js"></script>
<script type="text/javascript" src="backbone.js"></script>
<script type="text/javascript" src="temple.js"></script>
<script type="text/javascript" src="temple.backbone.js"></script>
```

If using Browserify or Node.js, you can install via NPM and use via `require("temple-backbone")`.

	$ npm install temple-backbone

## Usage

