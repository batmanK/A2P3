/*
* Standardized People Server code
*
* Copyright (C) Province of British Columbia, 2013
*/

var express = require('express')

var express = require('express')
  , vault = require('./vault')
  , stdRegistration = require('../lib/stdRegistration')
  , mw = require('../lib/middleware')

exports.app = function( ) {
  var app = express()

  app.use( express.limit('10kb') )  // protect against large POST attack
  app.use( express.bodyParser() )

  stdRegistration.routes( app, 'people', vault )  // add in routes for the registration paths

  mw.loginHandler( app, { 'dashboard': 'people', 'vault': vault } )

  app.use( mw.errorHandler )
  return app
}

