import assert from "node:assert/strict";

import {
    MEMBERSHIP_ROLES,
} from "../constants/membership.constants.js";

import {
    authorizeRoles,
} from "../middleware/authorizeRoles.middleware.js";
import { resolve } from "node:dns";
import { exec } from "node:child_process";
import { error } from "node:console";

function executeMiddleware(middleware, req) {
    return new Promise((resolve, reject) => {
        middleware(req, {}, (error) => {
            if (error) {
                reject(error);
                return;
            }

            resolve();
        });
    });
}

async function checkAuthorization() {
    const ownerOrAdminOnly = authorizeRoles(
        MEMBERSHIP_ROLES.OWNER,
        MEMBERSHIP_ROLES.ADMIN
    );

    await executeMiddleware(ownerOrAdminOnly, {
        tenantContext: {
            membership: {
                role: MEMBERSHIP_ROLES.OWNER,
            },
        },
    });

    await assert.rejects(
        () =>
            executeMiddleware(ownerOrAdminOnly, {
                tenantContext: {
                    membership: {
                        role: MEMBERSHIP_ROLES.AGENT,
                    },
                },
            }),
            (error) =>
                error.statusCode === 403 &&
            error.code === "INSUFFICIENT_PERMISSIONS"
    );

    console.log("Owner authorization: passed");
    console.log("Agent rejection: passed");
    console.log("Role authorization vreification completed");
}

checkAuthorization().catch((error) => {
    console.error(
        "Role authorization verification failed",
        error
    );

    process.exitCode = 1;
})