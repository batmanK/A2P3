/* 
* token.js
*
* creates and parses A2P3 tokens
*
* Copyright (C) Province of British Columbia, 2013
*/

var config = require('./config')
  , jwt = require('./jwt')

exports.create = function ( payload, credentials ) {
  var details =
    { header:
      { typ: 'JWE'
      , alg: 'dir'
      , enc: config.alg.JWE
      , kid: credentials.kid
      }
    , payload: payload
    , credentials: credentials
    }
    details.payload.iat = jwt.iat()
    return jwt.jwe( details )
}

/*



exports.parse = function ( token, getCreds ) {
  var payload = jwt.decode( token, function (header) {
    if (header.typ !== 'JWE' || header.alg !== 'dir' || header.enc !== config.alg.JWE)
        return undefined
    else 
        return getCreds( header )
  })
  return payload
}
*/