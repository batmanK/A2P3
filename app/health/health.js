/*
* Standardized Health Server code
*
* Copyright (C) Province of British Columbia, 2013
*/

var express = require('express')
  , vault = require('./vault')
  , stdDashboard = require('../lib/stddashboard')
  , mw = require('../lib/middleware')
  , config = require('../config')

exports.app = function( ) {
  var app = express()

  app.use( express.limit('10kb') )  // protect against large POST attack
  app.use( express.bodyParser() )

  // All Dashboard Web pages and API
  stdDashboard.routes( app, 'health', vault )  // add in routes for the registration paths

  app.get(/\/scope[\w\/]*/, mw.scopes( __dirname + '/scopes.json', config.host.health ) )
  app.get('/documentation', mw.md( config.rootAppDir+'/health/README.md' ) )
  app.use( mw.errorHandler )
  return app
}
