/* 
* email RS Server code
*
* Copyright (C) Province of British Columbia, 2013
*/

var express = require('express')
  , vault = require('./vault')
  , config = require('../config')
  , db = require('../db')
  , registration = require('../registration')
  , mw = require('../middleware')
  , request = require('../request')
  , token = require('../token')
  , querystring = require('querystring')
  , api = require('../api')
  , jwt = require('../jwt')


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
      var e = new Error('no email for user')
      e.code = 'NO_EMAIL'
      return next( e )
    }
    res.send( {result: {'email': profile.email} } )
  })
}

/*
* login code
*/

function fetchIXToken ( agentRequest, ixToken, details, cb ) {
   var apiDetails =
      { host: 'ix'
      , api: '/exchange'
      , credentials: details.vault.keys[config.host.ix].latest
      , payload: 
        { iss: config.host[details.app]
        , aud: config.host.ix
        , 'request.a2p3.org':
          { 'token': ixToken
          , 'request': agentRequest
          }
        }
      }
    api.call( apiDetails, cb )
}

// /*/login handler, generates an Agent Request 
// returns to caller if 'qr' parameter provided
// redirects to 'returnURL' if provided
// else redirects to Agent Protocol Handler
function login ( details ) {
  return function login ( req, res, next ) {
    // create Agent Request
    var agentRequestPayload =
      { iss: config.host[details.app]
      , aud: config.host.ix
      , 'request.a2p3.org':
        { 'returnURL': details.url.return 
        , 'resources': details.resources
        , 'auth': { 'passcode': true, 'authorization': true }
        }
      }
    var jsonResponse = req.query && req.query.json
    var agentRequest = request.create( agentRequestPayload, details.vault.keys[config.host.ix].latest )  
    req.session.agentRequest = agentRequest
    var redirectUrl = (req.query && req.query.returnURL) ? req.query.returnURL : 'a2p3.net://token'
    redirectUrl += '?request=' + agentRequest
    if (jsonResponse) {  // client wants JSON, likely will generate QR code
      var state = jwt.handle()
      req.session.loginState = state
      var statusURL = details.url.return + '?' + querystring.stringify( { 'state': state } )
      redirectUrl += '&' + querystring.stringify( { 'statusURL': statusURL, 'state': state } )
      return res.send( { result: {'request': redirectUrl } } )
    } else {
      return res.redirect( redirectUrl )
    }
  }
}

// /*/login/return handler 
// if gets IX Token, fetches RS Tokens and redirects to success or error urls
function loginReturn ( details ) {
  return function loginReturn ( req, res, next ) {
    // check if we got IX Token
    var ixToken = req.query.token
    var errorCode = req.query.error
    var errorMessage = req.query.errorMessage

    function sendError ( code, message ) {
      var errorUrl = details.url.error + '&' + querystring.stringify( {'error':code,'errorMessage':message})
      return res.redirect( errorUrl )
    }
    if (!req.session.agentRequest) return sendError( "UNKNOWN", "Session information lost" )
    if (!ixToken) return sendError( errorCode, errorMessage )

    fetchIXToken( req.session.agentRequest, ixToken, details, function (response) {
      if (response.error) return sendError( response.error.code, response.error.message )
      req.session.di = response.result.sub
      req.session.tokens = response.result.tokens
      req.session.redirects = response.result.redirects
      var jsonResponse = req.query && req.query.json
      if (jsonResponse) {  // client wants JSON
        return res.send( { result: {'url': details.url.success } } )
      } else {
        res.redirect( details.url.success )
      }
    })
  }
}
function loginStateCheck ( details ) {
  return function loginStateCheck ( req, res, next ) {
    if (!req.query.state) return next()
    // we have a loginState, which means we have moved the Agent Request
    // and IX Token using a different browser

    if (req.query.token || req.query.error) { // we are getting token or error from the agent, publish to channel
      db.writeChannel( req.query.state, req.query )
      res.redirect( details.url.remoteComplete )
      return // next('route')
    } else {
      if (req.query.state != req.session.loginState) {
        var e = new Error('Could not find state in session data')
        e.code = 'UNKNOWN_ERROR'
        return next(e)
      }
      db.readChannel( req.query.state, function ( e, query ) {
        if (e) return next( e )
        Object.keys(query).forEach( function (k) { req.query[k] = query[k] } )
        next()
      })
    }
  }
}

var loginDetails =
  { 'app': 'email'
  , 'vault': vault
  , 'resources':
    [ config.baseUrl.email + '/email/default'
    , config.baseUrl.registrar + '/scope/verify'
    ]
  , 'url':
    { 'return':   config.baseUrl.email + '/dashboard/login/return'
    , 'error':      config.baseUrl.email + '/dashboard/error'
    , 'success':    config.baseUrl.email + '/dashboard'
    , 'remoteComplete':    config.baseUrl.email + '/dashboard/complete'  
    }
  }




// generate request processing stack and routes
exports.app = function() {
	var app = express()

  app.use( express.limit('10kb') )  // protect against large POST attack
  app.use( express.bodyParser() )
  
  registration.routes( app, 'email', vault )  // add in routes for the registration paths

  app.get('/dashboard/login', login( loginDetails ) )

  app.get('/dashboard/login/return', loginStateCheck( loginDetails ), loginReturn( loginDetails ) )

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
  app.use( mw.errorHandler )
	
  return app
}