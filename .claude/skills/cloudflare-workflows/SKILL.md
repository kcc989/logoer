# Cloudflare Workflows Skill

## Overview

Cloudflare Workflows enables building durable, multi-step applications on the Workers platform. Workflows automatically retry failed steps, persist state, run for hours or days, and coordinate between third-party APIs.

**Common use cases:**

- Post-process file uploads to R2 storage
- Automate Workers AI embeddings into Vectorize
- Trigger user lifecycle emails
- Process payments with retry logic
- Coordinate multi-service operations

## Core Concepts

### WorkflowEntrypoint

Every Workflow must extend `WorkflowEntrypoint` and implement a `run` method:

```typescript
import {
  WorkflowEntrypoint,
  WorkflowStep,
  WorkflowEvent,
} from 'cloudflare:workers';

type Env = {
  MY_WORKFLOW: Workflow;
};

type Params = {
  email: string;
  metadata: Record<string, string>;
};

export class MyWorkflow extends WorkflowEntrypoint<Env, Params> {
  async run(event: WorkflowEvent<Params>, step: WorkflowStep) {
    // Access bindings via this.env
    // Access params via event.payload

    const result = await step.do('my step', async () => {
      return { data: 'processed' };
    });

    return result; // Optional: return value available via instance.status()
  }
}
```

### WorkflowEvent

The event passed to `run` contains:

```typescript
type WorkflowEvent<T> = {
  payload: Readonly<T>; // Your custom params
  timestamp: Date; // When instance was created
  instanceId: string; // Unique instance identifier
};
```

### Steps

Steps are the fundamental unit of a Workflow - each is independently retriable and persists state.

#### step.do - Execute Code

```typescript
// Basic step
const result = await step.do('fetch data', async () => {
  const response = await fetch('https://api.example.com/data');
  return await response.json();
});

// Step with retry configuration
const result = await step.do(
  'call external api',
  {
    retries: {
      limit: 5,
      delay: '5 second',
      backoff: 'exponential',
    },
    timeout: '15 minutes',
  },
  async () => {
    return await callExternalService();
  }
);
```

#### step.sleep - Pause Execution

```typescript
// Relative duration (human-readable)
await step.sleep('wait before retry', '1 hour');
await step.sleep('delay processing', '30 minutes');

// Accepted units: second, minute, hour, day, week, month, year
// Also accepts milliseconds as number
await step.sleep('short wait', 5000);
```

#### step.sleepUntil - Sleep to Specific Time

```typescript
// Sleep until a specific Date
const targetDate = new Date('2024-12-01T09:00:00Z');
await step.sleepUntil('wait for launch', targetDate);

// UNIX timestamp (milliseconds)
await step.sleepUntil('scheduled task', Date.parse('24 Oct 2024 13:00:00 UTC'));
```

#### step.waitForEvent - Wait for External Events

```typescript
// Wait for an event (default timeout: 24 hours)
const event = await step.waitForEvent<WebhookPayload>('receive webhook', {
  type: 'stripe-webhook', // Must match sendEvent type
  timeout: '1 hour',
});

// Use the received payload
console.log(event.payload);
```

## Configuration

### Wrangler Configuration

```json
{
  "name": "my-worker",
  "main": "src/index.ts",
  "compatibility_date": "2024-10-22",
  "workflows": [
    {
      "name": "my-workflow",
      "binding": "MY_WORKFLOW",
      "class_name": "MyWorkflow"
    }
  ]
}
```

Or in TOML:

```toml
name = "my-worker"
main = "src/index.ts"
compatibility_date = "2024-10-22"

[[workflows]]
name = "my-workflow"
binding = "MY_WORKFLOW"
class_name = "MyWorkflow"
```

### Cross-Worker Binding

To bind to a Workflow in a different Worker:

```json
{
  "workflows": [
    {
      "name": "billing-workflow",
      "binding": "BILLING",
      "class_name": "BillingWorkflow",
      "script_name": "billing-worker"
    }
  ]
}
```

## Triggering Workflows

### From a Worker (HTTP Handler)

```typescript
export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    // Get existing instance by ID
    const instanceId = new URL(req.url).searchParams.get('instanceId');
    if (instanceId) {
      const instance = await env.MY_WORKFLOW.get(instanceId);
      return Response.json({ status: await instance.status() });
    }

    // Create new instance
    const instance = await env.MY_WORKFLOW.create({
      id: crypto.randomUUID(), // Optional custom ID
      params: { email: 'user@example.com' },
    });

    return Response.json({
      id: instance.id,
      status: await instance.status(),
    });
  },
};
```

### Batch Creation

```typescript
const instances = await env.MY_WORKFLOW.createBatch([
  { id: 'user-1', params: { name: 'Alice' } },
  { id: 'user-2', params: { name: 'Bob' } },
  { id: 'user-3', params: { name: 'Charlie' } },
]);
```

### Via Wrangler CLI

```bash
# Trigger with payload
npx wrangler workflows trigger my-workflow '{"email":"user@example.com"}'

# Check instance status
npx wrangler workflows instances describe my-workflow latest
npx wrangler workflows instances describe my-workflow <instance-id>

# List workflows
npx wrangler workflows list
```

## Managing Instances

### Instance Methods

```typescript
const instance = await env.MY_WORKFLOW.get('instance-id');

// Get status
const status = await instance.status();
// Returns: { status: 'running' | 'paused' | 'complete' | 'errored' | ... }

// Control instance
await instance.pause();
await instance.resume();
await instance.terminate();
await instance.restart();

// Send event to waiting instance
await instance.sendEvent({
  type: 'stripe-webhook', // Must match waitForEvent type
  payload: { invoiceId: '123' },
});
```

### Instance Status Values

```typescript
type InstanceStatus = {
  status:
    | 'queued' // Waiting to start
    | 'running' // Actively executing
    | 'paused' // User paused
    | 'errored' // Failed
    | 'terminated' // User terminated
    | 'complete' // Successfully finished
    | 'waiting' // Sleeping or waiting for event
    | 'waitingForPause' // Finishing current work to pause
    | 'unknown';
  error?: string;
  output?: object; // Return value from run()
};
```

## Retry Configuration

### Default Configuration

```typescript
const defaultConfig = {
  retries: {
    limit: 5,
    delay: 10000, // 10 seconds
    backoff: 'exponential',
  },
  timeout: '10 minutes',
};
```

### Custom Configuration

```typescript
await step.do(
  'call api',
  {
    retries: {
      limit: 10, // Max attempts (use Infinity for unlimited)
      delay: '10 seconds', // Or number in ms
      backoff: 'exponential', // 'constant' | 'linear' | 'exponential'
    },
    timeout: '30 minutes',
  },
  async () => {
    /* ... */
  }
);
```

### NonRetryableError

Force immediate failure without retries:

```typescript
import { NonRetryableError } from 'cloudflare:workflows';

await step.do('validate', async () => {
  if (!isValid) {
    throw new NonRetryableError('Invalid input - cannot proceed');
  }
});
```

### Catching Step Errors

```typescript
try {
  await step.do('risky operation', async () => {
    throw new NonRetryableError('failed');
  });
} catch (e) {
  console.log(`Step failed: ${e.message}`);
  await step.do('cleanup', async () => {
    // Cleanup code
  });
}

// Workflow continues execution
await step.do('next task', async () => {
  /* ... */
});
```

## Rules and Best Practices

### 1. Make Steps Idempotent

Steps may retry, so design them to be safely re-executed:

```typescript
// ✅ Good: Check before mutating
await step.do('charge customer', async () => {
  const subscription = await getSubscription(customerId);
  if (subscription.charged) return; // Already done

  await chargeCustomer(customerId);
});
```

### 2. Keep Steps Self-Contained

Don't combine unrelated operations in one step:

```typescript
// ❌ Bad: Multiple unrelated calls
await step.do('do everything', async () => {
  const cat = await env.KV.get('cat');
  return fetch(`https://http.cat/${cat}`);
});

// ✅ Good: Separate steps
const cat = await step.do('get cat from KV', async () => {
  return await env.KV.get('cat');
});

const image = await step.do('fetch cat image', async () => {
  return await fetch(`https://http.cat/${cat}`);
});
```

### 3. Don't Store State Outside Steps

Workflows hibernate between steps - only step returns persist:

```typescript
// ❌ Bad: State lost on hibernation
const imageList: string[] = [];
await step.do('get cat 1', async () => {
  imageList.push(await env.KV.get('cat-1'));
});
await step.sleep('wait', '3 hours');
// imageList is empty here!

// ✅ Good: Build state from step returns
const imageList = await Promise.all([
  step.do('get cat 1', () => env.KV.get('cat-1')),
  step.do('get cat 2', () => env.KV.get('cat-2')),
]);
await step.sleep('wait', '3 hours');
// imageList preserved!
```

### 4. Don't Mutate the Event

Event changes aren't persisted:

```typescript
// ❌ Bad: Mutation lost
await step.do('fetch user', async () => {
  event.payload = await env.KV.get(event.payload.userId);
});

// ✅ Good: Return state from step
const userData = await step.do('fetch user', async () => {
  return await env.KV.get(event.payload.userId);
});
```

### 5. Name Steps Deterministically

Step names act as cache keys:

```typescript
// ❌ Bad: Non-deterministic name
await step.do(`step at: ${Date.now()}`, async () => {
  /* ... */
});

// ✅ Good: Stable names
await step.do('fetch user data', async () => {
  /* ... */
});

// ✅ Good: Dynamic but deterministic (based on step output)
const cats = await step.do('get cat list', () => env.KV.get('cats'));
for (const cat of cats) {
  await step.do(`process cat: ${cat}`, async () => {
    /* ... */
  });
}
```

### 6. Always Await Steps

```typescript
// ❌ Bad: Dangling promise
const issues = step.do('fetch issues', async () => {
  /* ... */
});

// ✅ Good: Properly awaited
const issues = await step.do('fetch issues', async () => {
  /* ... */
});
```

### 7. No Side Effects Outside Steps

Code outside steps may run multiple times:

```typescript
// ❌ Bad: May create multiple instances
const instance = await this.env.OTHER_WORKFLOW.create();

// ❌ Bad: Non-deterministic outside step
const random = Math.random();

// ✅ Good: Wrap in steps
const instance = await step.do('create workflow', async () => {
  return await this.env.OTHER_WORKFLOW.create();
});

const random = await step.do('generate random', async () => {
  return Math.random();
});

// ✅ OK: No side effects (creating connection object)
const db = createDBConnection(this.env.DB_URL);
```

### 8. Use Unique Instance IDs

```typescript
// ❌ Bad: Reusing user ID (won't work for multiple runs)
await env.MY_WORKFLOW.create({ id: userId });

// ✅ Good: Composite or unique ID
const instanceId = `${userId}-${crypto.randomUUID().slice(0, 6)}`;
await env.MY_WORKFLOW.create({ id: instanceId });

// Or use transaction/order IDs that are naturally unique
await env.MY_WORKFLOW.create({ id: transactionId });
```

### 9. Wrap Promise.race in a Step

```typescript
// ❌ Bad: Race result may vary across restarts
const result = await Promise.race([
  step.do('fast', async () => 'fast'),
  step.do('slow', async () => 'slow'),
]);

// ✅ Good: Wrap in step for consistent caching
const result = await step.do('race step', async () => {
  return await Promise.race([
    step.do('fast', async () => 'fast'),
    step.do('slow', async () => 'slow'),
  ]);
});
```

### 10. Use createBatch for Multiple Instances

```typescript
// ❌ Bad: Individual creates hit rate limits
for (const user of users) {
  await env.MY_WORKFLOW.create({ id: user.id, params: user });
}

// ✅ Good: Batch creation
await env.MY_WORKFLOW.createBatch(
  users.map((user) => ({ id: user.id, params: user }))
);
```

## Complete Example

```typescript
import {
  WorkflowEntrypoint,
  WorkflowStep,
  WorkflowEvent,
} from 'cloudflare:workers';
import { NonRetryableError } from 'cloudflare:workflows';

type Env = {
  MY_WORKFLOW: Workflow;
  KV: KVNamespace;
};

type OrderParams = {
  orderId: string;
  userId: string;
  amount: number;
};

export class OrderWorkflow extends WorkflowEntrypoint<Env, OrderParams> {
  async run(event: WorkflowEvent<OrderParams>, step: WorkflowStep) {
    const { orderId, userId, amount } = event.payload;

    // Step 1: Validate order
    const user = await step.do('validate user', async () => {
      const userData = await this.env.KV.get(`user:${userId}`, 'json');
      if (!userData) {
        throw new NonRetryableError('User not found');
      }
      return userData;
    });

    // Step 2: Process payment with retries
    const payment = await step.do(
      'process payment',
      {
        retries: { limit: 3, delay: '10 seconds', backoff: 'exponential' },
        timeout: '5 minutes',
      },
      async () => {
        return await processPayment(userId, amount);
      }
    );

    // Step 3: Wait for webhook confirmation
    const confirmation = await step.waitForEvent<{ status: string }>(
      'await payment confirmation',
      { type: 'payment-webhook', timeout: '1 hour' }
    );

    if (confirmation.payload.status !== 'success') {
      throw new NonRetryableError('Payment failed');
    }

    // Step 4: Send confirmation email
    await step.do('send confirmation', async () => {
      await sendEmail(user.email, `Order ${orderId} confirmed!`);
    });

    // Step 5: Schedule follow-up
    await step.sleep('wait for feedback window', '7 days');

    await step.do('send feedback request', async () => {
      await sendEmail(user.email, 'How was your order?');
    });

    return { orderId, status: 'complete' };
  }
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);

    if (req.method === 'POST' && url.pathname === '/orders') {
      const body = await req.json<OrderParams>();
      const instance = await env.MY_WORKFLOW.create({
        id: body.orderId,
        params: body,
      });
      return Response.json({ instanceId: instance.id });
    }

    if (
      url.pathname.startsWith('/orders/') &&
      url.pathname.endsWith('/status')
    ) {
      const orderId = url.pathname.split('/')[2];
      const instance = await env.MY_WORKFLOW.get(orderId);
      return Response.json(await instance.status());
    }

    if (req.method === 'POST' && url.pathname === '/webhooks/payment') {
      const payload = await req.json();
      const instance = await env.MY_WORKFLOW.get(payload.orderId);
      await instance.sendEvent({
        type: 'payment-webhook',
        payload: { status: payload.status },
      });
      return new Response('OK');
    }

    return new Response('Not Found', { status: 404 });
  },
};
```

## Deployment

```bash
# Deploy your workflow
npx wrangler deploy

# Verify deployment
npx wrangler workflows list
```

## Key Limitations

- Instance IDs must be unique (up to 100 characters, pattern: `^[a-zA-Z0-9_][a-zA-Z0-9-_]*$`)
- Step return values must be JSON-serializable (no Functions, Symbols, or circular refs)
- `step.sleep` calls don't count toward step limits
- Only `running` instances count toward concurrency limits
- State is lost on hibernation - only step returns persist

## References

- [Get Started Guide](https://developers.cloudflare.com/workflows/get-started/guide/)
- [Workers API](https://developers.cloudflare.com/workflows/build/workers-api/)
- [Trigger Workflows](https://developers.cloudflare.com/workflows/build/trigger-workflows/)
- [Events and Parameters](https://developers.cloudflare.com/workflows/build/events-and-parameters/)
- [Sleeping and Retrying](https://developers.cloudflare.com/workflows/build/sleeping-and-retrying/)
- [Rules of Workflows](https://developers.cloudflare.com/workflows/build/rules-of-workflows/)
- [Limits](https://developers.cloudflare.com/workflows/reference/limits/)
