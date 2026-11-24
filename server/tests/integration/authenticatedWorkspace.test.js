
import test from "node:test";
import assert from "node:assert/strict";

import app from "../../src/app.js";

import {
    initializeModels,
} from "../../src/models/index.js";

import {
    MEMBERSHIP_ROLES,
} from "../../src/constants/membership.constants.js";


import {
    withIsolatedDatabase,
} from "../helpers/withIsolatedDatabase.js";

import {
    createTestUser,
    createTestWorkspace,
    createTestMembership,
    createAuthenticatedAgent,
} from "../helpers/createTestWorkspace.js";

test(
    "authenticated user can access only their workspace",
    async () => {
        const previousJwtSecret = process.env.JWT_SECRET;

        process.env.JWT_SECRET =
            "isolated-integration-test-secret-2026-only";

        try {
            await withIsolatedDatabase(async () => {
                await initializeModels();

                // Create an isolated test user.
                const password = "TestPassword123!";

                const user = await createTestUser({
                    name: "Integration Test Owner",
                    email: "owner@test.example",
                    password,
                });

                // Create two separate workspaces.
                const workspaceA = await createTestWorkspace({
                    name: "Integration Workspace A",
                    slug: "integration-workspace-a",
                    createdBy: user._id,
                });

                const workspaceB = await createTestWorkspace({
                    name: "Integration Workspace B",
                    slug: "integration-workspace-b",
                    createdBy: user._id,
                });

                // The user belongs ONLY to Workspace A.
                await createTestMembership({
                    tenantId: workspaceA._id,
                    userId: user._id,
                    role: MEMBERSHIP_ROLES.OWNER,
                });

                // Preserve authentication cookies.
                const agent = await createAuthenticatedAgent({
                    app,
                    email: user.email,
                    password,
                });

                const ownResponse = await agent.get(
                    `/api/workspaces/${workspaceA.slug}/context`
                );

                assert.equal(
                    ownResponse.status,
                    200,
                    JSON.stringify(ownResponse.body)
                );

                const foreignResponse = await agent.get(
                    `/api/workspaces/${workspaceB.slug}/context`
                );

                assert.equal(
                    foreignResponse.status,
                    403,
                    JSON.stringify(foreignResponse.body)
                );

                assert.equal(
                    foreignResponse.body.success,
                    false
                );

                // Ticket API tenant isolation tests.
                // Authorized user can access their own ticket queue.
                const ownTicketResponse = await agent.get(
                    `/api/workspaces/${workspaceA.slug}/tickets?view=all`
                );

                assert.equal(
                    ownTicketResponse.status,
                    200,
                    JSON.stringify(ownTicketResponse.body)
                );

                // User must not access another workspace's tickets.
                const foreignTicketsResponse = await agent.get(
                    `/api/workspaces/${workspaceB.slug}/tickets?view=all`
                );

                assert.equal(
                    foreignTicketsResponse.status,
                    403,
                    JSON.stringify(foreignTicketsResponse.body)
                );

                assert.equal(
                    foreignTicketsResponse.body.success,
                    false
                );

                // User must not access another workspace's queue counts.
                const foriegnSummaryResponse = await agent.get(
                    `/api/workspaces/${workspaceB.slug}/tickets/queue-summary`
                );

                assert.equal(
                    foriegnSummaryResponse.status,
                    403,
                    JSON.stringify(foriegnSummaryResponse.body)
                );

                assert.equal(
                    foriegnSummaryResponse.body.success,
                    false
                );
            });
        } finally {
            // Restore the environment for other code.
            if (previousJwtSecret === undefined) {
                delete process.env.JWT_SECRET;
            } else {
                process.env.JWT_SECRET = previousJwtSecret;
            }
        }
    }
);
