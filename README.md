# FireFlare
Firebase authentication for Cloudflare workers

# Disclaimer
The NPM package may (or may not) be a bit buggy. I uploaded it in a hurry and haven't setup much unit testing or CI for it.
If you have any problems with the package, just copy the code over directly for now. Once I have some more time, I'll clean up this
package a bit more.

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
