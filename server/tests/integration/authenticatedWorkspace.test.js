
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
                await Membership.create({
                    tenantId: workspaceA._id,
                    userId: user._id,
                    role: MEMBERSHIP_ROLES.OWNER,
                });

                // Preserve authentication cookies.
                const agent = request.agent(app);

                const loginResponse = await agent
                    .post("/api/auth/login")
                    .send({
                        email: "owner@test.example",
                        password,
                    });

                assert.equal(
                    loginResponse.status,
                    200,
                    JSON.stringify(loginResponse.body)
                );

                assert.equal(
                    loginResponse.body.success,
                    true
                );

                // Confirm that login issued a cookie.
                const cookies =
                    loginResponse.headers["set-cookie"];

                assert.ok(
                    cookies && cookies.length > 0,
                    "Login must issue an authentication cookie"
                );

                // Confirm access to Workspace A.
                const ownWorkspaceResponse = await agent
                    .get(
                        `/api/workspaces/${workspaceA.slug}/context`
                    );

                assert.equal(
                    ownWorkspaceResponse.status,
                    200,
                    JSON.stringify(ownWorkspaceResponse.body)
                );

                // Confirm denial for Workspace B.
                const foreignWorkspaceResponse = await agent
                    .get(
                        `/api/workspaces/${workspaceB.slug}/context`
                    );

                assert.equal(
                    foreignWorkspaceResponse.status,
                    403,
                    JSON.stringify(foreignWorkspaceResponse.body)
                );

                assert.equal(
                    foreignWorkspaceResponse.body.success,
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
