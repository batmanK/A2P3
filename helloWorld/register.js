/* 
* Hello World registration script
*
* Copyright (C) Province of British Columbia, 2013
*/

var fetchUrl = require('fetch').fetchUrl
  , config = require('../app/config')
  , request = require('../app/request')
  , token = require('../app/token')
  , querystring = require('querystring')
  , url = require('url')
  , vaultSetup = require('../app/setup/vault')
  , api = require('../app/api')
  , jwt = require('../app/jwt')
  , db = require('../app/db')
  , async = require('async')

var setupDI       // root user Directed Identifier, fetched from Setup Agent storage
  , tasks = []
  , agentRequest
  , rsTokens
  , cookieJar


function dashboardLogin ( di, rs, vault, done ) {
  var cookieJar
    , agentRequest
  
  var options = { disableRedirects: true }
  fetchUrl( config.baseUrl[rs] + '/dashboard/login', options, function ( error, meta, body ) {
    if ( error ) return done( error )
    cookieJar = meta.cookieJar
    var o = url.parse( meta.responseHeaders.location, true )
    agentRequest = o.query.request
    var jws = new jwt.Parse( agentRequest )
    var tokenPayload =
      { iss: config.host.setup
      , aud: config.host.ix
      , sub: setupDI
      , 'token.a2p3.org':
        { 'auth': jws.payload['request.a2p3.org'].auth
        , 'sar': jws.signature
        }
      }
    var ixToken = token.create( tokenPayload, vault.keys[config.host.ix].latest )
    var returnURL = jws.payload['request.a2p3.org'].returnURL + '?token=' + ixToken + '&json=true'
    var options = { disableRedirects: true, cookieJar: cookieJar }
    fetchUrl( returnURL, options, function ( error, meta, body ) {
      if ( error ) return done( error )
      var result = JSON.parse( body )
      if (result.error) return done( result.error )
      cookieJar = meta.cookieJar
console.log('we are now logged into '+config.host[rs])      
      done( null, cookieJar )
    })
  })
}


var tasks =
  [ function getDI ( done ) {
      db.retrieveAgentFromDevice( 'root', function ( e, agent ) {
        if ( e ) return done( e ) 
        setupDI = agent.di
console.log('setupDI',setupDI)      
        done( null, 'ok' )
      })
    }
  , function registrarLogin ( done ) {
      dashboardLogin( setupDI, 'registrar', vaultSetup, function ( e, newCookies ) {
        if (e) return done( e )
        cookieJar = newCookies
      })
    }
  ]

async.series( tasks, function ( error, results ) {
  console.log('error:',error)
  console.log('results:',results)
})