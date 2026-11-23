import assert from "node:assert/strict";
import mongoose from "mongoose";

import {
    MongoMemoryServer,
} from "mongodb-memory-server";
import { url } from "node:inspector";
import { parse } from "node:path";

export async function withIsolatedDatabase(runTest) {
    assert.equal(
        typeof runTest,
        "function",
        "A test callback is required"
    );

    assert.equal(
        mongoose.connection.readyState,
        0,
        "Mongoose must be disconnected before starting an isolated test"
    );

    let mongod;

    try {
        mongod = await MongoMemoryServer.create({
            binary: {
                arch: "x64",
            },
        });

        const uri = mongod.getUri(
            "customer_support_test"
        );

        const parsedUri = new URL(uri);

        assert.equal(parsedUri.protocol, "mongodb:");
        assert.equal(parsedUri.hostname, "127.0.0.1");
        assert.equal(
            parsedUri.pathname,
            "/customer_support_test"
        );
        assert.equal(
            Number(parsedUri.port),
            mongod.instanceInfo.port
        );

        // Never use process.env.MONGODB_URI here.
        await mongoose.connect(uri, {
            serverSelectionTimeoutMS: 10000,
        });

        assert.equal(
            mongoose.connection.readyState,
            1
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
            if (mongod) {
                await mongod.stop();
            }
        }
    }
}