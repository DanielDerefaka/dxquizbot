/**
 * DXQuiz - Main Entry Point
 * A professional quiz competition bot for Telegram groups
 * With improved connection handling
 */
require('dotenv').config();
const { bot } = require('./src/bot');
const logger = require('./src/logger');

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
    console.log('Testing connection to Telegram API...');
    const response = await fetch(`https://api.telegram.org/bot${token}/getMe`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
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
    console.error('❌ Connection test failed:', error.message);
    return false;
  }
}

/**
 * Start the bot with polling and retry mechanism
 */
async function startBot() {
  logger.info('Starting DXQuiz bot...');
  
  // Get bot token
  const botToken = process.env.BOT_TOKEN;
  if (!botToken) {
    logger.error('BOT_TOKEN environment variable not set!');
    console.error('ERROR: BOT_TOKEN not found in environment variables!');
    console.log('Make sure you have a .env file with BOT_TOKEN=your_token');
    process.exit(1);
  }
  
  // Check token format
  if (!botToken.match(/^\d+:[A-Za-z0-9_-]{35}$/)) {
    logger.warn('BOT_TOKEN format looks incorrect! Double-check your token.');
    console.warn('WARNING: Your bot token format looks unusual. Check it in BotFather.');
  }
  
  // Test connection before proceeding
  if (!await checkConnection(botToken)) {
    console.log('\nTroubleshooting steps:');
    console.log('1. Check your internet connection');
    console.log('2. Make sure api.telegram.org is not blocked on your network');
    console.log('3. Verify your bot token with BotFather');
    console.log('4. Try with a different network connection or VPN');
  }
  
  // Start bot with retries
  let currentRetry = 0;
  
  while (currentRetry <= MAX_RETRIES) {
    try {
      if (currentRetry > 0) {
        logger.info(`Retry attempt ${currentRetry}/${MAX_RETRIES}...`);
        console.log(`Retry attempt ${currentRetry}/${MAX_RETRIES}...`);
      }
      
      // Try to get bot info before starting
      const botInfo = await bot.telegram.getMe();
      logger.info(`Starting @${botInfo.username} (${botInfo.id})`);
      
      // Launch the bot with custom options
      await bot.launch({
        // Set API request timeout to 30 seconds
        telegram: {
          apiRoot: 'https://api.telegram.org',
          webhookReply: false,
          apiTimeout: 30000,
        }
      });
      
      logger.info('Bot is running successfully!');
      
      // Display startup message
      const nodeVersion = process.version;
      const environment = process.env.NODE_ENV || 'development';
      logger.info(`Environment: ${environment}, Node.js: ${nodeVersion}, Runtime: ${process.release?.name || 'Bun'}`);
      
      console.log(`
====================================
  DXQuiz Bot Started Successfully!
  Bot Username: @${botInfo.username}
  Node.js: ${nodeVersion}
  Environment: ${environment}
  Runtime: ${process.release?.name || 'Bun'}
====================================
`);
      return;
    } catch (error) {
      logger.error(`Failed to start bot (attempt ${currentRetry + 1}/${MAX_RETRIES + 1}):`, error);
      console.error(`Bot startup attempt failed: ${error.message}`);
      
      currentRetry++;
      
      if (currentRetry <= MAX_RETRIES) {
        // Wait before retrying
        logger.info(`Waiting ${RETRY_DELAY/1000} seconds before retrying...`);
        console.log(`Waiting ${RETRY_DELAY/1000} seconds before retrying...`);
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
      } else {
        // All retries failed
        console.error('Bot startup failed after multiple attempts!');
        console.log('\nTroubleshooting steps:');
        console.log('1. Check your internet connection');
        console.log('2. Make sure api.telegram.org is not blocked on your network');
        console.log('3. Try running with Node.js instead of Bun: "node index.js"');
        console.log('4. Try with a different network connection or VPN');
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
  console.log(`\nShutting down DXQuiz bot (${signal})...`);
  
  // Stop the bot
  bot.stop(signal);
  
  // Allow some time for cleanup and exit
  setTimeout(() => {
    logger.info('Shutdown complete');
    console.log('Shutdown complete.');
    process.exit(0);
  }, 1000);
}

// Enable graceful stop
process.once('SIGINT', () => shutdown('SIGINT'));
process.once('SIGTERM', () => shutdown('SIGTERM'));

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  logger.error('Uncaught exception:', err);
  console.error('\n[FATAL] Uncaught exception:', err);
  shutdown('UNCAUGHT_EXCEPTION');
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled rejection at:', promise, 'reason:', reason);
  console.error('\n[FATAL] Unhandled rejection:', reason);
  shutdown('UNHANDLED_REJECTION');
});

// Start the bot
startBot();