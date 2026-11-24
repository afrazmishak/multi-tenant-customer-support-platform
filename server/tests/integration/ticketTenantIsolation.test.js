import test from "node:test";
import assert from "node:assert/strict";

import app from "../../src/app.js";

import {
    initializeModels,
} from "../../src/models/index.js";

import Customer from "../../src/models/Customer.js";
import Ticket from "../../src/models/Ticket.js";

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

test("ticket IDs cannot bypass workspace isolation", async () => {
    const previousJwtSecret = process.env.JWT_SECRET;

    process.env.JWT_SECRET = "isolated-ticket-integration-test-secret-2026";

    try {
        await withIsolatedDatabase(async () => {
            await initializeModels();

            await Promise.all([
                Customer.init(),
                Ticket.init(),
            ]);

            const password = "TestPassword123";

            // Two independent users.
            const userA = await createTestUser({
                name: "Workspace A Owner",
                email: "ticket-owner-a@test.example",
                password,
            });

            const userB = await createTestUser({
                name: "Workspace B Owner",
                email: "ticket-owner-b@test.example",
                password,
            });

            // Two independent workspaces.
            const workspaceA = await createTestWorkspace({
                name: "Ticket Isolation A",
                slug: "ticket-isolation-a",
                createdBy: userA._id,
            });

            const workspaceB = await createTestWorkspace({
                name: "Ticket Isolation B",
                slug: "ticket-isolation-b",
                createdBy: userB._id,
            });

            await createTestMembership({
                tenantId: workspaceA._id,
                userId: userA._id,
                role: MEMBERSHIP_ROLES.OWNER,
            });

            await createTestMembership({
                tenantId: workspaceB._id,
                userId
            })
        });
    }
})