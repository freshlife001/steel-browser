import fastify from "fastify";
import fastifyCors from "@fastify/cors";
import fastifySensible from "@fastify/sensible";
import steelBrowserPlugin from "./steel-browser-plugin.js";
import { loggingConfig } from "./config.js";
import { MB } from "./utils/size.js";

const HOST = process.env.HOST ?? "0.0.0.0";
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

// 🔹 Add these FIRST — before imports that might throw
process.on("unhandledRejection", (reason, p) => {
  console.error("Unhandled Rejection at:", p, "reason:", reason);
});

process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err);
  process.exit(1); // optional — some apps prefer not to exit here
});

export const server = fastify({
  logger: loggingConfig[process.env.NODE_ENV ?? "development"] ?? true,
  trustProxy: true,
  bodyLimit: 100 * MB,
  disableRequestLogging: true,
});

server.setErrorHandler((error, request, reply) => {
  request.log.error(error, "Unhandled error");
  reply.status(error.statusCode ?? 500).send({
    error: "Internal Server Error",
    message: error.message,
  });
});

const setupServer = async () => {
  await server.register(fastifySensible);
  await server.register(fastifyCors, { origin: true });
  await server.register(steelBrowserPlugin, {
    fileStorage: {
      maxSizePerSession: 100 * MB,
    },
  });
};

const startServer = async () => {
  try {
    await setupServer();
    await server.listen({ port: PORT, host: HOST });
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

startServer();
