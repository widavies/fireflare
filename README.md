# FireFlare
Firebase authentication for Cloudflare workers with no dependencies. Google public keys are cached with Workers KV to speed up authentication.

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
    if(!(await auth('projectId', KV_NAMESPACE, request.headers.get('Authorization')?.replace("Bearer ", "") ?? null))) {
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
if (!(await auth('projectId', env.KV_NAMESPACE, request.headers.get('Authorization')?.replace("Bearer ", "") ?? null, [
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

# Example authentication using [itty-router](https://github.com/kwhitley/itty-router)
```typescript

// Auth middleware
const requireUser = async (request: Request, env: Env) => {
  const token = request.headers.get('Authorization')?.replace('Bearer ', '');

  return auth(env.FIREBASE_PROJECT_ID, env.KV_NAMESPACE, token ?? null).then((success) => {
    if (!success) {
      return new Response("Not authenticated", { status: 401 });
    }
  }).catch((err) => {
    return new Response("Not authenticated", { status: 401 });
  });
};

router.get('/hello-auth', requireUser, async (request, env) => {
  return new Response("Authenticated", { status: 200 });
});

```

# Bonus: Full example (including CORS)
```typescript
export interface Env {
  FIREBASE_PROJECT_ID: string,

  KV_NAMESPACE: KVNamespace;
}

const CorsHeaders = {
  "Access-Control-Allow-Origin": "https://www.example.com",
  "Access-Control-Allow-Methods": "GET,HEAD,POST,OPTIONS,DELETE",
  "Access-Control-Max-Age": "86400",
}

export default {
  async fetch (request: Request, env: Env, context: ExecutionContext) {
    if (request.method === "OPTIONS") {
      return handleOptions(request)
    } else {
      const response = await router.handle(request, env);

      if (response instanceof Response) {
        for (const [key, value] of Object.entries(CorsHeaders)) {
          response.headers.set(key, value);
        }
      }

      return response;
    }
  }
};

const router = Router();

const requireUser = async (request: Request, env: Env) => {
  const token = request.headers.get('Authorization')?.replace('Bearer ', '');

  return auth(env.FIREBASE_PROJECT_ID, env.KV_NAMESPACE, token ?? null).then((success) => {
    if (!success) {
      return new Response("Not authenticated", { status: 401 });
    }
  }).catch((err) => {
    return new Response("Not authenticated", { status: 401 });
  });
};

router.get('/hello-auth', requireUser, async (request: IttyRequest, env: Env) => {
  return new Response("Authenticated", { status: 200 });
});


router.all('*', () => new Response('Not Found.', { status: 404 }));

// Cors header stuff
function handleOptions (request: Request) {
  // Make sure the necessary headers are present
  // for this to be a valid pre-flight request
  let headers = request.headers
  if (
    headers.get("Origin") !== null &&
    headers.get("Access-Control-Request-Method") !== null &&
    headers.get("Access-Control-Request-Headers") !== null
  ) {
    // Handle CORS pre-flight request.
    // If you want to check or reject the requested method + headers
    // you can do that here.
    let respHeaders = {
      ...CorsHeaders,
      // Allow all future content Request headers to go back to browser
      // such as Authorization (Bearer) or X-Client-Name-Version
      "Access-Control-Allow-Headers": request.headers.get("Access-Control-Request-Headers") as string,
    }
    return new Response(null, {
      headers: respHeaders,
    })
  } else {
    // Handle standard OPTIONS request.
    // If you want to allow other HTTP Methods, you can do that here.
    return new Response(null, {
      headers: {
        Allow: "GET, HEAD, POST, OPTIONS, DELETE",
      },
    })
  }
}
```


