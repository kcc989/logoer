# React Query Mutation Helpers - Design

**Date:** 2025-11-23
**Status:** Approved

## Overview

Extend `react-query-utils.ts` to support full CRUD operations (Create, Read, Update, Delete) with React Query mutation helpers. Currently only GET operations are supported via `fetchWithSchema` and query helpers.

## Goals

- Provide type-safe mutation helpers for POST, PUT, PATCH, DELETE operations
- Validate both request bodies and responses using Zod schemas
- Support URL path parameters and query parameters
- Maintain consistency with existing `fetchWithSchema` and query function patterns
- Minimize API surface area using TypeScript inference

## Design Decisions

### 1. Validation Strategy
**Chosen:** Validate both request and response bodies

- Request validation catches invalid data before sending to server
- Response validation ensures type safety and API contract adherence
- Consistent with existing `fetchWithSchema` pattern
- Early error detection improves developer experience

### 2. API Design
**Chosen:** Single unified `createMutationFn` with method parameter

Rather than separate functions per HTTP method (`createPostFn`, `createPutFn`, etc.), use one function with a `method` option. TypeScript conditional types handle different cases automatically.

**Benefits:**
- Fewer functions to maintain
- More flexible (supports custom methods if needed)
- Clearer parameter requirements based on context
- Easier to extend with new options

### 3. Parameter Handling
**Chosen:** URL can be string or function, TypeScript infers return type

- Static URL string for simple cases: `/api/lists`
- URL function for path params: `(id: string) => `/api/lists/${id}``
- Return type automatically curries based on URL type
- Query params can be added to either URL type

## Implementation

### Core Mutation Function

```typescript
interface MutationOptions<TRequest, TResponse> {
  url: string;
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  requestSchema?: z.ZodType<TRequest>;
  responseSchema: z.ZodType<TResponse>;
  body?: TRequest;
}

async function fetchWithMutation<TRequest, TResponse>(
  options: MutationOptions<TRequest, TResponse>
): Promise<TResponse> {
  // 1. Validate request body if schema provided
  // 2. Send request with proper headers (Content-Type: application/json)
  // 3. Handle errors using existing parseErrorResponse
  // 4. Validate response using responseSchema
  // 5. Return typed response
}
```

### Mutation Helper

```typescript
interface CreateMutationOptions<TRequest, TResponse, TParams extends any[]> {
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  url: string | ((...params: TParams) => string);
  requestSchema?: z.ZodType<TRequest>;
  responseSchema: z.ZodType<TResponse>;
}

function createMutationFn<TRequest, TResponse, TParams extends any[] = []>(
  options: CreateMutationOptions<TRequest, TResponse, TParams>
) {
  // Return function signature depends on URL type:
  // - String URL: (body: TRequest) => Promise<TResponse>
  // - Function URL: (...params: TParams) => (body: TRequest) => Promise<TResponse>
}
```

### Usage Examples

```typescript
// Simple POST - no path params
const createList = createMutationFn({
  method: 'POST',
  url: '/api/lists',
  requestSchema: createListSchema,
  responseSchema: listSchema
});

const mutation = useMutation({
  mutationFn: createList
});
mutation.mutate({ name: 'My List' });

// PUT with path param
const updateList = createMutationFn({
  method: 'PUT',
  url: (id: string) => `/api/lists/${id}`,
  requestSchema: updateListSchema,
  responseSchema: listSchema
});

const mutation = useMutation({
  mutationFn: updateList('list-123')
});
mutation.mutate({ name: 'Updated Name' });

// DELETE with no request body
const deleteList = createMutationFn({
  method: 'DELETE',
  url: (id: string) => `/api/lists/${id}`,
  responseSchema: z.void()
});

const mutation = useMutation({
  mutationFn: deleteList('list-123')
});
mutation.mutate();

// POST with query params
const createList = createMutationFn({
  method: 'POST',
  url: '/api/lists?notify=true',
  requestSchema: createListSchema,
  responseSchema: listSchema
});
```

## Error Handling

### Request Validation Errors
- Throw `ValidationError` with Zod issues
- Caught before network request
- Provides detailed field-level errors

### Response Validation Errors
- Throw `ValidationError` with Zod issues and received data
- Indicates API contract violation
- Helps debug server-side issues

### HTTP Errors
- Reuse existing `parseErrorResponse` function
- Convert to appropriate `AppError` types
- Consistent error handling across queries and mutations

### Edge Cases
- DELETE operations: `requestSchema` optional, often use `z.void()` for response
- Empty responses: Use `z.void()` or `z.object({}).strict()`
- No request body: Omit `requestSchema` or use `z.void()`

## Migration Path

### Existing Code
No breaking changes. Existing query helpers (`createQueryFn`, `createQueryFnWithParams`) remain unchanged.

### New Code
Use `createMutationFn` for all POST, PUT, PATCH, DELETE operations:

```typescript
// Before (manual fetch)
const createList = async (data: CreateListInput) => {
  const response = await fetch('/api/lists', {
    method: 'POST',
    body: JSON.stringify(data),
    headers: { 'Content-Type': 'application/json' }
  });
  return response.json();
};

// After (with helper)
const createList = createMutationFn({
  method: 'POST',
  url: '/api/lists',
  requestSchema: createListSchema,
  responseSchema: listSchema
});
```

## Implementation Checklist

- [ ] Add `fetchWithMutation` core function
- [ ] Add `createMutationFn` with proper TypeScript overloads
- [ ] Update exports from `react-query-utils.ts`
- [ ] Test with existing mutations in `queries/lists.ts` and `queries/tasks.ts`
- [ ] Update any existing manual mutations to use new helpers
