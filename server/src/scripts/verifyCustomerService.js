import assert from "node:assert/strict";
import "dotenv/config";
import mongoose from "mongoose";

import Customer from "../models/Customer.js";

import {
    archiveCustomer,
    createCustomer,
    getCustomerById,
    listCustomers,
    restoreCustomer,
    updateCustomer,
} from "../services/customer.service.js";

const workspaceAId = new mongoose.Types.ObjectId();
const workspaceBId = new mongoose.Types.ObjectId();
const actorUserId = new mongoose.Types.ObjectId();

const testRunId = new mongoose.Types.ObjectId()
    .toString()
    .slice(-8);

const originalEmail =
    `customer-${testRunId}@example.com`;

const updatedEmail =
    `updated-customer-${testRunId}@example.com`;

const secondaryEmail =
    `secondary-customer-${testRunId}@example.com`;

function printPassed(message) {
    console.log(`✓ ${message}`);
}

function getErrorStatusCode(error) {
    return error?.statusCode ?? error?.status;
}

async function expectServiceError(
    operation,
    expectedStatusCode,
    expectedMessagePattern
) {
    let receivedError = null;

    try {
        await operation();
    } catch (error) {
        receivedError = error;
    }

    assert.ok(
        receivedError,
        `Expected operation to fail with status ${expectedStatusCode}`
    );

    assert.equal(
        getErrorStatusCode(receivedError),
        expectedStatusCode,
        `Expected status ${expectedStatusCode}, received ${getErrorStatusCode(receivedError) ?? "undefined"
        }`
    );

    if (expectedMessagePattern) {
        assert.match(
            receivedError.message,
            expectedMessagePattern
        );
    }

    return receivedError;
}

async function connectToDatabase() {
    const databaseUri =
        process.env.MONGODB_URI ??
        process.env.MONGO_URI;

    assert.ok(
        databaseUri,
        "MONGODB_URI or MONGO_URI is missing from the environment"
    );

    await mongoose.connect(databaseUri, {
        serverSelectionTimeoutMS: 10_000,
    });

    /*
     * Creates missing indexes without dropping unrelated indexes.
     * This ensures the tenant-scoped unique email index exists.
     */
    await Customer.createIndexes();

    console.log("MongoDB connected");
}

async function cleanTestCustomers() {
    if (mongoose.connection.readyState !== 1) {
        return;
    }

    await Customer.deleteMany({
        workspace: {
            $in: [workspaceAId, workspaceBId],
        },
    });
}

async function verifyCustomerService() {
    console.log(
        "\nVerifying Customer service integration...\n"
    );

    await connectToDatabase();

    /*
     * Defensive cleanup in case this exact script execution was
     * interrupted after records were created.
     */
    await cleanTestCustomers();

    console.log("1. Testing customer creation");

    const customerA = await createCustomer({
        workspaceId: workspaceAId,
        actorUserId,
        input: {
            name: "  Integration Customer Alpha  ",
            email: `  ${originalEmail.toUpperCase()}  `,
            phone: "  +971 50 123 4567  ",
            company: "  Alynt Technologies  ",
            jobTitle: "  Software Engineer  ",
            tags: [
                "VIP",
                "vip",
                " Priority ",
                "",
            ],
            notes: "  Integration test customer  ",
            customFields: {
                preferredLanguage: "English",
                accountTier: "premium",
            },
        },
    });

    assert.ok(customerA._id);

    assert.equal(
        customerA.workspace.toString(),
        workspaceAId.toString()
    );

    assert.equal(
        customerA.name,
        "Integration Customer Alpha"
    );

    assert.equal(customerA.email, originalEmail);

    assert.deepEqual(customerA.tags, [
        "vip",
        "priority",
    ]);

    assert.equal(customerA.status, "active");
    assert.equal(customerA.isArchived, false);

    printPassed(
        "Customer was created and normalized correctly"
    );

    console.log(
        "\n2. Testing duplicate email protection"
    );

    await expectServiceError(
        () =>
            createCustomer({
                workspaceId: workspaceAId,
                actorUserId,
                input: {
                    name: "Duplicate Customer",
                    email: originalEmail,
                },
            }),
        409,
        /already exists/i
    );

    printPassed(
        "Duplicate active email was rejected inside the same workspace"
    );

    console.log(
        "\n3. Testing cross-workspace email isolation"
    );

    const customerB = await createCustomer({
        workspaceId: workspaceBId,
        actorUserId,
        input: {
            name: "Workspace B Customer",
            email: originalEmail,
            tags: ["workspace-b"],
        },
    });

    assert.equal(customerB.email, originalEmail);

    assert.equal(
        customerB.workspace.toString(),
        workspaceBId.toString()
    );

    printPassed(
        "The same email was accepted in a different workspace"
    );

    console.log(
        "\n4. Creating a second Workspace A customer"
    );

    const secondaryCustomer = await createCustomer({
        workspaceId: workspaceAId,
        actorUserId,
        input: {
            name: "Integration Customer Beta",
            email: secondaryEmail,
            company: "Acme Corporation",
            tags: ["standard"],
        },
    });

    assert.ok(secondaryCustomer._id);

    printPassed(
        "Second Workspace A customer was created"
    );

    console.log(
        "\n5. Testing customer listing and pagination"
    );

    const firstPage = await listCustomers({
        workspaceId: workspaceAId,
        query: {
            page: "1",
            limit: "1",
            sortBy: "name",
            sortOrder: "asc",
        },
    });

    assert.equal(firstPage.customers.length, 1);

    assert.equal(
        firstPage.pagination.totalCustomers,
        2
    );

    assert.equal(firstPage.pagination.totalPages, 2);
    assert.equal(firstPage.pagination.page, 1);
    assert.equal(firstPage.pagination.hasNextPage, true);
    assert.equal(
        firstPage.pagination.hasPreviousPage,
        false
    );

    for (const customer of firstPage.customers) {
        assert.equal(
            customer.workspace.toString(),
            workspaceAId.toString()
        );
    }

    printPassed(
        "Customer pagination returned the correct metadata"
    );

    console.log(
        "\n6. Testing customer tag filtering"
    );

    const taggedCustomers = await listCustomers({
        workspaceId: workspaceAId,
        query: {
            tags: "vip",
        },
    });

    assert.equal(taggedCustomers.customers.length, 1);

    assert.equal(
        taggedCustomers.customers[0]._id.toString(),
        customerA._id.toString()
    );

    printPassed("Tag filtering works");

    console.log(
        "\n7. Testing customer search"
    );

    const searchResults = await listCustomers({
        workspaceId: workspaceAId,
        query: {
            search: "alynt",
        },
    });

    assert.equal(searchResults.customers.length, 1);

    assert.equal(
        searchResults.customers[0]._id.toString(),
        customerA._id.toString()
    );

    printPassed(
        "Case-insensitive literal search works"
    );

    console.log(
        "\n8. Testing customer retrieval"
    );

    const retrievedCustomer = await getCustomerById({
        workspaceId: workspaceAId,
        customerId: customerA._id,
    });

    assert.equal(
        retrievedCustomer._id.toString(),
        customerA._id.toString()
    );

    printPassed(
        "Customer was retrieved from the correct workspace"
    );

    console.log(
        "\n9. Testing cross-tenant customer protection"
    );

    await expectServiceError(
        () =>
            getCustomerById({
                workspaceId: workspaceBId,
                customerId: customerA._id,
            }),
        404,
        /not found/i
    );

    printPassed(
        "Workspace B cannot retrieve Workspace A's customer"
    );

    console.log(
        "\n10. Testing customer update"
    );

    const updatedCustomer = await updateCustomer({
        workspaceId: workspaceAId,
        customerId: customerA._id,
        actorUserId,
        input: {
            name: "Integration Customer Alpha Updated",
            email: updatedEmail.toUpperCase(),
            tags: [
                "Premium",
                "priority",
                "premium",
            ],
            notes: "Updated through integration test",
        },
    });

    assert.equal(
        updatedCustomer.name,
        "Integration Customer Alpha Updated"
    );

    assert.equal(updatedCustomer.email, updatedEmail);

    assert.deepEqual(updatedCustomer.tags, [
        "premium",
        "priority",
    ]);

    assert.equal(
        updatedCustomer.updatedBy.toString(),
        actorUserId.toString()
    );

    printPassed(
        "Customer fields were updated and normalized"
    );

    console.log(
        "\n11. Testing customer archive"
    );

    const archivedCustomer = await archiveCustomer({
        workspaceId: workspaceAId,
        customerId: customerA._id,
        actorUserId,
    });

    assert.equal(archivedCustomer.isArchived, true);
    assert.ok(archivedCustomer.archivedAt);

    assert.equal(
        archivedCustomer.archivedBy.toString(),
        actorUserId.toString()
    );

    printPassed("Customer was archived");

    console.log(
        "\n12. Testing archived customer visibility"
    );

    await expectServiceError(
        () =>
            getCustomerById({
                workspaceId: workspaceAId,
                customerId: customerA._id,
            }),
        404,
        /not found/i
    );

    const archivedDetail = await getCustomerById({
        workspaceId: workspaceAId,
        customerId: customerA._id,
        includeArchived: true,
    });

    assert.equal(archivedDetail.isArchived, true);

    const activeCustomers = await listCustomers({
        workspaceId: workspaceAId,
    });

    assert.equal(
        activeCustomers.pagination.totalCustomers,
        1
    );

    const archivedCustomers = await listCustomers({
        workspaceId: workspaceAId,
        query: {
            isArchived: "true",
        },
    });

    assert.equal(
        archivedCustomers.pagination.totalCustomers,
        1
    );

    assert.equal(
        archivedCustomers.customers[0]._id.toString(),
        customerA._id.toString()
    );

    printPassed(
        "Archived customers are excluded by default and can be requested explicitly"
    );

    console.log(
        "\n13. Testing archived email reuse"
    );

    const replacementCustomer = await createCustomer({
        workspaceId: workspaceAId,
        actorUserId,
        input: {
            name: "Replacement Customer",
            email: updatedEmail,
            tags: ["replacement"],
        },
    });

    assert.equal(
        replacementCustomer.email,
        updatedEmail
    );

    printPassed(
        "An archived customer's email can be reused"
    );

    console.log(
        "\n14. Testing restore email conflict"
    );

    await expectServiceError(
        () =>
            restoreCustomer({
                workspaceId: workspaceAId,
                customerId: customerA._id,
                actorUserId,
            }),
        409,
        /already exists/i
    );

    printPassed(
        "Restore was blocked while another active customer used the email"
    );

    console.log(
        "\n15. Testing updates against archived customers"
    );

    await archiveCustomer({
        workspaceId: workspaceAId,
        customerId: replacementCustomer._id,
        actorUserId,
    });

    await expectServiceError(
        () =>
            updateCustomer({
                workspaceId: workspaceAId,
                customerId: replacementCustomer._id,
                actorUserId,
                input: {
                    name: "Illegal Archived Update",
                },
            }),
        409,
        /restore/i
    );

    printPassed(
        "Archived customer updates were rejected"
    );

    console.log(
        "\n16. Testing successful restoration"
    );

    const restoredCustomer = await restoreCustomer({
        workspaceId: workspaceAId,
        customerId: customerA._id,
        actorUserId,
    });

    assert.equal(restoredCustomer.isArchived, false);
    assert.equal(restoredCustomer.archivedAt, null);
    assert.equal(restoredCustomer.archivedBy, null);

    printPassed(
        "Customer was restored after the email conflict was removed"
    );

    console.log(
        "\n17. Testing repeated restoration protection"
    );

    await expectServiceError(
        () =>
            restoreCustomer({
                workspaceId: workspaceAId,
                customerId: customerA._id,
                actorUserId,
            }),
        409,
        /not archived/i
    );

    printPassed(
        "Restoring an active customer was rejected"
    );

    console.log(
        "\nCustomer service integration verification completed successfully."
    );
}

verifyCustomerService()
    .catch((error) => {
        console.error(
            "\nCustomer service integration verification failed:"
        );

        console.error(error);

        process.exitCode = 1;
    })
    .finally(async () => {
        try {
            await cleanTestCustomers();

            console.log(
                "\nTemporary customer records cleaned up"
            );
        } catch (cleanupError) {
            console.error(
                "\nFailed to clean temporary customer records:"
            );

            console.error(cleanupError);

            process.exitCode = 1;
        } finally {
            await mongoose.disconnect();
        }
    });