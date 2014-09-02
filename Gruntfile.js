module.exports = function(grunt) {

	grunt.initConfig({
		pkg: grunt.file.readJSON('package.json'),
		wrap2000: {
			dist: {
				src: 'lib/backbone.js',
				dest: 'dist/temple.backbone.js'
			},
			options: {
				header: "/*\n * Temple Backbone\n * (c) 2014 Beneath the Ink, Inc.\n * MIT License\n * Version <%= pkg.version %>\n */\n"
			}
		},
		uglify: {
			dist: {
				src: "dist/temple.backbone.js",
				dest: "dist/temple.backbone.min.js"
			}
		}
	});

	grunt.loadNpmTasks('grunt-contrib-uglify');
	grunt.loadNpmTasks('grunt-wrap2000');

	grunt.registerTask('default', [ 'wrap2000', 'uglify' ]);

}