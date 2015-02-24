module.exports = function(grunt) {

	grunt.initConfig({
		pkg: grunt.file.readJSON('package.json'),
		clean: [ "dist/*.js" ],
		browserify: {
			test: {
				src: "test/*.js",
				dest: "dist/temple-backbone.test.js",
				options: {
					browserifyOptions: { debug: true }
				}
			}
		},
		wrap2000: {
			dist: {
				src: 'lib/backbone.js',
				dest: 'dist/temple-backbone.js',
				options: {
					header: "/*\n * Temple Backbone\n * (c) 2014-2015 Beneath the Ink, Inc.\n * MIT License\n * Version <%= pkg.version %>\n */\n"
				}
			},
			test: {
				src: 'dist/temple-backbone.test.js',
				dest: 'dist/temple-backbone.test.js',
				options: {
					header: "/* Temple Mustache Tests / (c) 2014-2015 Beneath the Ink, Inc. / MIT License / Version <%= pkg.version %> */"
				}
			}
		},
		uglify: {
			dist: {
				src: "dist/temple-backbone.js",
				dest: "dist/temple-backbone.min.js"
			}
		},
		watch: {
			test: {
				files: [ "lib/**/*.js", "test/*.js" ],
				tasks: [ 'test' ],
				options: { spawn: false }
			}
		}
	});

	grunt.loadNpmTasks('grunt-browserify');
	grunt.loadNpmTasks('grunt-contrib-watch');
	grunt.loadNpmTasks('grunt-contrib-clean');
	grunt.loadNpmTasks('grunt-contrib-uglify');
	grunt.loadNpmTasks('grunt-wrap2000');

	grunt.registerTask('build-dev', [ 'wrap2000:dist' ]);
	grunt.registerTask('build-test', [ 'browserify:test', 'wrap2000:test' ]);
	grunt.registerTask('build-dist', [ 'wrap2000:dist', 'uglify:dist' ]);

	grunt.registerTask('dev', [ 'clean', 'build-dev' ]);
	grunt.registerTask('test', [ 'clean', 'build-test' ]);
	grunt.registerTask('dist', [ 'clean', 'build-dist' ]);

	grunt.registerTask('default', [ 'dist' ]);

}