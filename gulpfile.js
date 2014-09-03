var gulp = require('gulp');
var nodemonitor = require('gulp-nodemon');
var gutil = require('gulp-util');
var linter = require('gulp-jshint');

gulp.task('beep', function() {
  return gutil.beep();
});

gulp.task('lint', function() {
  return gulp.src(['server.js', 'lib/*.js'])
    .pipe(linter())
    .pipe(linter.reporter('jshint-stylish'));
});

gulp.task('server', ['lint'], function() {
  var options = {
    script: 'server.js',
    ext: 'js json yml'
  };
  return nodemonitor(options)
    .on('crash', 'beep');
});

gulp.task('default', ['server']);
