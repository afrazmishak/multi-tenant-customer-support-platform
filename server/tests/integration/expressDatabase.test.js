
import test from "node:test";
import assert from "node:assert/strict";

import mongoose from "mongoose";
import request from "supertest";
import {
    MongoMemoryServer,
} from "mongodb-memory-server";

import app from "../../src/app.js";

test(
    "Express handles HTTP requests with an isolated test database",
    async () => {
        let mongod;

        // Refuse to reuse an existing Mongoose connection.
        assert.equal(
            mongoose.connection.readyState,
            0,
            "Mongoose must be disconnected before the test"
        );

        try {
            // 1. Create a disposable MongoDB instance.
            mongod = await MongoMemoryServer.create();

            const uri = mongod.getUri(
                "customer_support_test"
            );

            // 2. Verify its destination before connecting.
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

            // 3. Connect the default Mongoose connection
            // used by our application's models.
            await mongoose.connect(uri, {
                serverSelectionTimeoutMS: 10000,
            });

            assert.equal(
                mongoose.connection.readyState,
                1
            );

            assert.equal(
                mongoose.connection.name,
                "customer_support_test"
            );

            // 4. Send an HTTP request through Express.
            const response = await request(app)
                .get("/")
                .expect(200);

            // 5. Verify the actual application response.
            assert.deepEqual(response.body, {
                success: true,
                message:
                    "Welcome to the Multi-Tenant Customer Support Platform API",
            });
        } finally {
            // 6. Always release resources.
            try {
                await mongoose.disconnect();
            } finally {
                if (mongod) {
                    await mongod.stop();
                }
            }
        }
    }
);
