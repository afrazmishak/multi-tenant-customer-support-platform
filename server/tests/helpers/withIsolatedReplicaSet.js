import assert from "node:assert/strict";
import mongoose from "mongoose";

import {
    MongoMemoryReplSet,
} from "mongodb-memory-server";

export async function withIsolatedReplicaSet(runTest) {
    assert.equal(typeof runTest, "function");

    assert.equal(
        mongoose.connection.readyState,
        0,
        "Mongoose must be disconnected before testing"
    );

    let replSet;

    try {
        // Windows ARM64 needs the x64 MongoDB executable.
        const binaryOptions =
            process.platform === "win32" &&
                process.arch === "arm64"
                ? { arch: "x64" }
                : {};

        replSet = await MongoMemoryReplSet.create({
            binary: binaryOptions,
            replSet: {
                count: 1,
                storageEngine: "wiredTiger",
            },
        });

        const uri = replSet.getUri(
            "customer_support_test"
        );

        const parsedUri = new URL(uri);

        assert.equal(parsedUri.protocol, "mongodb:");
        assert.equal(
            parsedUri.pathname,
            "/customer_support_test"
        );

        assert.equal(
            parsedUri.searchParams.has("replicaSet"),
            true
        );

        await mongoose.connect(uri, {
            serverSelectionTimeoutMS: 10000,
        });

        assert.equal(
            mongoose.connection.name,
            "customer_support_test"
        );

        const hello = await mongoose.connection.db
            .admin()
            .command({ hello: 1 });

        assert.ok(
            hello.setName,
            "MongoDB must be running as a replica set"
        );

        return await runTest({
            connection: mongoose.connection,
        });
    } finally {
        try {
            if (mongoose.connection.readyState !== 0) {
                await mongoose.disconnect();
            }
        } finally {
            if (replSet) {
                await replSet.stop();
            }
        }
    }
}