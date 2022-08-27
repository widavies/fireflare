# FireFlare
Firebase authentication for Cloudflare workers with no dependencies.

# Installation
`npm i fireflare`

https://www.npmjs.com/package/fireflare
# Usage
```typescript
import {auth} from "fireflare"

// Taken from https://github.com/cloudflare/worker-template-router
async function handleRequest(request: Request) {
  const r = new Router()

  r.get('/', async (request) => {
    if(!(await auth('projectId', KV_NAMESPACE, request.headers.get('Authorization').replace("Bearer ", "")))) {
      // Not authenticated
      return new Response("Unauthorized");
    }

    return new Response("Authorized");
  }) // return a default message for the root route

  const resp = await r.route(request)
  return resp
}
```
# Additional/custom claims validation
```typescript
if (!(await auth('projectId', env.KV_DANGEROUS_KEAP, request.headers.get('Authorization').replace("Bearer ", ""), [
  // Use a helper claims check function
  Equals('custom-claim', 'expected-value'),
  InPast('issued'),
  InFuture('exp'),
  NotEmpty('sub'),
  // Validate claims with custom implementation
  (claims) => {
    const value = claims['custom-claim'];
    // Return false to reject
    return (typeof value === 'string' || value instanceof String) && value === "custom-value";
  }
]))) {
  // Not authenticated
  return new Response("Unauthorized");
}
```
