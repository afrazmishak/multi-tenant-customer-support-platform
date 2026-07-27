# Multi-Tenant Customer Support Platform

A MERN-based customer support platform designed to support multiple organizations while isolating tenant data and permissions.

## Phase 1 Foundation

Phase 1 provides:

- MongoDB Atlas and Mongoose integration
- Global user accounts
- Multi-tenant workspaces
- User-to-workspace memberships
- Owner, admin, and agent roles
- Atomic workspace registration
- Password hashing with bcrypt
- JWT authentication using HTTP-only cookies
- Login, logout, and session restoration
- Tenant-context verification
- Role-based authorization
- Cross-tenant access protection
- React authentication context
- Protected frontend routes
- Security headers and authentication rate limiting

## Architecture

A user may belong to multiple workspaces through membership records:

```text
User
  ├── Membership → Workspace A → owner
  └── Membership → Workspace B → agent