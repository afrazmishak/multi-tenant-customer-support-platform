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
                userId: userB._id,
                role: MEMBERSHIP_ROLES.OWNER,
            });

            // Create valid customers in each workspace.
            const customerA = await Customer.create({
                workspace: workspaceA._id,
                name: "Customer A",
                email: "customer-a@test.example",
                createdBy: userA._id,
            });

            const customerB = await Customer.create({
                workspace: workspaceB._id,
                name: "Customer B",
                email: "customer-b@test.example",
                createdBy: userB._id,
            });

            // Create real tickets in the isolated database.
            const ticketA = await Ticket.create({
                workspace: workspaceA._id,
                ticketNumber: 1,
                customer: customerA._id,
                subject: "Workspace A Ticket",
                description: "Ticket belonging to Workspace A",
                createdBy: userA._id,
            });

            const ticketB = await Ticket.create({
                workspace: workspaceB._id,
                ticketNumber: 1,
                customer: customerB._id,
                subject: "Workspace B Ticket",
                description: "Ticket belonging to Workspace B",
                createdBy: userB._id,
            });

            const clientA = await createAuthenticatedAgent({
                app,
                email: userA.email,
                password,
            });

            const clientB = await createAuthenticatedAgent({
                app,
                email: userB.email,
                password,
            });

            const baseA =
                `/api/workspaces/${workspaceA.slug}/tickets`;

            const baseB = 
                `/api/workspaces/${workspaceB.slug}/tickets`;

            // Positive controls: each  owner can read their own tickets.
            const ownA = await clientA.get(
                `${baseA}/${ticketA._id}`
            );

            assert.equal(
                ownA.status,
                200,
                JSON.stringify(ownA.body)
            );

            const ownB = await clientB.get(
                `${baseB}/${ticketB._id}`
            );

            assert.equal(
                ownB.status,
                200,
                JSON.stringify(ownB.body)
            );

            // Attack 1: Use Workspace A URL with Workspace B ticket ID.
            const foreignIdResponse = await clientA.get(
                `${baseA}/${ticketB._id}`
            );

            assert.equal(
                foreignIdResponse.status,
                404,
                JSON.stringify(foreignIdResponse.body)
            );

            // Attack 2: Access Workspace B URL without membership.
            const foreignWorkspaceResponse = await clientA.get(
                `${baseB}/${ticketB._id}`
            );

            assert.equal(
                foreignWorkspaceResponse.status,
                403,
                JSON.stringify(foreignWorkspaceResponse.body)
            );

            // Read operations must leave the foreign ticket unchanged.
            const unchangedTicket = await Ticket.findById(
                ticketB._id
            );

            assert.ok(unchangedTicket);

            assert.equal(
                unchangedTicket.subject,
                "Workspace B Ticket"
            );

            assert.equal(
                unchangedTicket.status,
                ticketB.status
            );
        });
    } finally {
        if (previousJwtSecret === undefined) {
            delete process.env.JWT_SECRET;
        } else {
            process.env.JWT_SECRET = previousJwtSecret;
        }
    }
});