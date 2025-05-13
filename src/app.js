const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");

dotenv.config();

// const swaggerSpec = require("./config/swagger");
const mainRouter = require("./routes/index");
const errorHandler = require("./utils/errorHandler");

const app = express();
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient(); // Instantiate prisma client
app.use(cors());

app.use(express.json());


app.use("/", mainRouter);

app.get("/", (req, res) => {
    res.json({
        message: "Welcome to trackmoji",
        documentation: "/api-docs",
    });
});

app.use((req, res, next) => {
    res.status(404).json({
        success: false,
        error: { message: `Not Found - Cannot ${req.method} ${req.originalUrl}` },
    });
});

app.use(errorHandler);

const shutdown = async (signal) => {
    console.log(`\n${signal} signal received. Closing HTTP server...`);
    app.close(async () => {
        console.log("HTTP server closed.");
        try {
            await prisma.$disconnect();
            console.log("Prisma Client disconnected.");
            process.exit(0);
        } catch (e) {
            console.error("Error disconnecting Prisma Client:", e);
            process.exit(1);
        }
    });
};

module.exports = { app, shutdown, prisma };
