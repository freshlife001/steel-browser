import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { $ref } from "../../plugins/schemas.js";
import cdpSchemas from "./cdp.schemas.js";
import { fetch } from "undici";

async function routes(server: FastifyInstance) {
  server.all(
    "/devtools/*",
    {
      schema: {
        operationId: "getDevtoolsUrl",
        description: "Proxy all DevTools requests to the debugger URL",
        tags: ["CDP"],
        summary: "Proxy DevTools requests",
      },
    },
    async (
      request: FastifyRequest<{ Querystring: z.infer<typeof cdpSchemas.GetDevtoolsUrlSchema> }>,
      reply: FastifyReply,
    ) => {
      const debuggerUrl = server.cdpService.getDebuggerUrl();
      const wsUrl = server.cdpService.getDebuggerWsUrl(request.query.pageId);
      const originalPath = request.url;
      let queryStr = new URLSearchParams(request.query as any).toString();
      if (originalPath.endsWith("devtools_app.html") && queryStr === "") {
        const redirectUrl = `${originalPath}?ws=${wsUrl.replace("ws:", "")}`;
        console.info(`redirectUrl ${redirectUrl}`);
        return reply.redirect(redirectUrl);
      }
      const targetUrl = `${debuggerUrl}${originalPath.replace("/v1/devtools/", "")}`;
      try {
        // Fetch the content from the target URL and proxy it back
        const response = await fetch(targetUrl, {
          method: request.method,
          headers: {
            "User-Agent": request.headers["user-agent"] || "",
            Accept: request.headers.accept || "*/*",
            "Content-Type": request.headers["content-type"] || "",
          },
          body: request.body as any,
        });

        // Set appropriate headers and forward the response
        reply.status(response.status);
        reply.type(response.headers.get("content-type") || "text/html");

        // Forward the response body
        const body = await response.text();
        return reply.send(body);
      } catch (error) {
        server.log.error(`Proxy error: ${error}`);
        return reply.status(500).send("Proxy error");
      }
    },
  );
}

export default routes;
