/**
 * Attempts to authenticate the user using Firebase authentication. 
 * @param projectId Your Firebase project id
 * @param cache A reference to your workers KV, used for caching the Firebase public key.
 * @param token The Firebase id token
 * @param claimChecks: A list of any additional payload claim checks that should be performed.
 * @returns A map containing JWT payload claims if authenticated, undefined if not authenticated.
 *          The user's Firebase uid is available within the returned claims with key "sub".
 */
export async function auth (projectId: string, cache: any, token: string | null, claimChecks: ((claims: any) => boolean)[] = []) {
  try {
    if (!token) {
      throw ({ message: 'No token provided' });
    }

    const decodedToken = decodeJwt(token);

    // Validate header and payload claims according to
    // https://firebase.google.com/docs/auth/admin/verify-id-tokens#verify_id_tokens_using_a_third-party_jwt_library
    if (!validateClaims(decodedToken.payload, [
      InFuture('exp'),
      InPast('iat'),
      Equals('aud', projectId),
      Equals('iss', `https://securetoken.google.com/${projectId}`),
      NotEmpty('sub'),
      InPast('auth_time')
    ]) || !validateClaims(decodedToken.header, [
      Equals('alg', 'RS256')
    ]) || !validateClaims(decodedToken.payload, claimChecks)) {
      throw ({ message: 'Claims not valid', headers: decodedToken.header, claims: decodedToken.payload });
    }

    const encoder = new TextEncoder();
    const data = encoder.encode([decodedToken.raw.header, decodedToken.raw.payload].join('.'));
    const signature = new Uint8Array(Array.from(decodedToken.signature).map((c) => c.charCodeAt(0)));

    // Get the public Firebase JWK from cache or Google
    const jwk = await getGooglePk(cache, decodedToken.header.kid);

    // Validate the jwk
    const key = await crypto.subtle.importKey(
      'jwk',
      jwk,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['verify'],
    );

    if (await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, signature, data)) {
      return decodedToken.payload;
    } else {
      throw ({ message: 'Signature not valid', headers: decodedToken.header, claims: decodedToken.payload });
    }
  } catch (e) {
    console.error("Auth error:", e);
    return undefined;
  }
}

// Helper functions for validating claims
export const Equals = (key: string, expected: string) => (claims: any): boolean => expected === claims[key];
export const InFuture = (key: string) => (claims: any): boolean => {
  const value = claims[key];
  return typeof value === 'number' && value > Math.round(new Date().getTime() / 1000);
}
export const InPast = (key: string) => (claims: any): boolean => {
  const value = claims[key];
  return typeof value === 'number' && value <= Math.round(new Date().getTime() / 1000);
}
export const NotEmpty = (key: string) => (claims: any): boolean => {
  const value = claims[key];
  return (typeof value === 'string' || value instanceof String) && value !== "";
}

// INTERNALS

// Ensures that each "condition" is true for claims.
function validateClaims (claims: any, conditions: ((claims: any) => boolean)[]): boolean {
  return conditions.every((cond) => cond(claims));
}

/**
 * Parse and decode a JWT.

 * A JWT is three, base64 encoded, strings concatenated with '.':
 *   a header, a payload, and the signature.
 * The signature is "URL safe", in that '/+' characters have been replaced by '_-'
 *
 * Steps:
 * 1. Split the token at the '.' character
 * 2. Base64 decode the individual parts
 * 3. Retain the raw Bas64 encoded strings to verify the signature
 * 
 * Taken from: https://developers.cloudflare.com/workers/tutorials/authorize-users-with-auth0#persisting-authorization-data-in-workers-kv
 */
function decodeJwt (token: string) {
  function decodeBase64 (str: string): string {
    let result = str.replace(/_/g, '/').replace(/-/g, '+');

    switch (str.length % 4) {
      case 0:
        return atob(result);
      case 2:
        return atob(result + '==');
      case 3:
        return atob(result + '=');
      default:
        throw 'Illegal base64url string!';
    }
  }

  const parts = token.split('.');

  const header = JSON.parse(decodeBase64(parts[0]));

  // The string starts as base64, with '/' replaced with '_' and '+' with '-'
  // to make the JWT easy to send over a connection. atob() then turns this
  // text into the actual binary string (any UTF-8 character). This needs to
  // be parsed into JSON. 
  const payload = JSON.parse(
    decodeURIComponent(escape(decodeBase64(parts[1])))
  );

  const signature = decodeBase64(parts[2]);

  return {
    header: header,
    payload: payload,
    signature: signature,
    raw: { header: parts[0], payload: parts[1], signature: parts[2] }
  };
}


// Gets the Google public key to use for validating the id token.
async function getGooglePk (cache: any, kid: string) {
  const key = await cache.get('google_pk', 'json');

  if (key) {
    return key.find((x: any) => x.kid == kid);
  } else {
    const jwkRes = await fetch('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com');
    const jwks = await jwkRes.json();

    if (jwks.keys) {
      // we can cache jwk keys for up to max-age ttl
      const matches = (jwkRes.headers.get('cache-control') || "").match(/max-age=(\d+)/)
      const maxAge = matches ? (parseInt(matches[1]) - 120) : undefined
      await cacheKey(cache, jwks.keys, maxAge);

      return jwks.keys.find((x: any) => x.kid === kid)
    }

    return undefined;
  }
}

async function cacheKey (cache: any, data: any, ttl: number = 3600) {
  if (data && !data.error) {
    return await cache.put('google_pk', JSON.stringify(data), {
      expirationTtl: ttl > 0 ? ttl : undefined,
    })
  } else {
    return
  }
}