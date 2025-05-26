/**
 * Enhanced handlers for Zano Quiz Bot
 * Implements privacy controls, quiz sharing, and improved organization
 */
const { Markup } = require("telegraf");
const quiz = require("./quiz");
const quizManager = require("./quizManager");
const logger = require("./logger");

/**
 * Constants for UI elements
 */
const UI = {
  ICONS: {
    WELCOME: "🎯",
    CREATE: "📝",
    PLAY: "🎮",
    LIST: "📚",
    DELETE: "🗑️",
    EDIT: "✏️",
    INFO: "ℹ️",
    SUCCESS: "✅",
    ERROR: "❌",
    TIMER: "⏱️",
    STAR: "⭐",
    CROWN: "👑",
    MEDAL_GOLD: "🥇",
    MEDAL_SILVER: "🥈",
    MEDAL_BRONZE: "🥉",
    SHARE: "🔗",
    SEARCH: "🔍",
    BACK: "⬅️",
    LOCK: "🔒",
    UNLOCK: "🔓",
    CATEGORY: "📂",
  },
  COLORS: {
    PRIMARY: "🔵",
    SUCCESS: "🟢",
    WARNING: "🟡",
    DANGER: "🔴",
  },
  BUTTONS: {
    START: "Start Quiz",
    DELETE: "Delete",
    EDIT: "Edit",
    BACK: "Back",
    SHARE: "Share",
    COPY: "Copy",
  }
};

/**
 * Formats a message with proper styling and spacing using HTML
 * @param {string} title - The title of the message
 * @param {string} content - The content of the message
 * @param {string} icon - Optional icon to prefix the title
 * @returns {string} Formatted message in HTML
 */
function formatMessage(title, content, icon = "") {
  const titleText = icon ? `${icon} ${title}` : title;
  return `<b>${titleText}</b>\n\n${content}`;
}

/**
 * Start command handler - Welcome message
 * @param {Object} ctx - Telegram context
 */
async function startHandler(ctx) {
  try {
    const userName = ctx.from.first_name || "there";
    
    // Check if this is a deep link to a quiz
    if (ctx.message && ctx.message.text && ctx.message.text.includes("quiz_")) {
      // Extract quiz ID from deep link
      const match = ctx.message.text.match(/quiz_([a-zA-Z0-9-]+)/);
      if (match && match[1]) {
        const quizId = match[1];
        return await handleDeepLinkQuiz(ctx, quizId);
      }
    }
    
    const welcomeMessage = formatMessage(
      `Welcome to Zano Quiz, ${userName}!`,
      `I'm your interactive quiz competition bot for Telegram groups.\n\n` +
        `${UI.ICONS.CREATE} Use /create_quiz to create a new custom quiz\n` +
        `${UI.ICONS.LIST} Use /my_quizzes to manage your saved quizzes\n` +
        `${UI.ICONS.SHARE} Use /shared_quizzes to see quizzes shared with you\n` +
        `${UI.ICONS.PLAY} Add me to a group and use /start_quiz to play\n\n` +
        `Need help? Just type /help for more information.`,
      UI.ICONS.WELCOME
    );

    // Create welcome buttons
    const keyboard = Markup.inlineKeyboard([
      [
        Markup.button.callback(
          `${UI.ICONS.CREATE} Create New Quiz`,
          "create_quiz"
        ),
      ],
      [
        Markup.button.callback(`${UI.ICONS.LIST} My Quizzes`, "my_quizzes"),
        Markup.button.callback(`${UI.ICONS.SHARE} Shared Quizzes`, "shared_quizzes"),
      ],
      [Markup.button.callback(`${UI.ICONS.INFO} Help`, "show_help")],
    ]);

    try {
      await ctx.replyWithHTML(welcomeMessage, keyboard);
    } catch (error) {
      logger.error("Error in startHandler:", error);
      await ctx.reply(
        "Welcome to Zano Quiz! Use /help to see available commands."
      );
    }
  } catch (error) {
    logger.error("Error in startHandler:", error);
    await ctx.reply(
      "Welcome to Zano Quiz! Use /help to see available commands."
    );
  }
}

/**
 * Handle deep link to a quiz
 * @param {Object} ctx - Telegram context
 * @param {string} quizId - Quiz ID from deep link
 */
async function handleDeepLinkQuiz(ctx, quizId) {
  try {
    const userId = ctx.from.id;
    
    // Get the quiz
    const quiz = await quizManager.getQuiz(quizId, userId);
    
    if (!quiz) {
      return await ctx.replyWithHTML(
        formatMessage(
          "Quiz Not Found",
          "The quiz you're looking for doesn't exist or you don't have permission to access it.",
          UI.COLORS.ERROR
        ),
        Markup.inlineKeyboard([
          [
            Markup.button.callback(
              `${UI.ICONS.LIST} My Quizzes`,
              "my_quizzes"
            ),
          ],
        ])
      );
    }
    
    // Check if the user is the creator or the quiz is shared
    const isCreator = quiz.creator === userId;
    
    // Format quiz info
    const createdDate = new Date(quiz.createdAt).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
    
    const creatorName = quiz.creatorName || `User ${quiz.creator}`;
    
    let message = formatMessage(
      `Quiz: ${quiz.title}`,
      `${UI.ICONS.INFO} <b>Details:</b>\n` +
      `• Category: ${quiz.category || "Uncategorized"}\n` +
      `• Questions: ${quiz.questions.length}\n` +
      `• Time: ${quiz.settings?.questionTime || 15} seconds per question\n` +
      `• Created: ${createdDate}\n` +
      `• By: ${isCreator ? "You" : creatorName}\n\n` +
      `To play this quiz in a group, add me to the group and use:\n` +
      `/start_quiz ${quizId}`,
      UI.ICONS.PLAY
    );
    
    // Different buttons based on whether user is creator
    let buttons;
    
    if (isCreator) {
      buttons = [
        [
          Markup.button.callback(
            `${UI.ICONS.EDIT} Edit Quiz`,
            `edit_quiz_${quizId}`
          ),
          Markup.button.callback(
            `${UI.ICONS.SHARE} Share Quiz`,
            `share_quiz_${quizId}`
          ),
        ],
        [
          Markup.button.callback(
            `${UI.ICONS.PLAY} Play in Group`,
            `view_start_instructions_${quizId}`
          ),
          Markup.button.callback(
            `${UI.ICONS.DELETE} Delete Quiz`,
            `delete_quiz_${quizId}`
          ),
        ],
      ];
    } else {
      buttons = [
        [
          Markup.button.callback(
            `${UI.ICONS.PLAY} Play in Group`,
            `view_start_instructions_${quizId}`
          ),
          Markup.button.callback(
            `${UI.ICONS.CREATE} Copy to My Quizzes`,
            `copy_quiz_${quizId}`
          ),
        ],
      ];
    }
    
    // Add navigation button
    buttons.push([
      Markup.button.callback(
        `${UI.ICONS.LIST} My Quizzes`,
        "my_quizzes"
      ),
    ]);
    
    await ctx.replyWithHTML(message, Markup.inlineKeyboard(buttons));
  } catch (error) {
    logger.error("Error in handleDeepLinkQuiz:", error);
    await ctx.reply(
      `${UI.COLORS.ERROR} An error occurred while accessing the quiz.`
    );
  }
}

/**
 * Help command handler - Shows comprehensive help information
 * @param {Object} ctx - Telegram context
 */
async function helpHandler(ctx) {
  try {
    const helpText = formatMessage(
      "Zano Quiz Bot Help",
      `${UI.ICONS.CREATE} <b>Creating Quizzes:</b>\n` +
        `/create_quiz - Start the quiz creation wizard\n` +
        `/my_quizzes - View and manage your quizzes\n` +
        `/shared_quizzes - See quizzes shared with you\n\n` +
        `${UI.ICONS.PLAY} <b>Playing Quizzes:</b>\n` +
        `/start_quiz - Start a quiz in a group (admin only)\n` +
        `/end_quiz - End the current quiz (admin only)\n\n` +
        `${UI.ICONS.SHARE} <b>Sharing Quizzes:</b>\n` +
        `• Share publicly or with specific users\n` +
        `• Generate shareable links\n` +
        `• Copy quizzes shared with you\n\n` +
        `${UI.ICONS.INFO} <b>Quiz Creation Tips:</b>\n` +
        `• Give your quiz a descriptive name\n` +
        `• Choose an appropriate category\n` +
        `• Set an appropriate timer (10-30 seconds works best)\n` +
        `• Create clear questions with one correct answer\n` +
        `• Add at least 5 questions for a good experience\n\n` +
        `${UI.ICONS.STAR} <b>Playing Tips:</b>\n` +
        `• First correct answer gets points\n` +
        `• Timer counts down for each question\n` +
        `• Final rankings are shown at the end\n\n` +
        `Need more help? Use the buttons below:`,
      UI.ICONS.INFO
    );

    // Add help navigation buttons
    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback(`${UI.ICONS.CREATE} Create Quiz`, "create_quiz")],
      [
        Markup.button.callback(`${UI.ICONS.PLAY} Play Quiz`, "show_play_info"),
        Markup.button.callback(`${UI.ICONS.SHARE} Share Quiz`, "show_share_info"),
      ],
      [Markup.button.callback(`🏠 Back to Main Menu`, "start")],
    ]);

    try {
      await ctx.replyWithHTML(helpText, keyboard);
    } catch (error) {
      logger.error("Error in helpHandler:", error);
      await ctx.reply("An error occurred while showing help. Please try again.");
    }
  } catch (error) {
    logger.error("Error in helpHandler:", error);
    await ctx.reply("An error occurred while showing help. Please try again.");
  }
}

/**
 * Create quiz command handler - Initiates quiz creation wizard
 * @param {Object} ctx - Telegram context
 */
async function createQuizHandler(ctx) {
  try {
    // Check if in private chat
    if (ctx.chat.type !== "private") {
      return await ctx.reply(
        `${UI.ICONS.INFO} Quiz creation is only available in private chats. Please message me directly to create a quiz.`
      );
    }

    // Start the scene
    await ctx.scene.enter("create_quiz");
  } catch (error) {
    logger.error("Error in createQuizHandler:", error);
    await ctx.reply(
      `${UI.COLORS.ERROR} Couldn't start quiz creation. Please try again later.`
    );
  }
}

/**
 * Enhanced My Quizzes handler with category filtering and search
 * @param {Object} ctx - Telegram context
 */
async function myQuizzesHandler(ctx) {
  try {
    const userId = ctx.from.id;
    
    // Check for query parameters in commands like "/my_quizzes search=test" or "/my_quizzes category=Science"
    let searchQuery = "";
    let categoryFilter = "";
    
    if (ctx.message && ctx.message.text) {
      const text = ctx.message.text;
      
      // Extract search query
      const searchMatch = text.match(/search=([^\s]+)/);
      if (searchMatch) {
        searchQuery = searchMatch[1];
      }
      
      // Extract category
      const categoryMatch = text.match(/category=([^\s]+)/);
      if (categoryMatch) {
        categoryFilter = categoryMatch[1];
      }
    }
    
    // Get quizzes with optional filtering
    let quizzes;
    
    if (searchQuery) {
      quizzes = await quizManager.searchQuizzes(searchQuery, userId);
    } else if (categoryFilter) {
      quizzes = await quizManager.getQuizzesByCategory(categoryFilter, userId);
    } else {
      quizzes = await quizManager.getQuizzesByCreator(userId);
    }

    // If no quizzes found
    if (quizzes.length === 0) {
      let noQuizzesMessage;
      
      if (searchQuery) {
        noQuizzesMessage = formatMessage(
          "No Matching Quizzes",
          `No quizzes found matching "${searchQuery}".\n\n` +
          "Try a different search term or create a new quiz.",
          UI.COLORS.INFO
        );
      } else if (categoryFilter) {
        noQuizzesMessage = formatMessage(
          "No Quizzes in Category",
          `You haven't created any quizzes in the "${categoryFilter}" category.\n\n` +
          "Create your first quiz in this category or view all quizzes.",
          UI.COLORS.INFO
        );
      } else {
        noQuizzesMessage = formatMessage(
          "No Quizzes Found",
          "You haven't created any quizzes yet!\n\n" +
          "Create your first quiz by clicking the button below.",
          UI.COLORS.INFO
        );
      }

      return await ctx.replyWithHTML(
        noQuizzesMessage,
        Markup.inlineKeyboard([
          [
            Markup.button.callback(
              `${UI.ICONS.CREATE} Create New Quiz`,
              "create_quiz"
            ),
          ],
          searchQuery || categoryFilter ? [
            Markup.button.callback(
              `${UI.ICONS.LIST} View All Quizzes`,
              "my_quizzes"
            ),
          ] : [],
        ].filter(row => row.length > 0))
      );
    }

    // Group quizzes by category
    const quizzesByCategory = {};
    quizzes.forEach(quiz => {
      const category = quiz.category || "Uncategorized";
      if (!quizzesByCategory[category]) {
        quizzesByCategory[category] = [];
      }
      quizzesByCategory[category].push(quiz);
    });
    
    // Build message title
    let titlePrefix = "Your Quizzes";
    if (searchQuery) {
      titlePrefix = `Search Results for "${searchQuery}"`;
    } else if (categoryFilter) {
      titlePrefix = `Quizzes in "${categoryFilter}"`;
    }
    
    // Create message content
    let message = formatMessage(
      titlePrefix,
      searchQuery || categoryFilter
        ? `Found ${quizzes.length} quiz${quizzes.length !== 1 ? 'zes' : ''}.`
        : "Here are all the quizzes you've created, organized by category:",
      UI.ICONS.LIST
    );

    // List categories with quiz counts
    if (!searchQuery && !categoryFilter) {
      message += "\n\n<b>Categories:</b>";
      Object.keys(quizzesByCategory).forEach(category => {
        message += `\n• ${category} (${quizzesByCategory[category].length})`;
      });
      message += "\n";
    }
    
    // Show the top 5 quizzes
    const displayQuizzes = quizzes.slice(0, 5);
    
    message += "\n<b>Quizzes:</b>";
    displayQuizzes.forEach((quiz, index) => {
      // Format creation date
      const createdDate = new Date(quiz.createdAt).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });

      message +=
        `\n\n<b>${index + 1}. ${quiz.title}</b>\n` +
        `${UI.ICONS.INFO} Questions: ${quiz.questions.length}\n` +
        `📂 Category: ${quiz.category || "Uncategorized"}\n` +
        `📅 Created: ${createdDate}`;
        
      // Add sharing status if shared
      if (quiz.shared) {
        message += `\n🔗 Shared: Public`;
      } else if (Array.isArray(quiz.sharedWith) && quiz.sharedWith.length > 0) {
        message += `\n🔗 Shared: With ${quiz.sharedWith.length} user(s)`;
      }
    });
    
    // Add indication if there are more quizzes
    if (quizzes.length > 5) {
      message += `\n\n<i>...and ${quizzes.length - 5} more quiz${quizzes.length - 5 !== 1 ? 'zes' : ''}.</i>`;
    }

    // Create quiz action buttons
    const quizButtons = [];

    // Create buttons for displayed quizzes
    displayQuizzes.forEach((quiz) => {
      quizButtons.push([
        Markup.button.callback(
          `${UI.ICONS.PLAY} Start "${quiz.title.substring(0, 15)}${quiz.title.length > 15 ? '...' : ''}"`,
          `start_quiz_${quiz.id}`
        ),
      ]);
      
      quizButtons.push([
        Markup.button.callback(
          `${UI.ICONS.EDIT} Edit`,
          `edit_quiz_${quiz.id}`
        ),
        Markup.button.callback(
          `${UI.ICONS.SHARE} Share`,
          `share_quiz_${quiz.id}`
        ),
        Markup.button.callback(
          `${UI.ICONS.DELETE} Delete`,
          `delete_quiz_${quiz.id}`
        ),
      ]);
    });
    
    // Show category filter buttons
    const categoryButtons = [];
    
    if (!searchQuery) {
      // Get unique categories
      const categories = await quizManager.getUserCategories(userId);
      
      // Add category filter buttons (up to 4 per row)
      if (categories.length > 0) {
        const rows = [];
        const buttonsPerRow = 2;
        
        for (let i = 0; i < categories.length; i += buttonsPerRow) {
          const row = [];
          for (let j = 0; j < buttonsPerRow && i + j < categories.length; j++) {
            const category = categories[i + j];
            row.push(
              Markup.button.callback(
                `${category.category} (${category.count})`,
                `filter_category_${category.category}`
              )
            );
          }
          if (row.length > 0) {
            rows.push(row);
          }
        }
        
        if (rows.length > 0) {
          categoryButtons.push(...rows);
        }
      }
    }
    
    // Navigation and action buttons
    const navigationButtons = [
      [
        Markup.button.callback(
          `${UI.ICONS.CREATE} Create New Quiz`,
          "create_quiz"
        ),
        searchQuery || categoryFilter ? 
          Markup.button.callback(
            `${UI.ICONS.LIST} View All`,
            "my_quizzes"
          ) : 
          Markup.button.callback(
            `${UI.ICONS.SEARCH} Search`,
            "search_quizzes"
          ),
      ],
    ];
    
    if (searchQuery || categoryFilter) {
      navigationButtons[0].push(
        Markup.button.callback(
          `${UI.ICONS.CATEGORY} Categories`,
          "show_categories"
        )
      );
    }
    
    // If there are more quizzes than shown, add pagination
    if (quizzes.length > 5) {
      navigationButtons.push([
        Markup.button.callback(
          `Show More Quizzes (${quizzes.length - 5} remaining)`,
          "show_more_quizzes"
        ),
      ]);
    }
    
    // Combine all button sections
    const allButtons = [
      ...quizButtons,
      ...categoryButtons,
      ...navigationButtons,
    ];

    await ctx.replyWithHTML(message, Markup.inlineKeyboard(allButtons));
  } catch (error) {
    logger.error("Error in myQuizzesHandler:", error);
    await ctx.reply(
      `${UI.COLORS.ERROR} Couldn't retrieve your quizzes. Please try again later.`
    );
  }
}

/**
 * Handler for showing categories
 * @param {Object} ctx - Telegram context
 */
async function showCategoriesHandler(ctx) {
  try {
    const userId = ctx.from.id;
    await ctx.answerCbQuery("Loading categories...");
    
    // Get all user categories
    const categories = await quizManager.getUserCategories(userId);
    
    if (categories.length === 0) {
      await ctx.replyWithHTML(
        formatMessage(
          "No Categories Found",
          "You don't have any quizzes organized into categories yet.",
          UI.COLORS.INFO
        ),
        Markup.inlineKeyboard([
          [
            Markup.button.callback(
              `${UI.ICONS.LIST} Back to My Quizzes`,
              "my_quizzes"
            ),
          ],
        ])
      );
      return;
    }
    
    // Sort categories by count
    categories.sort((a, b) => b.count - a.count);
    
    // Create message
    let message = formatMessage(
      "Quiz Categories",
      `You have quizzes in the following categories:`,
      UI.ICONS.CATEGORY
    );
    
    categories.forEach((category, index) => {
      message += `\n\n<b>${index + 1}. ${category.category}</b>\n` +
        `${UI.ICONS.INFO} Contains ${category.count} quiz${category.count !== 1 ? 'zes' : ''}`;
    });
    
    // Create category filter buttons
    const buttons = [];
    const buttonsPerRow = 2;
    
    for (let i = 0; i < categories.length; i += buttonsPerRow) {
      const row = [];
      for (let j = 0; j < buttonsPerRow && i + j < categories.length; j++) {
        const category = categories[i + j];
        row.push(
          Markup.button.callback(
            `View ${category.category}`,
            `filter_category_${category.category}`
          )
        );
      }
      if (row.length > 0) {
        buttons.push(row);
      }
    }
    
    // Add navigation button
    buttons.push([
      Markup.button.callback(
        `${UI.ICONS.LIST} Back to My Quizzes`,
        "my_quizzes"
      ),
    ]);
    
    await ctx.replyWithHTML(message, Markup.inlineKeyboard(buttons));
  } catch (error) {
    logger.error("Error in showCategoriesHandler:", error);
    await ctx.answerCbQuery("An error occurred while loading categories");
    await ctx.reply(
      `${UI.COLORS.ERROR} Couldn't load categories. Please try again later.`
    );
  }
}

/**
 * Handler for category filter button
 * @param {Object} ctx - Telegram context
 */
async function filterCategoryHandler(ctx) {
  try {
    // Extract category from callback data
    const category = ctx.callbackQuery.data.replace("filter_category_", "");
    await ctx.answerCbQuery(`Showing quizzes in "${category}" category`);
    
    // Create a mock message to simulate a command with category parameter
    ctx.message = { 
      text: `/my_quizzes category=${category}`,
      from: ctx.from,
      chat: ctx.chat
    };
    
    // Call the main handler with the filter
    await myQuizzesHandler(ctx);
  } catch (error) {
    logger.error("Error in filterCategoryHandler:", error);
    await ctx.answerCbQuery("Failed to filter by category");
  }
}

/**
 * Search quizzes handler - Prompts for search term
 * @param {Object} ctx - Telegram context
 */
async function searchQuizzesHandler(ctx) {
  try {
    await ctx.answerCbQuery("Preparing search...");
    
    await ctx.replyWithHTML(
      formatMessage(
        "Search Your Quizzes",
        "Please enter a search term to find quizzes by title or content:",
        UI.ICONS.SEARCH
      ),
      Markup.inlineKeyboard([
        [
          Markup.button.callback(
            `${UI.ICONS.LIST} Back to My Quizzes`,
            "my_quizzes"
          ),
        ],
      ])
    );
    
    // Listen for next message as search query
    ctx.scene.state = { waitingForSearch: true };
  } catch (error) {
    logger.error("Error in searchQuizzesHandler:", error);
    await ctx.answerCbQuery("Failed to start search");
  }
}

/**
 * Shared with me command handler - Shows quizzes shared with the user
 * @param {Object} ctx - Telegram context
 */
async function sharedWithMeHandler(ctx) {
  try {
    const userId = ctx.from.id;
    const sharedQuizzes = await quizManager.getQuizzesSharedWithUser(userId);

    if (sharedQuizzes.length === 0) {
      const noQuizzesMessage = formatMessage(
        "No Shared Quizzes",
        "You don't have any quizzes shared with you yet!\n\n" +
          "When other users share their quizzes with you, they will appear here.",
        UI.COLORS.INFO
      );

      return await ctx.replyWithHTML(
        noQuizzesMessage,
        Markup.innoQuizzesMessage,
        Markup.inlineKeyboard([
          [
            Markup.button.callback(
              `${UI.ICONS.LIST} My Quizzes`,
              "my_quizzes"
            ),
          ],
        ])
      );
    }

    let message = formatMessage(
      "Quizzes Shared With You",
      "Here are the quizzes that have been shared with you:",
      UI.ICONS.SHARE
    );

    const quizButtons = [];

    sharedQuizzes.forEach((quiz, index) => {
      // Format creation date
      const createdDate = new Date(quiz.createdAt).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });

      // Get creator name if available
      const creatorName = quiz.creatorName || `User ${quiz.creator}`;

      message +=
        `\n\n<b>${index + 1}. ${quiz.title}</b>\n` +
        `${UI.ICONS.INFO} Questions: ${quiz.questions.length}\n` +
        `📂 Category: ${quiz.category || "Uncategorized"}\n` +
        `👤 Created by: ${creatorName}\n` +
        `📅 Created: ${createdDate}`;

      // Add buttons for each quiz (in groups of 2)
      quizButtons.push([
        Markup.button.callback(
          `${UI.ICONS.PLAY} Start`,
          `start_quiz_${quiz.id}`
        ),
        Markup.button.callback(
          `${UI.ICONS.CREATE} Copy to My Quizzes`,
          `copy_quiz_${quiz.id}`
        ),
      ]);
    });

    // Add navigation buttons at bottom
    quizButtons.push([
      Markup.button.callback(
        `${UI.ICONS.LIST} My Quizzes`,
        "my_quizzes"
      ),
    ]);

    await ctx.replyWithHTML(message, Markup.inlineKeyboard(quizButtons));
  } catch (error) {
    logger.error("Error in sharedWithMeHandler:", error);
    await ctx.reply(
      `${UI.COLORS.ERROR} Couldn't retrieve shared quizzes. Please try again later.`
    );
  }
}

/**
 * Share quiz handler - Share a quiz with other users
 * @param {Object} ctx - Telegram context
 */
async function shareQuizHandler(ctx) {
  try {
    // Extract quiz ID from callback data
    const quizId = ctx.callbackQuery.data.replace("share_quiz_", "");
    const userId = ctx.from.id;

    await ctx.answerCbQuery("Opening sharing options...");

    // Get quiz to verify ownership
    const quiz = await quizManager.getQuiz(quizId, userId);

    if (!quiz) {
      return await ctx.replyWithHTML(
        formatMessage(
          "Quiz Not Found",
          "The quiz you're trying to share could not be found or you don't have permission to share it.",
          UI.COLORS.ERROR
        )
      );
    }

    if (quiz.creator !== userId) {
      return await ctx.replyWithHTML(
        formatMessage(
          "Permission Denied",
          "You can only share quizzes that you've created.",
          UI.COLORS.ERROR
        )
      );
    }

    // Show sharing options
    await ctx.replyWithHTML(
      formatMessage(
        `Share Quiz: ${quiz.title}`,
        "Choose how you want to share this quiz:",
        UI.ICONS.SHARE
      ),
      Markup.inlineKeyboard([
        [
          Markup.button.callback(
            `${UI.ICONS.UNLOCK} Share Publicly`,
            `share_public_${quizId}`
          ),
        ],
        [
          Markup.button.callback(
            `${UI.ICONS.INFO} Generate Share Link`,
            `share_link_${quizId}`
          ),
        ],
        [
          Markup.button.callback(
            `${UI.ICONS.EDIT} Share Settings`,
            `share_settings_${quizId}`
          ),
        ],
        [
          Markup.button.callback(
            `${UI.ICONS.BACK} Back to Quiz`,
            `view_quiz_${quizId}`
          ),
        ],
      ])
    );
  } catch (error) {
    logger.error("Error in shareQuizHandler:", error);
    await ctx.answerCbQuery(
      `${UI.COLORS.ERROR} Failed to open sharing options`
    );
    await ctx.reply(
      `${UI.COLORS.ERROR} An error occurred while processing your request.`
    );
  }
}

/**
 * Handle public sharing of a quiz
 * @param {Object} ctx - Telegram context
 */
async function shareQuizPublicHandler(ctx) {
  try {
    // Extract quiz ID from callback data
    const quizId = ctx.callbackQuery.data.replace("share_public_", "");
    const userId = ctx.from.id;

    await ctx.answerCbQuery("Setting quiz to public...");

    // Update the quiz to be publicly shared
    const result = await quizManager.shareQuiz(quizId, userId, true);

    if (result.success) {
      // Generate a shareable link
      const botUsername = ctx.botInfo.username;
      const shareLink = `https://t.me/${botUsername}?start=quiz_${quizId}`;

      await ctx.replyWithHTML(
        formatMessage(
          "Quiz Shared Publicly",
          `Your quiz is now publicly shared. Anyone with the link can access it.\n\n` +
            `<b>Share this link:</b>\n` +
            `${shareLink}\n\n` +
            `<b>Or use this command in a group:</b>\n` +
            `/start_quiz ${quizId}`,
          UI.COLORS.SUCCESS
        ),
        Markup.inlineKeyboard([
          [
            Markup.button.callback(
              `${UI.ICONS.EDIT} Share Settings`,
              `share_settings_${quizId}`
            ),
          ],
          [
            Markup.button.callback(
              `${UI.ICONS.BACK} Back to My Quizzes`,
              "my_quizzes"
            ),
          ],
        ])
      );
    } else {
      await ctx.replyWithHTML(
        formatMessage(
          "Sharing Failed",
          result.message,
          UI.COLORS.ERROR
        )
      );
    }
  } catch (error) {
    logger.error("Error in shareQuizPublicHandler:", error);
    await ctx.answerCbQuery(`${UI.COLORS.ERROR} Failed to share quiz`);
    await ctx.reply(
      `${UI.COLORS.ERROR} An error occurred while sharing the quiz.`
    );
  }
}

/**
 * Handle generating a share link for a quiz
 * @param {Object} ctx - Telegram context
 */
async function shareQuizLinkHandler(ctx) {
  try {
    // Extract quiz ID from callback data
    const quizId = ctx.callbackQuery.data.replace("share_link_", "");
    const userId = ctx.from.id;

    await ctx.answerCbQuery("Generating share link...");

    // Verify quiz ownership
    const quiz = await quizManager.getQuiz(quizId, userId);

    if (!quiz || quiz.creator !== userId) {
      return await ctx.replyWithHTML(
        formatMessage(
          "Permission Denied",
          "You can only generate share links for quizzes that you've created.",
          UI.COLORS.ERROR
        )
      );
    }

    // Generate a shareable link
    const botUsername = ctx.botInfo.username;
    const shareLink = `https://t.me/${botUsername}?start=quiz_${quizId}`;

    // If the quiz isn't already shared, make it public
    if (!quiz.shared) {
      await quizManager.shareQuiz(quizId, userId, true);
    }

    await ctx.replyWithHTML(
      formatMessage(
        "Quiz Share Link",
        `Share this link to give others access to your quiz "${quiz.title}":\n\n` +
          `<b>${shareLink}</b>\n\n` +
          `<b>Or use this command in a group:</b>\n` +
          `/start_quiz ${quizId}`,
        UI.ICONS.INFO
      ),
      Markup.inlineKeyboard([
        [
          Markup.button.callback(
            `${UI.ICONS.EDIT} Share Settings`,
            `share_settings_${quizId}`
          ),
        ],
        [
          Markup.button.callback(
            `${UI.ICONS.BACK} Back to My Quizzes`,
            "my_quizzes"
          ),
        ],
      ])
    );
  } catch (error) {
    logger.error("Error in shareQuizLinkHandler:", error);
    await ctx.answerCbQuery(
      `${UI.COLORS.ERROR} Failed to generate share link`
    );
    await ctx.reply(
      `${UI.COLORS.ERROR} An error occurred while generating the share link.`
    );
  }
}

/**
 * Handle share settings for a quiz
 * @param {Object} ctx - Telegram context
 */
async function shareSettingsHandler(ctx) {
  try {
    // Extract quiz ID from callback data
    const quizId = ctx.callbackQuery.data.replace("share_settings_", "");
    const userId = ctx.from.id;

    await ctx.answerCbQuery("Opening share settings...");

    // Verify quiz ownership
    const quiz = await quizManager.getQuiz(quizId, userId);

    if (!quiz || quiz.creator !== userId) {
      return await ctx.replyWithHTML(
        formatMessage(
          "Permission Denied",
          "You can only modify share settings for quizzes that you've created.",
          UI.COLORS.ERROR
        )
      );
    }

    // Format current share status
    let shareStatus = "Private (not shared)";
    if (quiz.shared) {
      shareStatus = "Public (anyone can access)";
    } else if (Array.isArray(quiz.sharedWith) && quiz.sharedWith.length > 0) {
      shareStatus = `Shared with ${quiz.sharedWith.length} specific user(s)`;
    }

    await ctx.replyWithHTML(
      formatMessage(
        `Share Settings: ${quiz.title}`,
        `Current status: <b>${shareStatus}</b>\n\n` +
          `Choose an option to modify sharing:`,
        UI.ICONS.EDIT
      ),
      Markup.inlineKeyboard([
        [
          Markup.button.callback(
            quiz.shared ? "✅ Public (On)" : "⬜ Public (Off)",
            `toggle_public_${quizId}`
          ),
        ],
        [
          Markup.button.callback(
            `${UI.ICONS.INFO} Generate Share Link`,
            `share_link_${quizId}`
          ),
        ],
        quiz.shared || (Array.isArray(quiz.sharedWith) && quiz.sharedWith.length > 0)
          ? [
              Markup.button.callback(
                `${UI.ICONS.LOCK} Make Private (Remove All Sharing)`,
                `make_private_${quizId}`
              ),
            ]
          : [],
        [
          Markup.button.callback(
            `${UI.ICONS.BACK} Back to My Quizzes`,
            "my_quizzes"
          ),
        ],
      ].filter(Boolean)) // Filter out empty arrays
    );
  } catch (error) {
    logger.error("Error in shareSettingsHandler:", error);
    await ctx.answerCbQuery(
      `${UI.COLORS.ERROR} Failed to load share settings`
    );
    await ctx.reply(
      `${UI.COLORS.ERROR} An error occurred while loading the share settings.`
    );
  }
}

/**
 * Toggle public sharing for a quiz
 * @param {Object} ctx - Telegram context
 */
async function togglePublicHandler(ctx) {
  try {
    // Extract quiz ID from callback data
    const quizId = ctx.callbackQuery.data.replace("toggle_public_", "");
    const userId = ctx.from.id;

    // Verify quiz ownership
    const quiz = await quizManager.getQuiz(quizId, userId);

    if (!quiz || quiz.creator !== userId) {
      await ctx.answerCbQuery("Permission denied: You don't own this quiz");
      return;
    }

    // Toggle public sharing
    const newStatus = !quiz.shared;
    const result = await quizManager.shareQuiz(quizId, userId, newStatus);

    if (result.success) {
      await ctx.answerCbQuery(
        newStatus
          ? "Quiz is now public"
          : "Quiz is no longer public"
      );
      
      // Refresh share settings view
      await shareSettingsHandler(ctx);
    } else {
      await ctx.answerCbQuery(`Failed: ${result.message}`);
    }
  } catch (error) {
    logger.error("Error in togglePublicHandler:", error);
    await ctx.answerCbQuery("An error occurred");
  }
}

/**
 * Make a quiz completely private
 * @param {Object} ctx - Telegram context
 */
async function makePrivateHandler(ctx) {
  try {
    // Extract quiz ID from callback data
    const quizId = ctx.callbackQuery.data.replace("make_private_", "");
    const userId = ctx.from.id;

    await ctx.answerCbQuery("Making quiz private...");

    // Verify quiz ownership
    const quiz = await quizManager.getQuiz(quizId, userId);

    if (!quiz || quiz.creator !== userId) {
      return await ctx.replyWithHTML(
        formatMessage(
          "Permission Denied",
          "You can only modify sharing for quizzes that you've created.",
          UI.COLORS.ERROR
        )
      );
    }

    // Remove all sharing
    const result = await quizManager.unshareQuiz(quizId, userId);

    if (result.success) {
      await ctx.replyWithHTML(
        formatMessage(
          "Quiz Is Now Private",
          `Your quiz "${quiz.title}" is now private and is no longer shared with anyone.`,
          UI.COLORS.SUCCESS
        ),
        Markup.inlineKeyboard([
          [
            Markup.button.callback(
              `${UI.ICONS.BACK} Back to My Quizzes`,
              "my_quizzes"
            ),
          ],
        ])
      );
    } else {
      await ctx.replyWithHTML(
        formatMessage(
          "Action Failed",
          result.message,
          UI.COLORS.ERROR
        )
      );
    }
  } catch (error) {
    logger.error("Error in makePrivateHandler:", error);
    await ctx.answerCbQuery(
      `${UI.COLORS.ERROR} Failed to make quiz private`
    );
    await ctx.reply(
      `${UI.COLORS.ERROR} An error occurred while updating the quiz.`
    );
  }
}

/**
 * Copy a shared quiz to user's library
 * @param {Object} ctx - Telegram context
 */
async function copyQuizHandler(ctx) {
  try {
    // Extract quiz ID from callback data
    const quizId = ctx.callbackQuery.data.replace("copy_quiz_", "");
    const userId = ctx.from.id;

    await ctx.answerCbQuery("Copying quiz to your library...");

    // Copy the quiz
    const result = await quizManager.copyQuiz(quizId, userId);

    if (result.success) {
      await ctx.replyWithHTML(
        formatMessage(
          "Quiz Copied Successfully",
          `The quiz has been copied to your library. You can now edit and use it as your own.`,
          UI.COLORS.SUCCESS
        ),
        Markup.inlineKeyboard([
          [
            Markup.button.callback(
              `${UI.ICONS.LIST} Go to My Quizzes`,
              "my_quizzes"
            ),
          ],
          [
            Markup.button.callback(
              `${UI.ICONS.EDIT} Edit New Quiz`,
              `edit_quiz_${result.newQuizId}`
            ),
          ],
        ])
      );
    } else {
      await ctx.replyWithHTML(
        formatMessage(
          "Copy Failed",
          result.message,
          UI.COLORS.ERROR
        )
      );
    }
  } catch (error) {
    logger.error("Error in copyQuizHandler:", error);
    await ctx.answerCbQuery(`${UI.COLORS.ERROR} Failed to copy quiz`);
    await ctx.reply(
      `${UI.COLORS.ERROR} An error occurred while copying the quiz.`
    );
  }
}

/**
 * Show information about sharing quizzes
 * @param {Object} ctx - Telegram context
 */
async function showShareInfoHandler(ctx) {
  try {
    await ctx.answerCbQuery();
    
    await ctx.replyWithHTML(
      formatMessage(
        "Sharing Your Quizzes",
        `With Zano Quiz, you can share your quizzes with others in several ways:\n\n` +
        `<b>1. Public Sharing</b>\n` +
        `Make your quiz available to anyone with the link.\n\n` +
        `<b>2. Share Links</b>\n` +
        `Generate a link that you can send to friends, post in chats, or share on social media.\n\n` +
        `<b>3. Group Play</b>\n` +
        `Start your quiz in any Telegram group where you're an admin.\n\n` +
        `<b>Privacy Controls</b>\n` +
        `You can make any shared quiz private again at any time.\n\n` +
        `To share a quiz, go to My Quizzes and click the Share button next to any quiz you've created.`,
        UI.ICONS.SHARE
      ),
      Markup.inlineKeyboard([
        [
          Markup.button.callback(
            `${UI.ICONS.LIST} My Quizzes`,
            "my_quizzes"
          ),
        ],
        [
          Markup.button.callback(
            `${UI.ICONS.BACK} Back to Help`,
            "show_help"
          ),
        ],
      ])
    );
  } catch (error) {
    logger.error("Error in showShareInfoHandler:", error);
    await ctx.answerCbQuery("Failed to show information");
  }
}

/**
 * Start quiz command handler - Initiates a quiz in a group
 * @param {Object} ctx - Telegram context
 */
async function startQuizHandler(ctx) {
  try {
    const chatId = ctx.chat.id;
    const userId = ctx.from.id;

    // Check if in a group
    if (ctx.chat.type === "private") {
      return await ctx.replyWithHTML(
        formatMessage(
          "Group Quizzes Only",
          "Quizzes can only be started in groups. Add me to a group and try again!\n\n" +
            "Alternatively, use /my_quizzes to see your saved quizzes that you can start in groups.",
          UI.COLORS.WARNING
        ),
        Markup.inlineKeyboard([
          [Markup.button.callback(`${UI.ICONS.LIST} My Quizzes`, "my_quizzes")],
        ])
      );
    }

    // Check if user is admin
    const isAdmin = await quiz.isAdmin(ctx, chatId, userId);
    if (!isAdmin) {
      return await ctx.replyWithHTML(
        formatMessage(
          "Permission Denied",
          "Only group administrators can start quizzes in this group.",
          UI.COLORS.DANGER
        )
      );
    }

    // Check for quiz ID in command
    const args = ctx.message.text.split(" ");
    if (args.length < 2) {
      // No quiz ID provided, show user's quizzes
      const quizzes = await quizManager.getQuizzesByCreator(userId);

      if (quizzes.length === 0) {
        return await ctx.replyWithHTML(
          formatMessage(
            "No Quizzes Available",
            "You need to create a quiz first!\n\n" +
              "Use /create_quiz in a private chat with me to create a quiz.",
            UI.COLORS.WARNING
          ),
          Markup.inlineKeyboard([
            [
              Markup.button.url(
                `${UI.ICONS.CREATE} Create Quiz`,
                `https://t.me/${ctx.botInfo.username}`
              ),
            ],
          ])
        );
      }

      let message = formatMessage(
        "Select a Quiz",
        "Choose a quiz to start in this group:",
        UI.ICONS.PLAY
      );

      const quizButtons = [];
      quizzes.forEach((quiz, index) => {
        message +=
          `\n\n<b>${index + 1}. ${quiz.title}</b>\n` +
          `${UI.ICONS.INFO} ${quiz.questions.length} questions\n` +
          `📂 Category: ${quiz.category || "Uncategorized"}`;

        quizButtons.push([
          Markup.button.callback(
            `${UI.ICONS.PLAY} Start "${quiz.title.substring(0, 20)}${quiz.title.length > 20 ? '...' : ''}"`,
            `start_quiz_${quiz.id}`
          ),
        ]);
      });

      return await ctx.replyWithHTML(
        message,
        Markup.inlineKeyboard(quizButtons)
      );
    }

    // Quiz ID provided
    const quizId = args[1];
    return await startQuizById(ctx, chatId, quizId);
  } catch (error) {
    logger.error("Error in startQuizHandler:", error);
    await ctx.reply(
      `${UI.COLORS.ERROR} Failed to start quiz. Please try again later.`
    );
  }
}

/**
 * Start quiz from button callback
 * @param {Object} ctx - Telegram context
 */
async function startQuizFromIdHandler(ctx) {
  try {
    // Extract quiz ID from callback data
    const quizId = ctx.callbackQuery.data.replace("start_quiz_", "");
    const chatId = ctx.chat.id;

    await ctx.answerCbQuery("Loading quiz...");

    // Check if in private chat
    if (ctx.chat.type === "private") {
      return await ctx.replyWithHTML(
        formatMessage(
          "Group Quizzes Only",
          `Quizzes can only be started in groups. Add me to a group and use:\n\n` +
            `/start_quiz ${quizId}`,
          UI.COLORS.WARNING
        )
      );
    }

    // Check if user is admin
    const isAdmin = await quiz.isAdmin(ctx, chatId, ctx.from.id);
    if (!isAdmin) {
      return await ctx.replyWithHTML(
        formatMessage(
          "Permission Denied",
          "Only group administrators can start quizzes in this group.",
          UI.COLORS.DANGER
        )
      );
    }

    return await startQuizById(ctx, chatId, quizId);
  } catch (error) {
    logger.error("Error in startQuizFromIdHandler:", error);
    await ctx.answerCbQuery(`${UI.COLORS.ERROR} Failed to start quiz`);
    await ctx.reply(
      `${UI.COLORS.ERROR} Failed to start quiz. Please try again later.`
    );
  }
}

/**
 * Helper to start quiz by ID
 * @param {Object} ctx - Telegram context
 * @param {number} chatId - Chat ID
 * @param {string} quizId - Quiz ID
 */
async function startQuizById(ctx, chatId, quizId) {
  try {
    // Check for existing quiz
    const activeQuiz = quiz.getQuizStatus(chatId);
    if (activeQuiz && activeQuiz.status !== "completed") {
      return await ctx.replyWithHTML(
        formatMessage(
          "Quiz Already Active",
          "A quiz is already running in this group! Please wait for it to finish or use /end_quiz to terminate it.",
          UI.COLORS.WARNING
        )
      );
    }

    // Get quiz data with access check
    const userId = ctx.from.id;
    const quizData = await quizManager.getQuiz(quizId, userId);
    
    if (!quizData) {
      return await ctx.replyWithHTML(
        formatMessage(
          "Quiz Not Found",
          "The requested quiz could not be found or you don't have permission to access it.",
          UI.COLORS.ERROR
        )
      );
    }

    // Show loading message
    await ctx.replyWithHTML(
      formatMessage(
        "Starting Quiz",
        `Preparing "${quizData.title}" for this group...\nGet ready to play!`,
        UI.ICONS.TIMER
      )
    );

    // Load quiz into memory and start it
    const result = await quiz.loadAndStartQuiz(ctx, chatId, quizData);

    if (!result.success) {
      await ctx.replyWithHTML(
        formatMessage("Error Starting Quiz", result.message, UI.COLORS.ERROR)
      );
    }

    return result;
  } catch (error) {
    logger.error("Error in startQuizById:", error);
    await ctx.replyWithHTML(
      formatMessage(
        "Quiz Error",
        "An error occurred while starting the quiz. Please try again later.",
        UI.COLORS.ERROR
      )
    );
  }
}

/**
 * End quiz command handler
 * @param {Object} ctx - Telegram context
 */
async function endQuizHandler(ctx) {
  try {
    const chatId = ctx.chat.id;
    const userId = ctx.from.id;

    // Check if in a group
    if (ctx.chat.type === "private") {
      return await ctx.replyWithHTML(
        formatMessage(
          "Group Quizzes Only",
          "Quizzes can only be ended in groups.",
          UI.COLORS.WARNING
        )
      );
    }

    // Check if user is admin
    const isAdmin = await quiz.isAdmin(ctx, chatId, userId);
    if (!isAdmin) {
      return await ctx.replyWithHTML(
        formatMessage(
          "Permission Denied",
          "Only group administrators can end quizzes in this group.",
          UI.COLORS.DANGER
        )
      );
    }

    // End the quiz
    const result = await quiz.endQuiz(ctx, chatId);

    if (!result.success) {
      await ctx.replyWithHTML(
        formatMessage("End Quiz Error", result.message, UI.COLORS.ERROR)
      );
    }

    return result;
  } catch (error) {
    logger.error("Error in endQuizHandler:", error);
    await ctx.reply(
      `${UI.COLORS.ERROR} Failed to end quiz. Please try again later.`
    );
  }
}

/**
 * Delete quiz handler
 * @param {Object} ctx - Telegram context
 */
async function deleteQuizHandler(ctx) {
  try {
    // Extract quiz ID from callback data
    const quizId = ctx.callbackQuery.data.replace("delete_quiz_", "");
    const userId = ctx.from.id;

    // Get quiz title for confirmation
    const quizData = await quizManager.getQuiz(quizId, userId);

    if (!quizData) {
      await ctx.answerCbQuery("Quiz not found!");
      return await ctx.reply(`${UI.COLORS.ERROR} This quiz no longer exists.`);
    }

    // Confirm deletion
    await ctx.answerCbQuery("Confirming deletion...");

    await ctx.replyWithHTML(
      formatMessage(
        "Confirm Deletion",
        `Are you sure you want to delete the quiz "<b>${quizData.title}</b>"?\n\nThis action cannot be undone.`,
        UI.COLORS.DANGER
      ),
      Markup.inlineKeyboard([
        [
          Markup.button.callback(
            `${UI.ICONS.DELETE} Yes, Delete Quiz`,
            `confirm_delete_${quizId}`
          ),
          Markup.button.callback("Cancel", "my_quizzes"),
        ],
      ])
    );
  } catch (error) {
    logger.error("Error in deleteQuizHandler:", error);
    await ctx.answerCbQuery(
      `${UI.COLORS.ERROR} Failed to process deletion request`
    );
    await ctx.reply(
      `${UI.COLORS.ERROR} An error occurred while processing your request.`
    );
  }
}

/**
 * Confirm quiz deletion handler
 * @param {Object} ctx - Telegram context
 */
async function confirmDeleteQuizHandler(ctx) {
  try {
    // Extract quiz ID from callback data
    const quizId = ctx.callbackQuery.data.replace("confirm_delete_", "");
    const userId = ctx.from.id;

    await ctx.answerCbQuery("Deleting quiz...");

    // Delete the quiz
    const result = await quizManager.deleteQuiz(quizId, userId);

    if (result.success) {
      await ctx.replyWithHTML(
        formatMessage(
          "Quiz Deleted",
          "Your quiz has been successfully deleted.",
          UI.COLORS.SUCCESS
        )
      );
      // Refresh my quizzes view
      await myQuizzesHandler(ctx);
    } else {
      await ctx.replyWithHTML(
        formatMessage("Deletion Error", result.message, UI.COLORS.ERROR)
      );
    }
  } catch (error) {
    logger.error("Error in confirmDeleteQuizHandler:", error);
    await ctx.answerCbQuery(`${UI.COLORS.ERROR} Failed to delete quiz`);
    await ctx.reply(
      `${UI.COLORS.ERROR} An error occurred while deleting the quiz.`
    );
  }
}

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
  if (ctx.chat.type === 'private') {
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
          formatMessage(
            "Admin Permission Required",
            `Sorry, only group administrators can use the /${command} command.`,
            UI.COLORS.DANGER
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
 * Edit quiz handler
 * @param {Object} ctx - Telegram context
 */
async function editQuizHandler(ctx) {
  try {
    // Extract quiz ID from callback data
    const quizId = ctx.callbackQuery.data.replace("edit_quiz_", "");
    const userId = ctx.from.id;
    
    // Get quiz to verify ownership
    const quiz = await quizManager.getQuiz(quizId, userId);
    
    if (!quiz) {
      await ctx.answerCbQuery("Quiz not found!");
      return await ctx.reply(`${UI.COLORS.ERROR} This quiz no longer exists.`);
    }
    
    if (quiz.creator !== userId) {
      await ctx.answerCbQuery("Permission denied!");
      return await ctx.reply(`${UI.COLORS.ERROR} You can only edit quizzes that you've created.`);
    }

    await ctx.answerCbQuery("Opening quiz editor...");

    // Show edit options
    await ctx.replyWithHTML(
      formatMessage(
        `Edit Quiz: ${quiz.title}`,
        `What would you like to edit?\n\n` +
        `• Title: "${quiz.title}"\n` +
        `• Category: ${quiz.category || "Uncategorized"}\n` +
        `• Questions: ${quiz.questions.length}\n` +
        `• Time per question: ${quiz.settings?.questionTime || 15} seconds`,
        UI.ICONS.EDIT
      ),
      Markup.inlineKeyboard([
        [
          Markup.button.callback(
            `${UI.ICONS.EDIT} Edit Title`,
            `edit_title_${quizId}`
          ),
          Markup.button.callback(
            `${UI.ICONS.CATEGORY} Change Category`,
            `edit_category_${quizId}`
          ),
        ],
        [
          Markup.button.callback(
            `${UI.ICONS.TIMER} Change Timer`,
            `edit_timer_${quizId}`
          ),
          Markup.button.callback(
            `${UI.ICONS.CREATE} Edit Questions`,
            `edit_questions_${quizId}`
          ),
        ],
        [
          Markup.button.callback(
            `${UI.ICONS.BACK} Back to My Quizzes`,
            "my_quizzes"
          ),
        ],
      ])
    );
  } catch (error) {
    logger.error("Error in editQuizHandler:", error);
    await ctx.answerCbQuery(`${UI.COLORS.ERROR} Failed to process request`);
    await ctx.reply(
      `${UI.COLORS.ERROR} An error occurred while processing your request.`
    );
  }
}

/**
 * View start instructions handler
 * @param {Object} ctx - Telegram context
 */
async function viewStartInstructionsHandler(ctx) {
  try {
    // Extract quiz ID from callback data
    const quizId = ctx.callbackQuery.data.replace("view_start_instructions_", "");
    
    await ctx.answerCbQuery("Loading instructions...");
    
    await ctx.replyWithHTML(
      formatMessage(
        "How to Start This Quiz in a Group",
        `To play this quiz in a Telegram group:\n\n` +
        `1. Add this bot (@${ctx.botInfo.username}) to your group\n` +
        `2. Make sure the bot is an admin (or has permission to send messages)\n` +
        `3. Send this command in the group:\n\n` +
        `/start_quiz ${quizId}\n\n` +
        `You must be a group admin to start quizzes.`,
        UI.ICONS.INFO
      ),
      Markup.inlineKeyboard([
        [
          Markup.button.callback(
            `${UI.ICONS.BACK} Back`,
            `view_quiz_${quizId}`
          ),
        ],
      ])
    );
  } catch (error) {
    logger.error("Error in viewStartInstructionsHandler:", error);
    await ctx.answerCbQuery("Failed to load instructions");
  }
}

/**
 * Edit quiz title handler
 * @param {Object} ctx - Telegram context
 */
async function editTitleHandler(ctx) {
  try {
    // Extract quiz ID from callback data
    const quizId = ctx.callbackQuery.data.replace("edit_title_", "");
    
    await ctx.answerCbQuery("Enter new title...");
    
    // Save quiz ID in session for title update
    ctx.session.editingTitleForQuiz = quizId;
    
    await ctx.replyWithHTML(
      formatMessage(
        "Edit Quiz Title",
        `Please enter a new title for your quiz.\n\n` +
        `The title should be between 3-100 characters.`,
        UI.ICONS.EDIT
      )
    );
  } catch (error) {
    logger.error("Error in editTitleHandler:", error);
    await ctx.answerCbQuery("Failed to start title editing");
  }
}

/**
 * Process title update message
 * @param {Object} ctx - Telegram context
 */
async function processTitleUpdateHandler(ctx) {
  try {
    const quizId = ctx.session.editingTitleForQuiz;
    const userId = ctx.from.id;
    const newTitle = ctx.message.text.trim();
    
    // Validate title
    if (newTitle.length < 3 || newTitle.length > 100) {
      return await ctx.reply(
        `${UI.COLORS.ERROR} Title must be between 3-100 characters. Please try again.`
      );
    }
    
    // Update the quiz
    const result = await quizManager.updateQuiz(quizId, { title: newTitle }, userId);
    
    if (result.success) {
      await ctx.replyWithHTML(
        formatMessage(
          "Title Updated",
          `Your quiz title has been changed to:\n\n` +
          `"${newTitle}"`,
          UI.COLORS.SUCCESS
        ),
        Markup.inlineKeyboard([
          [
            Markup.button.callback(
              `${UI.ICONS.EDIT} Continue Editing`,
              `edit_quiz_${quizId}`
            ),
          ],
          [
            Markup.button.callback(
              `${UI.ICONS.LIST} Back to My Quizzes`,
              "my_quizzes"
            ),
          ],
        ])
      );
      
      // Clear editing state
      delete ctx.session.editingTitleForQuiz;
    } else {
      await ctx.replyWithHTML(
        formatMessage(
          "Update Failed",
          result.message,
          UI.COLORS.ERROR
        )
      );
    }
  } catch (error) {
    logger.error("Error in processTitleUpdateHandler:", error);
    await ctx.reply(
      `${UI.COLORS.ERROR} An error occurred while updating the title.`
    );
    // Clear editing state
    delete ctx.session.editingTitleForQuiz;
  }
}

/**
 * Edit category handler
 * @param {Object} ctx - Telegram context
 */
async function editCategoryHandler(ctx) {
  try {
    // Extract quiz ID from callback data
    const quizId = ctx.callbackQuery.data.replace("edit_category_", "");
    
    await ctx.answerCbQuery("Choose new category...");
    
    // Get quiz to show current category
    const quiz = await quizManager.getQuiz(quizId, ctx.from.id);
    
    if (!quiz) {
      return await ctx.reply(
        `${UI.COLORS.ERROR} Quiz not found or you don't have permission to edit it.`
      );
    }
    
    // Create category buttons
    const buttons = [];
    const categoriesPerRow = 2;
    
    // Add categories from the list
    for (let i = 0; i < QUIZ_CATEGORIES.length; i += categoriesPerRow) {
      const row = [];
      for (let j = 0; j < categoriesPerRow && i + j < QUIZ_CATEGORIES.length; j++) {
        const category = QUIZ_CATEGORIES[i + j];
        // Highlight the current category
        const prefix = category === quiz.category ? "✅ " : "";
        row.push(
          Markup.button.callback(
            prefix + category,
            `set_category_${quizId}_${category}`
          )
        );
      }
      if (row.length > 0) {
        buttons.push(row);
      }
    }
    
    // Add back button
    buttons.push([
      Markup.button.callback(
        `${UI.ICONS.BACK} Back to Edit Menu`,
        `edit_quiz_${quizId}`
      ),
    ]);
    
    await ctx.replyWithHTML(
      formatMessage(
        "Edit Quiz Category",
        `Current category: <b>${quiz.category || "Uncategorized"}</b>\n\n` +
        `Select a new category for your quiz:`,
        UI.ICONS.CATEGORY
      ),
      Markup.inlineKeyboard(buttons)
    );
  } catch (error) {
    logger.error("Error in editCategoryHandler:", error);
    await ctx.answerCbQuery("Failed to load categories");
  }
}

/**
 * Set quiz category handler
 * @param {Object} ctx - Telegram context
 */
async function setCategoryHandler(ctx) {
  try {
    // Extract quiz ID and category from callback data
    const match = ctx.callbackQuery.data.match(/set_category_(.+)_(.+)/);
    if (!match) {
      await ctx.answerCbQuery("Invalid category selection");
      return;
    }
    
    const quizId = match[1];
    const newCategory = match[2];
    const userId = ctx.from.id;
    
    await ctx.answerCbQuery(`Setting category to ${newCategory}...`);
    
    // Update the quiz
    const result = await quizManager.updateQuiz(quizId, { category: newCategory }, userId);
    
    if (result.success) {
      await ctx.replyWithHTML(
        formatMessage(
          "Category Updated",
          `Your quiz category has been changed to:\n\n` +
          `"${newCategory}"`,
          UI.COLORS.SUCCESS
        ),
        Markup.inlineKeyboard([
          [
            Markup.button.callback(
              `${UI.ICONS.EDIT} Continue Editing`,
              `edit_quiz_${quizId}`
            ),
          ],
          [
            Markup.button.callback(
              `${UI.ICONS.LIST} Back to My Quizzes`,
              "my_quizzes"
            ),
          ],
        ])
      );
    } else {
      await ctx.replyWithHTML(
        formatMessage(
          "Update Failed",
          result.message,
          UI.COLORS.ERROR
        )
      );
    }
  } catch (error) {
    logger.error("Error in setCategoryHandler:", error);
    await ctx.answerCbQuery("Failed to update category");
  }
}

/**
 * Edit timer handler
 * @param {Object} ctx - Telegram context
 */
async function editTimerHandler(ctx) {
  try {
    // Extract quiz ID from callback data
    const quizId = ctx.callbackQuery.data.replace("edit_timer_", "");
    
    await ctx.answerCbQuery("Choose new timer setting...");
    
    // Get quiz to show current timer
    const quiz = await quizManager.getQuiz(quizId, ctx.from.id);
    
    if (!quiz) {
      return await ctx.reply(
        `${UI.COLORS.ERROR} Quiz not found or you don't have permission to edit it.`
      );
    }
    
    const currentTimer = quiz.settings?.questionTime || 15;
    
    await ctx.replyWithHTML(
      formatMessage(
        "Edit Question Timer",
        `Current timer: <b>${currentTimer} seconds</b> per question.\n\n` +
        `Select a new timer setting:`,
        UI.ICONS.TIMER
      ),
      Markup.inlineKeyboard([
        [
          Markup.button.callback("10s", `set_timer_${quizId}_10`),
          Markup.button.callback("15s", `set_timer_${quizId}_15`),
          Markup.button.callback("20s", `set_timer_${quizId}_20`),
        ],
        [
          Markup.button.callback("30s", `set_timer_${quizId}_30`),
          Markup.button.callback("45s", `set_timer_${quizId}_45`),
          Markup.button.callback("60s", `set_timer_${quizId}_60`),
        ],
        [
          Markup.button.callback("Custom", `custom_timer_${quizId}`),
        ],
        [
          Markup.button.callback(
            `${UI.ICONS.BACK} Back to Edit Menu`,
            `edit_quiz_${quizId}`
          ),
        ],
      ])
    );
  } catch (error) {
    logger.error("Error in editTimerHandler:", error);
    await ctx.answerCbQuery("Failed to load timer options");
  }
}

/**
 * Set timer handler
 * @param {Object} ctx - Telegram context
 */
async function setTimerHandler(ctx) {
  try {
    // Extract quiz ID and timer from callback data
    const match = ctx.callbackQuery.data.match(/set_timer_(.+)_(\d+)/);
    if (!match) {
      await ctx.answerCbQuery("Invalid timer selection");
      return;
    }
    
    const quizId = match[1];
    const newTimer = parseInt(match[2]);
    const userId = ctx.from.id;
    
    await ctx.answerCbQuery(`Setting timer to ${newTimer} seconds...`);
    
    // Update the quiz
    const result = await quizManager.updateQuiz(
      quizId, 
      { settings: { questionTime: newTimer, intermissionTime: 3 } }, 
      userId
    );
    
    if (result.success) {
      await ctx.replyWithHTML(
        formatMessage(
          "Timer Updated",
          `Your quiz timer has been changed to:\n\n` +
          `${newTimer} seconds per question`,
          UI.COLORS.SUCCESS
        ),
        Markup.inlineKeyboard([
          [
            Markup.button.callback(
              `${UI.ICONS.EDIT} Continue Editing`,
              `edit_quiz_${quizId}`
            ),
          ],
          [
            Markup.button.callback(
              `${UI.ICONS.LIST} Back to My Quizzes`,
              "my_quizzes"
            ),
          ],
        ])
      );
    } else {
      await ctx.replyWithHTML(
        formatMessage(
          "Update Failed",
          result.message,
          UI.COLORS.ERROR
        )
      );
    }
  } catch (error) {
    logger.error("Error in setTimerHandler:", error);
    await ctx.answerCbQuery("Failed to update timer");
  }
}

/**
 * Custom timer handler
 * @param {Object} ctx - Telegram context
 */
async function customTimerHandler(ctx) {
  try {
    // Extract quiz ID from callback data
    const quizId = ctx.callbackQuery.data.replace("custom_timer_", "");
    
    await ctx.answerCbQuery("Enter custom timer value...");
    
    // Save quiz ID in session for timer update
    ctx.session.editingTimerForQuiz = quizId;
    
    await ctx.replyWithHTML(
      formatMessage(
        "Enter Custom Timer",
        `Please enter a custom time in seconds.\n\n` +
        `The time should be between 5-60 seconds.`,
        UI.ICONS.TIMER
      )
    );
  } catch (error) {
    logger.error("Error in customTimerHandler:", error);
    await ctx.answerCbQuery("Failed to start custom timer editing");
  }
}

/**
 * Process timer update message
 * @param {Object} ctx - Telegram context
 */
async function processTimerUpdateHandler(ctx) {
  try {
    const quizId = ctx.session.editingTimerForQuiz;
    const userId = ctx.from.id;
    const timeText = ctx.message.text.trim();
    
    // Parse timer value
    const newTimer = parseInt(timeText);
    
    // Validate timer
    if (isNaN(newTimer) || newTimer < 5 || newTimer > 60) {
      return await ctx.reply(
        `${UI.COLORS.ERROR} Timer must be between 5-60 seconds. Please try again.`
      );
    }
    
    // Update the quiz
    const result = await quizManager.updateQuiz(
      quizId, 
      { settings: { questionTime: newTimer, intermissionTime: 3 } }, 
      userId
    );
    
    if (result.success) {
      await ctx.replyWithHTML(
        formatMessage(
          "Timer Updated",
          `Your quiz timer has been changed to:\n\n` +
          `${newTimer} seconds per question`,
          UI.COLORS.SUCCESS
        ),
        Markup.inlineKeyboard([
          [
            Markup.button.callback(
              `${UI.ICONS.EDIT} Continue Editing`,
              `edit_quiz_${quizId}`
            ),
          ],
          [
            Markup.button.callback(
              `${UI.ICONS.LIST} Back to My Quizzes`,
              "my_quizzes"
            ),
          ],
        ])
      );
      
      // Clear editing state
      delete ctx.session.editingTimerForQuiz;
    } else {
      await ctx.replyWithHTML(
        formatMessage(
          "Update Failed",
          result.message,
          UI.COLORS.ERROR
        )
      );
    }
  } catch (error) {
    logger.error("Error in processTimerUpdateHandler:", error);
    await ctx.reply(
      `${UI.COLORS.ERROR} An error occurred while updating the timer.`
    );
    // Clear editing state
    delete ctx.session.editingTimerForQuiz;
  }
}

/**
 * Edit questions handler
 * @param {Object} ctx - Telegram context
 */
async function editQuestionsHandler(ctx) {
  try {
    // Extract quiz ID from callback data
    const quizId = ctx.callbackQuery.data.replace("edit_questions_", "");
    
    await ctx.answerCbQuery("Loading question editor...");
    
    await ctx.replyWithHTML(
      formatMessage(
        "Edit Questions",
        `The question editing feature will be available in a future update.\n\n` +
        `For now, if you need to make significant changes to your questions, we recommend creating a new quiz.`,
        UI.ICONS.INFO
      ),
      Markup.inlineKeyboard([
        [
          Markup.button.callback(
            `${UI.ICONS.BACK} Back to Edit Menu`,
            `edit_quiz_${quizId}`
          ),
        ],
        [
          Markup.button.callback(
            `${UI.ICONS.CREATE} Create New Quiz`,
            "create_quiz"
          ),
        ],
      ])
    );
  } catch (error) {
    logger.error("Error in editQuestionsHandler:", error);
    await ctx.answerCbQuery("Failed to load question editor");
  }
}

/**
 * Show more quizzes handler for pagination
 * @param {Object} ctx - Telegram context
 */
async function showMoreQuizzesHandler(ctx) {
  try {
    await ctx.answerCbQuery("Loading more quizzes...");
    
    // For now, just redirect to my quizzes with a message that this feature is coming soon
    // In a full implementation, you'd store the current page in session and load more quizzes
    
    await ctx.replyWithHTML(
      formatMessage(
        "Coming Soon",
        `Enhanced quiz pagination will be available in a future update.\n\n` +
        `For now, you can use category filters or search to find specific quizzes.`,
        UI.ICONS.INFO
      ),
      Markup.inlineKeyboard([
        [
          Markup.button.callback(
            `${UI.ICONS.LIST} Back to My Quizzes`,
            "my_quizzes"
          ),
        ],
        [
          Markup.button.callback(
            `${UI.ICONS.SEARCH} Search Quizzes`,
            "search_quizzes"
          ),
        ],
      ])
    );
  } catch (error) {
    logger.error("Error in showMoreQuizzesHandler:", error);
    await ctx.answerCbQuery("Failed to load more quizzes");
  }
}

/**
 * Answer button handler
 * @param {Object} ctx - Telegram context
 */
async function answerHandler(ctx) {
  try {
    const chatId = ctx.chat.id;
    const userId = ctx.from.id;
    const userName = ctx.from.first_name || "Player";

    // Parse callback data
    const match = ctx.callbackQuery.data.match(/answer_(\d+)_(\d+)/);
    if (!match) {
      await ctx.answerCbQuery("Invalid answer format");
      return;
    }

    const questionIndex = parseInt(match[1]);
    const answerIndex = parseInt(match[2]);

    // Process answer with user info
    const result = await quiz.processAnswer(
      ctx,
      chatId,
      userId,
      questionIndex,
      answerIndex,
      userName
    );

    // Provide feedback via answerCbQuery
    if (result && result.correct) {
      await ctx.answerCbQuery("✅ Correct answer!");
    } else if (result && !result.correct) {
      await ctx.answerCbQuery("❌ Wrong answer!");
    } else {
      await ctx.answerCbQuery("Answer processed");
    }
  } catch (error) {
    logger.error("Error in answerHandler:", error);
    await ctx.answerCbQuery(`${UI.COLORS.ERROR} Error processing answer`);
  }
}

/**
 * Text handler for general input (including search queries)
 * @param {Object} ctx - Telegram context
 */
async function textHandler(ctx) {
  try {
    // Only process in private chats for direct input
    if (ctx.chat.type !== "private") {
      return;
    }
    
    // Check if we're waiting for a search query
    if (ctx.scene.state && ctx.scene.state.waitingForSearch) {
      // Handle search query
      const searchQuery = ctx.message.text.trim();
      
      if (searchQuery.length < 1) {
        await ctx.reply(
          `${UI.COLORS.ERROR} Please enter a valid search term.`
        );
        return;
      }
      
      // Clear waiting state
      ctx.scene.state.waitingForSearch = false;
      
      // Create a mock message to simulate a command with search parameter
      ctx.message.text = `/my_quizzes search=${searchQuery}`;
      
      // Call the main handler with the search
      await myQuizzesHandler(ctx);
      return;
    }
    
    // Check if we're waiting for a title update
    if (ctx.session.editingTitleForQuiz) {
      await processTitleUpdateHandler(ctx);
      return;
    }
    
    // Check if we're waiting for a timer update
    if (ctx.session.editingTimerForQuiz) {
      await processTimerUpdateHandler(ctx);
      return;
    }

    // Default help if no special handling needed
    await ctx.replyWithHTML(
      formatMessage(
        "Command Required",
        "To create a quiz, use the /create_quiz command to start the wizard.\n\n" +
          "To see your existing quizzes, use /my_quizzes.\n\n" +
          "To see quizzes shared with you, use /shared_quizzes.",
        UI.ICONS.INFO
      ),
      Markup.inlineKeyboard([
        [
          Markup.button.callback(
            `${UI.ICONS.CREATE} Create Quiz`,
            "create_quiz"
          ),
          Markup.button.callback(`${UI.ICONS.LIST} My Quizzes`, "my_quizzes"),
        ],
        [
          Markup.button.callback(`${UI.ICONS.SHARE} Shared Quizzes`, "shared_quizzes"),
          Markup.button.callback(`${UI.ICONS.INFO} Help`, "show_help"),
        ],
      ])
    );
  } catch (error) {
    logger.error("Error in textHandler:", error);
  }
}

/**
 * Button action mapper for handling button callbacks
 */
function setupButtonActions(bot) {
  // Main menu actions
  bot.action("start", startHandler);
  bot.action("create_quiz", createQuizHandler);
  bot.action("my_quizzes", myQuizzesHandler);
  bot.action("shared_quizzes", sharedWithMeHandler);
  bot.action("show_help", helpHandler);
  bot.action("show_play_info", async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.replyWithHTML(
      formatMessage(
        "How To Play",
        "To play a quiz:\n\n" +
          "1. Add me to your group\n" +
          "2. Use /start_quiz to begin\n" +
          "3. Select a quiz from your library\n" +
          "4. Players tap answer buttons\n" +
          "5. First correct answer wins points\n\n" +
          "Only group administrators can start and end quizzes.",
        UI.ICONS.PLAY
      ),
      Markup.inlineKeyboard([
        [Markup.button.callback("🏠 Back to Main Menu", "start")],
      ])
    );
  });
  bot.action("show_share_info", showShareInfoHandler);
  
  // Quiz management actions
  bot.action(/view_quiz_(.+)/, async (ctx) => {
    const quizId = ctx.callbackQuery.data.replace("view_quiz_", "");
    await ctx.answerCbQuery("Loading quiz details...");
    await handleDeepLinkQuiz(ctx, quizId);
  });
  bot.action(/view_start_instructions_(.+)/, viewStartInstructionsHandler);
  
  // Category and search actions
  bot.action("show_categories", showCategoriesHandler);
  bot.action(/filter_category_(.+)/, filterCategoryHandler);
  bot.action("search_quizzes", searchQuizzesHandler);
  bot.action("show_more_quizzes", showMoreQuizzesHandler);
  
  // Quiz editing actions
  bot.action(/edit_quiz_(.+)/, editQuizHandler);
  bot.action(/edit_title_(.+)/, editTitleHandler);
  bot.action(/edit_category_(.+)/, editCategoryHandler);
  bot.action(/set_category_(.+)_(.+)/, setCategoryHandler);
  bot.action(/edit_timer_(.+)/, editTimerHandler);
  bot.action(/set_timer_(.+)_(\d+)/, setTimerHandler);
  bot.action(/custom_timer_(.+)/, customTimerHandler);
  bot.action(/edit_questions_(.+)/, editQuestionsHandler);
  
  // Quiz sharing actions
  bot.action(/share_quiz_(.+)/, shareQuizHandler);
  bot.action(/share_public_(.+)/, shareQuizPublicHandler);
  bot.action(/share_link_(.+)/, shareQuizLinkHandler);
  bot.action(/share_settings_(.+)/, shareSettingsHandler);
  bot.action(/toggle_public_(.+)/, togglePublicHandler);
  bot.action(/make_private_(.+)/, makePrivateHandler);
  bot.action(/copy_quiz_(.+)/, copyQuizHandler);

  // Quiz deletion confirmation
  bot.action(/confirm_delete_(.+)/, confirmDeleteQuizHandler);

  return bot;
}

module.exports = {
  // Core handlers
  startHandler,
  helpHandler,
  createQuizHandler,
  startQuizHandler,
  endQuizHandler,
  myQuizzesHandler,
  sharedWithMeHandler,
  answerHandler,
  startQuizFromIdHandler,
  deleteQuizHandler,
  editQuizHandler,
  textHandler,

  // Quiz sharing handlers
  shareQuizHandler,
  shareQuizPublicHandler,
  shareQuizLinkHandler,
  shareSettingsHandler,
  togglePublicHandler,
  makePrivateHandler,
  copyQuizHandler,
  
  // Category and search handlers
  showCategoriesHandler,
  filterCategoryHandler,
  searchQuizzesHandler,
  
  // Quiz editing handlers
  editTitleHandler,
  processTitleUpdateHandler,
  editCategoryHandler,
  setCategoryHandler,
  editTimerHandler,
  setTimerHandler,
  customTimerHandler,
  processTimerUpdateHandler,
  editQuestionsHandler,


    // Admin middleware
    isGroupAdmin,
    adminRequiredMiddleware,

  // Additional functionality
  setupButtonActions,
  UI,
};