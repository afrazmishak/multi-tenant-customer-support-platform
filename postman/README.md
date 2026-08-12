# Postman API Testing

This directory contains the Postman collection and environment template
used to test the Multi-Tenant Customer Support Platform API.

## Coverage

The collection includes tests for:

- Workspace registration
- Authentication and session verification
- Workspace tenant context
- Customer creation
- Ticket creation and updates
- Ticket assignment and unassignment
- Ticket lifecycle transitions
- Public replies
- Internal notes
- Message editing
- Ticket activity audit timeline
- Timeline filtering
- Sorting
- Pagination
- Validation failures
- Closed-ticket protections
- Authentication failures
- Cross-workspace tenant isolation

## Setup

1. Import the collection into Postman.
2. Import the local environment template.
3. Set `baseUrl` to:

   `http://localhost:5000`

4. Start the backend server.
5. Run the registration request first.
6. Continue through the requests in numerical order.

## Security

The committed environment is a template only.

Passwords, authentication cookies, tokens, database connection strings,
API keys, and other secrets must not be committed.