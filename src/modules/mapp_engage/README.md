# Mapp Engage Module

Centralized module for Mapp Engage email marketing platform integration.

## Overview

This module provides a complete, self-contained solution for interacting with the Mapp Engage API, including:

- **Contact Management** - Create and manage contacts
- **User Details** - Retrieve user information
- **Group Subscriptions** - Subscribe users to groups
- **Messaging** - Send single messages or automated campaigns
- **Combined Operations** - Create users and send messages in one operation

## Module Structure

```
mapp_engage/
├── config/              # Configuration and environment setup
│   └── index.ts        # Environment variables, headers, validation
├── types/              # TypeScript type definitions
│   └── index.ts        # Request/response interfaces
├── services/           # Core service layer
│   ├── api.ts         # API client functions
│   └── actions.ts     # Server actions
├── hooks/             # React hooks
│   └── useMappEngage.ts  # Client-side hook with transitions
├── utils/             # Utility functions
│   └── validation.ts  # Access validation and data validation
└── index.ts           # Main export file
```

## Usage

### Client Components

Use the `useMappEngage` hook for client-side operations with loading states and toast notifications:

```tsx
'use client';

import { useMappEngage } from '@/modules/mapp_engage';

function MyComponent() {
  const { createContact, isPending } = useMappEngage();
  
  const handleCreate = async () => {
    try {
      await createContact({
        email: 'user@example.com',
        firstname: 'John',
        lastname: 'Doe',
        phone: '+1234567890' // optional
      });
    } catch (error) {
      // Error handling is automatic via toast notifications
    }
  };
  
  return (
    <button onClick={handleCreate} disabled={isPending}>
      {isPending ? 'Creating...' : 'Create Contact'}
    </button>
  );
}
```

### Server Components & Actions

Import and use server actions directly:

```tsx
import { createMappEngageContact } from '@/modules/mapp_engage';

export default async function ServerComponent() {
  const result = await createMappEngageContact({
    email: 'user@example.com',
    firstname: 'John',
    lastname: 'Doe'
  });
  
  if (result.success) {
    // Handle success
  }
}
```

### API Methods Available

#### Hook Methods (Client-Side)

```typescript
const {
  createContact,           // Create a new contact
  getUserDetails,         // Get user by email
  subscribeToGroup,       // Add user to a group
  sendMessage,            // Send a single message
  createUserAndSendMessage, // Combined operation
  isPending               // Loading state
} = useMappEngage();
```

#### Server Actions

```typescript
import {
  createMappEngageContact,
  getMappEngageUserDetails,
  subscribeMappEngageUserToGroup,
  sendMappEngageSingleMessage,
  createUserAndSendMappEngageMessage
} from '@/modules/mapp_engage';
```

## API Examples

### Create Contact

```typescript
await createContact({
  email: 'user@example.com',
  firstname: 'John',
  lastname: 'Doe',
  phone: '+1234567890' // optional
});
```

### Get User Details

```typescript
const user = await getUserDetails('user@example.com');
```

### Subscribe to Group

```typescript
await subscribeToGroup({
  userId: 'user@example.com',
  groupId: 'group-123'
});
```

### Send Message

```typescript
await sendMessage({
  recipientId: 'user@example.com',
  messageId: 'message-456',
  parameters: {
    firstName: 'John',
    url: 'https://example.com',
    comment: 'Welcome!'
  }
});
```

### Create User and Send Message (Combined)

```typescript
await createUserAndSendMessage({
  email: 'user@example.com',
  firstName: 'John',
  lastName: 'Doe',
  groupId: 'group-123',
  messageId: 'message-456',
  messageParameters: {
    firstName: 'John',
    url: 'https://example.com',
    comment: 'Welcome!'
  }
});
```

## Configuration

The module requires the following environment variables:

```env
ENGAGE_BASE_URL=https://api.mapp.com
ENGAGE_AUTH_TOKEN=your-auth-token

# Optional - for specific use cases
NEXT_PUBLIC_ENGAGE_GROUP_ID=default-group-id
NEXT_PUBLIC_ENGAGE_MESSAGE_ID=default-message-id
```

Access configuration programmatically:

```typescript
import { mappEngageConfig, isMappEngageConfigured } from '@/modules/mapp_engage';

if (isMappEngageConfigured()) {
  // Configuration is valid
}
```

## Authentication & Security

### Access Control

All server actions automatically validate user authentication:
- Admins have full access
- Customers have limited access based on their account
- Unauthenticated users are rejected

### Bypass Authentication

For special cases (e.g., magic link generation), you can bypass authentication:

```typescript
await createUserAndSendMappEngageMessage(userData, true); // bypassAuth = true
```

⚠️ **Warning**: Use bypass authentication sparingly and only in secure server-side contexts.

### Data Validation

The module includes built-in validation:
- Email format validation
- Required field checks
- Type safety via TypeScript

## Error Handling

### Automatic Error Handling (Hook)

The `useMappEngage` hook automatically handles errors with toast notifications:

```typescript
const { createContact } = useMappEngage();

// Errors are automatically shown as toast notifications
await createContact(data);
```

### Manual Error Handling (Server Actions)

Server actions return a response object:

```typescript
const result = await createMappEngageContact(data);

if (result.success) {
  logger.log(result.data);
  logger.log(result.message);
} else {
  logger.error(result.error);
}
```

## Type Safety

All types are exported from the module:

```typescript
import type {
  CreateContactRequest,
  AddToGroupRequest,
  SendMessageRequest,
  CreateUserAndSendMessageRequest,
  UserDetailsResponse,
  ApiResponse,
  MappEngageConfig
} from '@/modules/mapp_engage';
```

## Best Practices

1. **Use the hook in client components** for automatic loading states and error handling
2. **Use server actions directly** in server components for better performance
3. **Always handle errors** when using server actions directly
4. **Validate data** before sending to API (module includes validation helpers)
5. **Use TypeScript types** for better type safety and IDE support
6. **Leverage combined operations** when performing multiple steps (e.g., `createUserAndSendMessage`)

## Related Documentation

- [Mapp Engage API Documentation](https://docs.mapp.com/)
- [NextAuth Configuration](/src/modules/auth/)
- [Toast Provider](/src/components/providers/ToastProvider.tsx)
