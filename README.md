# FireFlare
Firebase authentication for Cloudflare workers

# Installation
`npm i fireflare`

https://www.npmjs.com/package/fireflare
# Usage
```typescript
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
