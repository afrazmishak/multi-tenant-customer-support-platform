import mongoose from "mongoose";

import Customer from "../models/Customer.js";

const workspaceId = new mongoose.Types.ObjectId();
const userId = new mongoose.Types.ObjectId();

async function verifyCustomerModel() {
    console.log("\nVerifying Customer model...\n");

    const customer = new Customer({
        workspace: workspaceId,
        name: "  John Doe  ",
        email: "  JOHN.DOE@EXAMPLE.COM  ",
        phone: "  +971 50 123 4567  ",
        company: "  Alynt Technologies  ",
        jobTitle: "  Software Engineer  ",
        tags: ["VIP", "vip", " Support ", ""],
        notes: "  Important customer  ",
        customFields: {
            preferredLanguage: "English",
            accountTier: "premium",
        },
        createdBy: userId,
    });

    await customer.validate();

    console.log("Validation passed");
    console.log({
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
        company: customer.company,
        jobTitle: customer.jobTitle,
        tags: customer.tags,
        notes: customer.notes,
        status: customer.status,
        isArchived: customer.isArchived,
    });

    console.log("\nRegistered indexes:");

    for (const [fields, options] of Customer.schema.indexes()) {
        console.log({
            name: options.name,
            fields,
            unique: options.unique ?? false,
        });
    }

    console.log("\nTesting archive integrity...");

    customer.isArchived = true;
    customer.archivedBy = userId;

    await customer.validate();

    if (!customer.archivedAt) {
        throw new Error(
            "Archive validation failed: archivedAt was not generated"
        );
    }

    console.log("Archive integrity passed");

    customer.isArchived = false;

    await customer.validate();

    if (customer.archivedAt !== null || customer.archivedBy !== null) {
        throw new Error(
            "Archive restoration failed: archive fields were not cleared"
        );
    }

    console.log("Archive restoration integrity passed");

    console.log("\nTesting invalid email...");

    const invalidEmailCustomer = new Customer({
        workspace: workspaceId,
        name: "Invalid Email Customer",
        email: "not-an-email",
        createdBy: userId,
    });

    let invalidEmailRejected = false;

    try {
        await invalidEmailCustomer.validate();
    } catch (error) {
        invalidEmailRejected = true;
        console.log("Invalid email correctly rejected");
    }

    if (!invalidEmailRejected) {
        throw new Error("Invalid email was incorrectly accepted");
    }

    console.log("\nTesting invalid custom field key...");

    const invalidCustomFieldCustomer = new Customer({
        workspace: workspaceId,
        name: "Invalid Custom Field Customer",
        customFields: {
            "profile.name": "John",
        },
        createdBy: userId,
    });

    let invalidCustomFieldRejected = false;

    try {
        await invalidCustomFieldCustomer.validate();
    } catch (error) {
        invalidCustomFieldRejected = true;
        console.log("Invalid custom field key correctly rejected");
    }

    if (!invalidCustomFieldRejected) {
        throw new Error(
            "Invalid custom field key was incorrectly accepted"
        );
    }

    console.log("\nCustomer model verification completed successfully.");
}

verifyCustomerModel()
    .catch((error) => {
        console.error("\nCustomer model verification failed:");
        console.error(error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await mongoose.disconnect();
    });