/**
 * Zano Quiz - Main Entry Point
 * A professional quiz competition bot for Telegram groups
 * With improved connection handling and conflict resolution
 */
require("dotenv").config();
const { bot } = require("./src/bot");
const logger = require("./src/logger");
const https = require("https");

// Import node-fetch for older Node.js versions
const fetch = require("node-fetch");

// Maximum number of startup retries
const MAX_RETRIES = 3;
// Delay between retries in milliseconds
const RETRY_DELAY = 5000;

/**
 * Check Telegram API connectivity
 * @returns {Promise<boolean>} Whether connection is successful
 */
async function checkConnection(token) {
  try {
    console.log("Testing connection to Telegram API...");
    const response = await fetch(`https://api.telegram.org/bot${token}/getMe`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });

    if (response.ok) {
      const data = await response.json();
      if (data.ok) {
        console.log(`✅ Connection successful! Bot: @${data.result.username}`);
        return true;
      } else {
        console.error(`❌ API Error: ${data.description}`);
        return false;
      }
    } else {
      console.error(`❌ HTTP Error: ${response.status} ${response.statusText}`);
      return false;
    }
  } catch (error) {
    console.error("❌ Connection test failed:", error.message);

    // Fallback to native https if fetch fails
    return new Promise((resolve) => {
      console.log("Trying alternative connection method...");
      const req = https.request(
        {
          hostname: "api.telegram.org",
          port: 443,
          path: `/bot${token}/getMe`,
          method: "GET",
          timeout: 10000,
        },
        (res) => {
          let data = "";
          res.on("data", (chunk) => {
            data += chunk;
          });

          res.on("end", () => {
            try {
              const result = JSON.parse(data);
              if (result.ok) {
                console.log(
                  `✅ Connection successful! Bot: @${result.result.username}`
                );
                resolve(true);
              } else {
                console.error(`❌ API Error: ${result.description}`);
                resolve(false);
              }
            } catch (e) {
              console.error("❌ Error parsing response:", e.message);
              resolve(false);
            }
          });
        }
      );

      req.on("error", (e) => {
        console.error("❌ Connection error:", e.message);
        resolve(false);
      });

      req.on("timeout", () => {
        console.error("❌ Connection timed out");
        req.destroy();
        resolve(false);
      });

      req.end();
    });
  }
}

/**
 * Reset webhook to prevent conflicts with other instances
 * @param {Object} bot - Telegraf bot instance
 * @returns {Promise<boolean>} Success status
 */
async function resetWebhook(bot) {
  try {
    console.log("Resetting webhook to prevent conflicts...");
    await bot.telegram.deleteWebhook({ drop_pending_updates: true });
    console.log("✅ Webhook reset successful");

    // Add a small delay to ensure Telegram processes the webhook deletion
    await new Promise((resolve) => setTimeout(resolve, 2000));
    return true;
  } catch (error) {
    console.error("❌ Failed to reset webhook:", error.message);
    return false;
  }
}

/**
 * Start the bot with polling and retry mechanism
 */
async function startBot() {
  logger.info("Starting Zano Quiz bot...");

  // Get bot token
  const botToken = process.env.BOT_TOKEN;
  if (!botToken) {
    logger.error("BOT_TOKEN environment variable not set!");
    console.error("ERROR: BOT_TOKEN not found in environment variables!");
    console.log("Make sure you have a .env file with BOT_TOKEN=your_token");
    process.exit(1);
  }

  // Check token format
  if (!botToken.match(/^\d+:[A-Za-z0-9_-]{35}$/)) {
    logger.warn("BOT_TOKEN format looks incorrect! Double-check your token.");
    console.warn(
      "WARNING: Your bot token format looks unusual. Check it in BotFather."
    );
  }

  // Test connection before proceeding
  if (!(await checkConnection(botToken))) {
    console.log("\nTroubleshooting steps:");
    console.log("1. Check your internet connection");
    console.log("2. Make sure api.telegram.org is not blocked on your network");
    console.log("3. Verify your bot token with BotFather");
    console.log("4. Try with a different network connection or VPN");
  }

  // Reset webhook before starting to avoid conflict errors
  await resetWebhook(bot);

  // Start bot with retries
  let currentRetry = 0;

  while (currentRetry <= MAX_RETRIES) {
    try {
      if (currentRetry > 0) {
        logger.info(`Retry attempt ${currentRetry}/${MAX_RETRIES}...`);
        console.log(`Retry attempt ${currentRetry}/${MAX_RETRIES}...`);

        // Reset webhook again before retry
        await resetWebhook(bot);
      }

      // Try to get bot info before starting
      const botInfo = await bot.telegram.getMe();
      logger.info(`Starting @${botInfo.username} (${botInfo.id})`);

      // Launch the bot with custom options
      await bot.launch({
        // Set API request timeout to 30 seconds
        telegram: {
          apiRoot: "https://api.telegram.org",
          webhookReply: false,
          apiTimeout: 30000,
          // Add a unique session name to prevent conflicts
          sessionName: `bot_session_${Date.now()}`,
        },
        // Use long polling with a reasonable timeout
        polling: {
          timeout: 30,
          limit: 100,
        },
      });

      logger.info("Bot is running successfully!");

      // Display startup message
      const nodeVersion = process.version;
      const environment = process.env.NODE_ENV || "development";
      logger.info(
        `Environment: ${environment}, Node.js: ${nodeVersion}, Runtime: ${
          process.release?.name || "Node.js"
        }`
      );

      console.log(`
====================================
  Zano Quiz Bot Started Successfully!
  Bot Username: @${botInfo.username}
  Node.js: ${nodeVersion}
  Environment: ${environment}
  Runtime: ${process.release?.name || "Node.js"}
====================================
`);
      return;
    } catch (error) {
      logger.error(
        `Failed to start bot (attempt ${currentRetry + 1}/${MAX_RETRIES + 1}):`,
        error
      );
      console.error(`Bot startup attempt failed: ${error.message}`);

      // Handle conflict error specifically
      if (error.description && error.description.includes("409: Conflict")) {
        console.log("⚠️ Conflict detected! Another bot instance is running.");
        await resetWebhook(bot);
        // Add extra delay for conflicts
        await new Promise((resolve) => setTimeout(resolve, 5000));
      }

      currentRetry++;

      if (currentRetry <= MAX_RETRIES) {
        // Wait before retrying
        logger.info(`Waiting ${RETRY_DELAY / 1000} seconds before retrying...`);
        console.log(`Waiting ${RETRY_DELAY / 1000} seconds before retrying...`);
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY));
      } else {
        // All retries failed
        console.error("Bot startup failed after multiple attempts!");
        console.log("\nTroubleshooting steps:");
        console.log("1. Check your internet connection");
        console.log(
          "2. Make sure api.telegram.org is not blocked on your network"
        );
        console.log("3. Check for other running instances of your bot");
        console.log("4. Try with a different network connection or VPN");
        process.exit(1);
      }
    }
  }
}

/**
 * Handle application shutdown
 * @param {string} signal - Signal that triggered shutdown
 */
function shutdown(signal) {
  logger.info(`Received ${signal}. Shutting down gracefully...`);
  console.log(`\nShutting down Zano Quiz bot (${signal})...`);

  // Stop the bot
  bot.stop(signal);

  // Allow some time for cleanup and exit
  setTimeout(() => {
    logger.info("Shutdown complete");
    console.log("Shutdown complete.");
    process.exit(0);
  }, 1000);
}

// Enable graceful stop
process.once("SIGINT", () => shutdown("SIGINT"));
process.once("SIGTERM", () => shutdown("SIGTERM"));

// Handle uncaught exceptions
process.on("uncaughtException", (err) => {
  logger.error("Uncaught exception:", err);
  console.error("\n[FATAL] Uncaught exception:", err);
  shutdown("UNCAUGHT_EXCEPTION");
});

// Handle unhandled promise rejections
process.on("unhandledRejection", (reason, promise) => {
  logger.error("Unhandled rejection at:", promise, "reason:", reason);
  console.error("\n[FATAL] Unhandled rejection:", reason);
  shutdown("UNHANDLED_REJECTION");
});

// Create HTTP server for Render.com health checks
const http = require("http");
const PORT = process.env.PORT || 3000;

http
  .createServer((req, res) => {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        status: "ok",
        message: "Zano Quiz Bot is running",
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
      })
    );
  })
  .listen(PORT, () => {
    console.log(`Health check server running on port ${PORT}`);
  });

// Start the bot
startBot();
