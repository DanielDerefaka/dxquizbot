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
 * Check if a user is an admin in a Telegram group
 * @param {Object} ctx - Telegram context
 * @param {number} userId - User ID to check
 * @param {number} chatId - Chat ID to check in
 * @returns {Promise<boolean>} Whether the user is an admin
 */
async function isGroupAdmin(ctx, userId, chatId) {
  try {
    // Get chat member info
    const member = await ctx.telegram.getChatMember(chatId, userId);
    
    // Check if the user is an admin or the creator
    return ['creator', 'administrator'].includes(member.status);
  } catch (error) {
    logger.error(`Error checking admin status: ${error.message}`, error);
    return false;
  }
}

/**
 * Middleware to check if user is an admin for group commands
 * @param {Object} ctx - Telegram context
 * @param {Function} next - Next middleware function
 */
async function adminRequiredMiddleware(ctx, next) {
  // Skip check for private chats
  if (!ctx.chat || ctx.chat.type === 'private') {
    return next();
  }
  
  // List of commands that require admin privileges in groups
  const adminCommands = [
    'start_quiz',
    'end_quiz',
    'schedule_quiz',
    'cancel_quiz',
    'skip_question',
    'settings'
  ];
  
  // Check if this is a command message
  if (ctx.message && ctx.message.text && ctx.message.text.startsWith('/')) {
    const command = ctx.message.text.split(' ')[0].substring(1).split('@')[0];
    
    // If this is an admin command, check permissions
    if (adminCommands.includes(command)) {
      const isAdmin = await isGroupAdmin(ctx, ctx.from.id, ctx.chat.id);
      
      if (!isAdmin) {
        await ctx.replyWithHTML(
          handlers.formatMessage(
            "Admin Permission Required",
            `Sorry, only group administrators can use the /${command} command.`,
            handlers.UI.COLORS.DANGER
          )
        );
        return; // Stop processing
      }
    }
  }
  
  // Continue processing if admin check passed or not needed
  return next();
}

/**
 * Setup scenes and middleware
 */
function setupMiddleware() {
  // Set up scenes for quiz creation wizard
  const stage = new Scenes.Stage([quizCreationScene]);
  bot.use(session());
  bot.use(stage.middleware());
  
  // Add admin middleware to restrict group commands to admins only
  bot.use(adminRequiredMiddleware);

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
      { command: "shared_quizzes", description: "See quizzes shared with you" },
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
  bot.command("shared_quizzes", handlers.sharedWithMeHandler);

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

module.exports = { bot, isGroupAdmin, adminRequiredMiddleware };