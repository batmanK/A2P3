/*
* People.* Server code
*
* Copyright (C) Province of British Columbia, 2013
*/

/*
* NOTE: this is a symlinked file in each of the province subdirectories
* edit the file in the people directory, but don't reference it as the
* require() statements are expecting to in the province subdirectory
*/

var express = require('express')
  , config = require('../../config')
  , dashboard = require('../../lib/dashboard')
  , mw = require('../../lib/middleware')
  , request = require('../../lib/request')
  , token = require('../../lib/token')
  , db = require('../../lib/db')

var vault = {}  // we pull in correct vault when app() is called


// /di/link API called from setup
function diLink ( province ) {
  return function diLink ( req, res, next ) {
    var params = req.request['request.a2p3.org']
    db.updateProfile( 'people.'+province, params.sub, params.profile, function ( e ) {
      if (e) return next( e )
      res.send( {result: {success: true} } )
    })
  }
}

// calculates age with DOB passed in as string
function ageYears ( dateString ) {
  var dob = new Date( dateString )
  var today = new Date()
  var age = today.getFullYear() - dob.getFullYear()
  if ( ( today.getMonth() <= dob.getMonth() ) && ( today.getDate() <= dob.getDate() ) )
    age++
  return age
}

// /over19 API called from a registered App
function over19 ( province ) {
  return function over19 ( req, res, next ) {
    var di = req.token.sub
    db.getProfile( 'people.'+province, di, function ( e, profile ) {
      if (e) next( e )
      if (!profile || !profile.dob) {
        var err = new Error('no DOB for user')
        err.code = 'NO_PROFILE'
        return next( e )
      }
      var over19 = ageYears( profile.dob ) >= 19
      res.send( {result: {'over19': over19 ? true : false } } )
    })
  }
}

// /under20over65 API called from a registered App
function under20over65 ( province ) {
  return function under20over65 ( req, res, next ) {
    var di = req.token.sub
    db.getProfile( 'people.'+province, di, function ( e, profile ) {
      if (e) next( e )
      if (!profile || !profile.dob) {
        var err = new Error('no DOB for user')
        err.code = 'NO_PROFILE'
        return next( e )
      }
      var age = ageYears( profile.dob )
      var under20over65 = (age <= 19 || age >=65)
      res.send( {result: {'under20over65': under20over65 ? true : false } } )
    })
  }
}

// /namePhoto API called from a registered App
function namePhoto ( province ) {
  return function namePhoto ( req, res, next ) {
    var di = req.token.sub
    db.getProfile( 'people.'+province, di, function ( e, profile ) {
      if (e) next( e )
      if (!profile || !profile.name || !profile.photo) {
        var err = new Error('no name and/or photo for user')
        err.code = 'NO_PROFILE'
        return next( err )
      }
      res.send( {result: {'name': profile.name, 'photo': profile.photo} } )
    })
  }
}

// /photo API called from a registered App
function photo ( province ) {
  return function photo ( req, res, next ) {
    var di = req.token.sub
    db.getProfile( 'people.'+province, di, function ( e, profile ) {
      if (e) next( e )
      if (!profile || !profile.photo) {
        var err = new Error('no photo for user')
        err.code = 'NO_PROFILE'
        return next( e )
      }
      res.send( {result: {'photo': profile.photo} } )
    })
  }
}


// /region API called from a registered App
function region ( province ) {
  return function details ( req, res, next ) {
    var di = req.token.sub
    db.getProfile( 'people.'+province, di, function ( e, profile ) {
      if (e) next( e )
      if (!profile) {
        var err = new Error('no profile for user')
        err.code = 'NO_PROFILE'
        return next( e )
      }
      var region = profile.postal.slice( 0, 3 )
      res.send( {'result': {'region': region} } )
    })
  }
}

// /details API called from a registered App
function details ( province ) {
  return function details ( req, res, next ) {
    var di = req.token.sub
    db.getProfile( 'people.'+province, di, function ( e, profile ) {
      if (e) next( e )
      if (!profile) {
        var err = new Error('no profile for user')
        err.code = 'NO_PROFILE'
        return next( e )
      }
      res.send( {'result': profile } )
    })
  }
}

// generate request processing stack and routes
exports.app = function( province ) {

  vault = require('../'+province+'/vault.json')

  var app = express()

  app.use( express.limit('10kb') )  // protect against large POST attack
  app.use( express.bodyParser() )

  // All Dashboard Web pages and API
  dashboard.routes( app, 'people.'+province, vault )  // add in routes for the registration paths

  app.post('/di/link'
          , request.check( vault.keys, config.roles.enroll )
          , mw.a2p3Params( ['sub', 'profile'] )
          , diLink( province )
          )
  app.post('/over19'
          , request.check( vault.keys, null, 'people.'+province )
          , mw.a2p3Params( ['token'] )
          , token.checkRS( vault.keys, 'people.'+province, ['/scope/over19','/scope/details'], 'people' )
          , over19( province )
          )
  app.post('/under20over65'
          , request.check( vault.keys, null, 'people.'+province )
          , mw.a2p3Params( ['token'] )
          , token.checkRS( vault.keys, 'people.'+province, ['/scope/under20over65','/scope/details'], 'people' )
          , under20over65( province )
          )
  app.post('/namePhoto'
          , request.check( vault.keys, null, 'people.'+province )
          , mw.a2p3Params( ['token'] )
          , token.checkRS( vault.keys, 'people.'+province, ['/scope/namePhoto','/scope/details'], 'people' )
          , namePhoto( province )
          )
  app.post('/photo'
          , request.check( vault.keys, null, 'people.'+province )
          , mw.a2p3Params( ['token'] )
          , token.checkRS( vault.keys, 'people.'+province, ['/scope/namePhoto','/scope/details','/scope/photo'], 'people' )
          , photo( province )
          )
  app.post('/region'
          , request.check( vault.keys, null, 'people.'+province )
          , mw.a2p3Params( ['token'] )
          , token.checkRS( vault.keys, 'people.'+province, ['/scope/region','/scope/details'], 'people' )
          , region( province )
          )
  app.post('/details'
          , request.check( vault.keys, null, 'people.'+province )
          , mw.a2p3Params( ['token'] )
          , token.checkRS( vault.keys, 'people.'+province, ['/scope/details'], 'people' )
          , details( province )
          )

  app.get('/documentation', mw.md( config.rootAppDir+'/people/README.md' ) )
  app.get(/\/scope[\w\/]*/, mw.scopes( config.rootAppDir + '/people/scopes.json', config.host['people.'+province] ) )

  app.use( mw.errorHandler )
  return app
}

