import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";

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
    withIsolatedReplicaSet,
} from "../helpers/withIsolatedReplicaSet.js";

import {
    createTestUser,
    createTestWorkspace,
    createTestMembership,
    createAuthenticatedAgent,
} from "../helpers/createTestWorkspace.js";

test("foreign ticket status mutations are isolated", async () => {
    const previousJwtSecret = process.env.JWT_SECRET;

    process.env.JWT_SECRET =
        "isolated-ticket-mutation-test-secret-2026";

    try {
        await withIsolatedReplicaSet(async () => {
            await initializeModels();

            await Promise.all([
                Customer.init(),
                Ticket.init(),
            ]);

            const password = "TestPassword123";
            
            const userA = await createTestUser({
                name: "Mutation Owner A",
                email: "mutation-a@test.example",
                password,
            });

            const userB = await createTestUser({
                name: "Mutation Owner B",
                email: "mutation-b@test.example",
                password,
            });

            const workspaceA = await createTestWorkspace({
                name: "Mutation Workspace A",
                slug: "mutation-workspace-a",
                createdBy: userA._id,
            });

            const workspaceB = await createTestWorkspace({
                name: "MMutation Workspace B",
                slug: "mutation-workspace-b",
                createdBy: userB._id,
            });

            await createTestMembership({
                tenantId: workspaceA._id,
                userId: userA._id,
                role: MEMBERSHIP_ROLES.OWNER,
            });

            await createTestMembership({
                tenantId: workspaceA._id,
                userId: userB._id,
                role: MEMBERSHIP_ROLES.OWNER,
            });

            const customerA = await Customer.create({
                workspace: workspaceA._id,
                name: "Mutation Customer A",
                createdBy: userA._id,
            });

            const customerB = await Customer.create({
                workspace: workspaceB._id,
                name: "Mutation Customer B",
                createdBy: userB._id,
            });

            const ticketA = await Ticket.create({
                workspace: workspaceA._id,
                ticketNumber: 1,
                customer: customerA._id,
                subject: "Authorized ticket",
                description: "Belongs to Workspace A",
                createdBy: userA._id,
            });

            const ticketB = await Ticket.create({
                workspace: workspaceB._id,
                ticketNumber: 1,
                customer: customerB._id,
                subject: "Protected foreign ticket",
                description: "Belongs to Workspace B",
                createdBy: userB._id,
            });

            const clientA = await createAuthenticatedAgent({
                app,
                email: userA.email,
                password,
            });

            const baseA = `/api/workspaces/${workspaceA.slug}/tickets`;
            const baseB = `/api/workspaces/${workspaceB.slug}/tickets`;

            // Positive control: Owner A can modify Ticket A.
            const authorizedResponse = await clientA
                .patch(`${baseA}/${ticketA._id}/status`)
                .send({ status: "in_progress" });

            assert.equal(
                authorizedResponse.status,
                200,
                JSON.stringify(authorizedResponse.body)
            );

            const updatedOwnTicket = await Ticket.findById(
                ticketA._id
            );

            assert.equal(
                updatedOwnTicket.status,
                "in_progress"
            );

            // Capture foreign ticket state before the attack.
            const foreignBefore = await Ticket.findById(
                ticketB._id
            ).lean();

            assert.ok(foreignBefore);

            // Inspect the real activity model registered by the app.
            const TicketActivity = mongoose.models.TicketActivity;

            assert.ok(
                TicketActivity,
                "TicketActivity model must be registered"
            );

            const activityCountBefore =
                await TicketActivity.countDocuments({});

            // Attack 1: Valid Workspace A URL, foreign ticket ID.
            const crossTenantResponse = await clientA
                .patch(`${baseA}/${ticketB._id}/status`)
                .send({ status: "in_progress" });

            assert.equal(
                crossTenantResponse.status,
                404,
                JOSN.stringify(crossTenantResponse.body)
            );

            // Attack 2: Foreign workspace URL.
            const foreignWorkspaceResponse = await clientA
                .patch(`${baseB}/${ticketB._id}/status`)
                .send({ status: "in_progress" });

            assert.equal(
                foreignWorkspaceResponse.status,
                403,
                JSON.stringify(foreignWorkspaceResponse.body)
            );

            // Verify the foriegn ticket was not mutated.
            const foreignAfter = await Ticket.findById(
                ticketB._id
            ).lean();

            assert.deepEqual(
                foreignAfter,
                foreignBefore,
                "Foreign ticket must remain unchanged"
            );

            // Verify no new activity records were written.
            const activityCountAfter = await TicketActivity.countDocuments({});

            assert.equal(
                activityCountAfter,
                activityCountBefore,
                "Rejected mutations must not create activities"
            );
        });
    } finally {
        if (previousJwtSecret === undefined) {
            delete process.env.JWT_SECRET;
        } else {
            process.env.JWT_SECRET = previousJwtSecret;
        }
    }
})