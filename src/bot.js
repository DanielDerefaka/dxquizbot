/**
 * Zano Quiz Telegram Bot
 * A professional quiz competition bot for Telegram groups
 */
const { Telegraf, Scenes, session } = require("telegraf");
const handlers = require("./handlers");
const { quizCreationScene } = require("./scenes");
const logger = require("./logger");

/**
 * Initialize bot with token from environment variables
 */
const bot = new Telegraf(process.env.BOT_TOKEN);

/**
 * Setup scenes and middleware
 */
function setupMiddleware() {
  // Set up scenes for quiz creation wizard
  const stage = new Scenes.Stage([quizCreationScene]);
  bot.use(session());
  bot.use(stage.middleware());

  logger.info("Bot middleware configured");
}

/**
 * Register bot commands and action handlers
 */
function registerHandlers() {
  // Set bot commands for display in Telegram menu
  bot.telegram
    .setMyCommands([
      { command: "start", description: "Start the bot and see main menu" },
      { command: "help", description: "Show detailed help information" },
      {
        command: "create_quiz",
        description: "Create a new quiz using the wizard",
      },
      {
        command: "start_quiz",
        description: "Start a quiz in a group (admin only)",
      },
      { command: "end_quiz", description: "End the current quiz (admin only)" },
      { command: "my_quizzes", description: "Manage your created quizzes" },
    ])
    .catch((err) => {
      logger.error("Failed to set commands:", err);
    });

  // Register command handlers
  bot.start(handlers.startHandler);
  bot.help(handlers.helpHandler);
  bot.command("create_quiz", handlers.createQuizHandler);
  bot.command("start_quiz", handlers.startQuizHandler);
  bot.command("end_quiz", handlers.endQuizHandler);
  bot.command("my_quizzes", handlers.myQuizzesHandler);

  // Register button action handlers
  bot.action(/answer_(\d+)_(\d+)/, handlers.answerHandler);
  bot.action(/start_quiz_(.+)/, handlers.startQuizFromIdHandler);
  bot.action(/delete_quiz_(.+)/, handlers.deleteQuizHandler);
  bot.action(/edit_quiz_(.+)/, handlers.editQuizHandler);

  // Set up additional button actions
  handlers.setupButtonActions(bot);

  // Handle text input (if not in scene)
  bot.on("text", handlers.textHandler);

  logger.info("Bot commands and handlers registered");
}

/**
 * Initialize the bot
 */
function init() {
  try {
    // Setup middleware
    setupMiddleware();

    // Register handlers
    registerHandlers();

    // Global error handler
    bot.catch((err, ctx) => {
      const updateType = ctx.updateType || "unknown";
      const chatId = ctx.chat?.id || "unknown";
      const userId = ctx.from?.id || "unknown";

      logger.error(
        `Error in bot update [${updateType}] for chat ${chatId}, user ${userId}:`,
        err
      );

      // Notify user about the error if possible
      if (ctx.chat && ctx.chat.id) {
        ctx
          .reply(
            `${handlers.UI.COLORS.ERROR} An error occurred while processing your request. Please try again later.`
          )
          .catch((e) => logger.error("Failed to send error message:", e));
      }
    });

    logger.info("Bot initialization completed successfully");
    return bot;
  } catch (error) {
    logger.error("Failed to initialize bot:", error);
    throw error;
  }
}

// Initialize the bot
init();

module.exports = { bot };
