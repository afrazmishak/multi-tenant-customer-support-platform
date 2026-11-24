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
    "workspace RBAC restricts membership administrator",
    async () => {
        const previousJwtSecret = process.env.JWT_SECRET;

        process.env.JWT_SECRET =
            "isolated-rbac-integration-test-secret-2026";

        try {
            await withIsolatedDatabase(async () => {
                await initializeModels();

                const password = "TestPassword123";

                // Create three seperate users.
                const owner = await createTestUser({
                    name: "Test Owner",
                    email: "rbac-owner@test.example",
                    password,
                });

                const admin = await createTestUser({
                    name: "Test Admin",
                    email: "rbac-admin@test.example",
                    password,
                });

                const agentUser = await createTestUser({
                    name: "Test Agent",
                    email: "rbac-agent@test.example",
                    password,
                });

                // Create one workspace.
                const workspace = await createTestWorkspace({
                    name: "RBAC Test Workspace",
                    slug: "rbac-test-workspace",
                    createdBy: owner._id,
                });

                // Assign distinct workspace roles.
                await createTestMembership({
                    tenantId: workspace._id,
                    userId: owner._id,
                    role: MEMBERSHIP_ROLES.OWNER,
                });

                await createTestMembership({
                    tenantId: workspace._id,
                    userId: admin._id,
                    role: MEMBERSHIP_ROLES.ADMIN,
                });

                await createTestMembership({
                    tenantId: workspace._id,
                    userId: agentUser._id,
                    role: MEMBERSHIP_ROLES.AGENT,
                });

                // Authenticate through the real login API.
                const ownerClient =
                    await createAuthenticatedAgent({
                        app,
                        email: owner.email,
                        password,
                    });

                const adminClient =
                    await createAuthenticatedAgent({
                        app,
                        email: admin.email,
                        password,
                    });

                const agentClient =
                    await createAuthenticatedAgent({
                        app,
                        email: agentUser.email,
                        password,
                    });

                const membersUrl =
                    `/api/workspaces/${workspace.slug}/members`;

                const directoryUrl =
                    `/api/workspaces/${workspace.slug}/directory`;

                // OWNER can access the members endpoint.
                const ownerResponse =
                    await ownerClient.get(membersUrl);

                assert.equal(
                    ownerResponse.status,
                    200,
                    JSON.stringify(ownerResponse.body)
                );

                // ADMIN can access the members endpoint.
                const adminResponse =
                    await adminClient.get(membersUrl);

                assert.equal(
                    adminResponse.status,
                    200,
                    JSON.stringify(adminResponse.body)
                );

                // AGENT must be denied.
                const agentResponse =
                    await agentClient.get(membersUrl);

                assert.equal(
                    agentResponse.status,
                    403,
                    JSON.stringify(agentResponse.body)
                );

                assert.equal(
                    agentResponse.body.success,
                    false
                );

                // AGENT is permitted to read the directory.
                const directoryResponse =
                    await agentClient.get(directoryUrl);

                assert.equal(
                    directoryResponse.status,
                    200,
                    JSON.stringify(directoryResponse.body)
                );
            });
        } finally {
            // Restore the previous environment.
            if (previousJwtSecret === undefined) {
                delete process.env.JWT_SECRET;
            } else {
                process.env.JWT_SECRET =
                    previousJwtSecret
            }
        }
    }
)