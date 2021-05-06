# FireFlare
Firebase authentication for Cloudflare workers

# Disclaimer
This code does work, but when I find time I do want to add some unit testing and clean up the NPM package. 
If you can't get the npm package, just copy the code over for now. 

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
