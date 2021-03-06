/*
* email RS Server code
*
* Copyright (C) Province of British Columbia, 2013
*/

var express = require('express')
  , vault = require('./vault')
  , config = require('../config')
  , dashboard = require('../lib/dashboard')
  , request = require('../lib/request')
  , mw = require('../lib/middleware')
  , db = require('../lib/db')
  , token = require('../lib/token')


// /di/link API called from setup
function diLink ( req, res, next ) {
  var params = req.request['request.a2p3.org']
  db.updateProfile( 'email', params.sub, {'email': params.account}, function ( e ) {
    if (e) return next( e )
    res.send( {result: {success: true} } )
  })
}

// /email/default API called from a registered App
function emailDefault ( req, res, next ) {
  var di = req.token.sub
  db.getProfile( 'email', di, function ( e, profile ) {
    if (e) next( e )
    if (!profile || !profile.email) {
      var err = new Error('no email for user')
      err.code = 'NO_EMAIL'
      return next( err )
    }
    res.send( {result: {'email': profile.email} } )
  })
}

// generate request processing stack and routes
exports.app = function() {
	var app = express()

  app.use( express.limit('10kb') )  // protect against large POST attack
  app.use( express.bodyParser() )

  // All Dashboard Web pages and API
  dashboard.routes( app, 'email', vault )  // add in routes for the registration paths

  app.post('/di/link'
          , request.check( vault.keys, config.roles.enroll )
          , mw.a2p3Params( ['sub', 'account'] )
          , diLink
          )
  app.post('/email/default'
          , request.check( vault.keys, null, 'email' )
          , mw.a2p3Params( ['token'] )
          , token.checkRS( vault.keys, 'email', ['/scope/default'] )
          , emailDefault
          )

  app.get('/documentation', mw.md( __dirname+'/README.md' ) )
  app.get(/\/scope[\w\/]*/, mw.scopes( __dirname + '/scopes.json', config.host.email ) )

  app.use( mw.errorHandler )

  return app
}
