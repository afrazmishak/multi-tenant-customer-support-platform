
import test from "node:test";
import assert from "node:assert/strict";

import mongoose from "mongoose";
import {
    MongoMemoryServer,
} from "mongodb-memory-server";

test(
    "connects only to a disposable MongoDB instance",
    async () => {
        let mongod;
        let connection;

        try {
            // Start an isolated MongoDB instance.
            const binaryOptions = 
                process.platform === "win32" &&
                process.arch === "arm64"
                    ? { arch: "x64" }
                    : {};
            
            mongod = await MongoMemoryServer.create({
                binary: binaryOptions,
            });

            // Obtain the URI from the actual running instance.
            const uri = mongod.getUri(
                "customer_support_test"
            );

            const parsedUri = new URL(uri);

            // Reject any unexpected database destination.
            assert.equal(
                parsedUri.protocol,
                "mongodb:"
            );

            assert.equal(
                parsedUri.hostname,
                "127.0.0.1"
            );

            assert.equal(
                parsedUri.pathname,
                "/customer_support_test"
            );

            assert.equal(
                Number(parsedUri.port),
                mongod.instanceInfo.port
            );

            // Connect without using process.env.MONGODB_URI.
            connection = await mongoose
                .createConnection(uri, {
                    serverSelectionTimeoutMS: 10000,
                })
                .asPromise();

            assert.equal(
                connection.readyState,
                1
            );

            assert.equal(
                connection.name,
                "customer_support_test"
            );

            const result =
                await connection.db.admin().ping();

            assert.equal(result.ok, 1);
        } finally {
            // Always release the test connection.
            if (connection) {
                await connection.close();
            }

            // Stop and clean up the disposable instance.
            if (mongod) {
                await mongod.stop();
            }
        }
    }
);
