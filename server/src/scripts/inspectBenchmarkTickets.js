import "dotenv/config";
import mongoose from "mongoose";

async function main() {
    const uri = process.env.BENCHMARK_MONGODB_URI;

    if (!uri) {
        throw new Error(
            "BENCHMARK_MONGODB_URI is missing"
        );
    }

    await mongoose.connect(uri);

    if (
        mongoose.connection.name !==
        "customer_support_benchmark"
    ) {
        throw new Error(
            `Wrong database: ${mongoose.connection.name}`
        );
    }

    const collection =
        mongoose.connection.collection("tickets");

    const total = await collection.countDocuments();

    const benchmark = await collection.countDocuments({
        benchmarkRun: "phase39-ticket-queue-v1",
    });

    const other = await collection.countDocuments({
        benchmarkRun: {
            $ne: "phase39-ticket-queue-v1",
        },
    });

    console.log("Total tickets:", total);
    console.log("Benchmark tickets:", benchmark);
    console.log("Other tickets:", other);
}

try {
    await main();
} catch (error) {
    console.error("Inspection failed:", error);
    process.exitCode = 1;
} finally {
    await mongoose.disconnect();
}
