import assert from "node:assert/strict";
import request from "supertest";

import {
    User,
    Tenant,
    Membership,
} from "../../src/models/index.js";

import {
    MEMBERSHIP_ROLES,
} from "../../src/constants/membership.constants.js";

import {
    hashPassword,
} from "../../src/utils/password.js";

export async function createTestUser({
    name,
    email,
    password,
}) {
    assert.ok(name);
    assert.ok(email);
    assert.ok(password);

    return User.create({
        name,
        email,
        passwordHash: await hashPassword(password),
    });
}

export async function createTestWorkspace({
    name,
    slug,
    createdBy,
}) {
    return Tenant.create({
        name,
        slug,
        createdBy,
    });
}

export async function createTestMembership({
    tenantId,
    userId,
    role = MEMBERSHIP_ROLES.AGENT,
}) {
    return Membership.create({
        tenantId,
        userId,
        role,
    });
}

export async function createAuthenticatedAgent({
    app,
    email,
    password,
}) {
    const agent = request.agent(app);

    const response = await agent
        .post("/api/auth/login")
        .send({
            email,
            password,
        });

    assert.equal(
        response.status,
        200,
        JSON.stringify(response.body)
    );

    assert.equal(response.body.success, true);

    assert.ok(
        response.headers["set-cookie"]?.length > 0,
        "Login must issue an authentication cookie"
    );

    return agent;
}