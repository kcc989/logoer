import express from "express";
import { GenerateRequestSchema, type GenerateResponse, type AgentMessage } from "./types.js";
import { runLogoAgent } from "./agent.js";

const app = express();
app.use(express.json({ limit: "10mb" }));

// Health check endpoint
app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "logo-agent-ts" });
});

// Generate logo endpoint (streaming SSE)
app.post("/generate", async (req, res) => {
  try {
    // Validate request
    const parseResult = GenerateRequestSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({
        error: "Invalid request",
        details: parseResult.error.errors
      });
      return;
    }

    const request = parseResult.data;

    // Set up SSE headers
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");

    // Helper to send SSE messages
    const sendEvent = (event: string, data: unknown) => {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    // Run the logo agent
    const result = await runLogoAgent(request, {
      onMessage: (message: AgentMessage) => {
        sendEvent("message", message);
      },
      onPhase: (phase) => {
        sendEvent("phase", phase);
      },
      onProgress: (svg: string, iteration: number) => {
        sendEvent("progress", { svg, iteration });
      },
    });

    // Send final result
    sendEvent("complete", result);
    res.end();
  } catch (error) {
    console.error("Generation error:", error);

    // If headers not sent yet, send JSON error
    if (!res.headersSent) {
      res.status(500).json({
        error: "Generation failed",
        message: error instanceof Error ? error.message : "Unknown error"
      });
    } else {
      // If streaming, send error event
      res.write(`event: error\ndata: ${JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error"
      })}\n\n`);
      res.end();
    }
  }
});

// Non-streaming generate endpoint for simple requests
app.post("/generate/sync", async (req, res) => {
  try {
    const parseResult = GenerateRequestSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({
        error: "Invalid request",
        details: parseResult.error.errors
      });
      return;
    }

    const result = await runLogoAgent(parseResult.data, {});
    res.json(result);
  } catch (error) {
    console.error("Generation error:", error);
    res.status(500).json({
      error: "Generation failed",
      message: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

// Start server
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Logo Agent TS server running on port ${PORT}`);
});
