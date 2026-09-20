
import mongoose from "mongoose";

import {
    Membership,
    Tenant,
    User,
} from "../models/index.js";

const WORKSPACE_SLUG = "audit-timeline-test";

async function main() {
    const email =
        process.env.TEST_AGENT_EMAIL?.trim().toLowerCase();

    if (!process.env.MONGODB_URI || !email) {
        throw new Error(
            "MONGODB_URI and TEST_AGENT_EMAIL are required"
        );
    }

    await mongoose.connect(process.env.MONGODB_URI);

    const workspace = await Tenant.findOne({
        slug: WORKSPACE_SLUG,
    });

    const user = await User.findOne({
        email,
    });

    if (!workspace) {
        throw new Error("Test workspace not found");
    }

    if (!user) {
        throw new Error(
            "Create the second user account before running this script"
        );
    }

    if (user.status !== "active") {
        throw new Error("Test user is not active");
    }

    const existingMembership =
        await Membership.findOne({
            tenantId: workspace._id,
            userId: user._id,
        });

    if (existingMembership) {
        console.log(
            "Membership already exists:",
            existingMembership.role,
            existingMembership.status
        );
        return;
    }

    const membership = await Membership.create({
        tenantId: workspace._id,
        userId: user._id,
        role: "agent",
        status: "active",
        joinedAt: new Date(),
    });

    console.log("Test agent added successfully");
    console.log("User ID:", user._id.toString());
    console.log("Membership ID:", membership._id.toString());
    console.log("Workspace:", workspace.slug);
}

main()
    .catch((error) => {
        console.error(error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await mongoose.disconnect();
    });
