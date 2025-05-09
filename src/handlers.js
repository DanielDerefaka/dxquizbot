// Updated command and interaction handlers
const { Markup } = require('telegraf');
const quiz = require('./quiz');
const quizManager = require('./quizManager');
const logger = require('./logger');

/**
 * Constants for UI elements
 */
const UI = {
  ICONS: {
    WELCOME: '🎯',
    CREATE: '📝',
    PLAY: '🎮',
    LIST: '📚',
    DELETE: '🗑️',
    EDIT: '✏️',
    INFO: 'ℹ️',
    SUCCESS: '✅',
    ERROR: '❌',
    TIMER: '⏱️',
    STAR: '⭐',
    CROWN: '👑',
    MEDAL_GOLD: '🥇',
    MEDAL_SILVER: '🥈',
    MEDAL_BRONZE: '🥉',
  },
  COLORS: {
    PRIMARY: '🔵',
    SUCCESS: '🟢',
    WARNING: '🟡',
    DANGER: '🔴',
  },
  BUTTONS: {
    START: 'Start Quiz',
    DELETE: 'Delete',
    EDIT: 'Edit',
    BACK: 'Back',
  }
};

/**
 * Formats a message with proper styling and spacing using HTML
 * @param {string} title - The title of the message
 * @param {string} content - The content of the message
 * @param {string} icon - Optional icon to prefix the title
 * @returns {string} Formatted message in HTML
 */
function formatMessage(title, content, icon = '') {
  const titleText = icon ? `${icon} ${title}` : title;
  return `<b>${titleText}</b>\n\n${content}`;
}

/**
 * Start command handler - Welcome message
 * @param {Object} ctx - Telegram context
 */
async function startHandler(ctx) {
  const userName = ctx.from.first_name || 'there';
  const welcomeMessage = formatMessage(
    `Welcome to DXQuiz, ${userName}!`,
    `I'm your interactive quiz competition bot for Telegram groups.\n\n` +
    `${UI.ICONS.CREATE} Use /create_quiz to create a new custom quiz\n` +
    `${UI.ICONS.LIST} Use /my_quizzes to manage your saved quizzes\n` +
    `${UI.ICONS.PLAY} Add me to a group and use /start_quiz to play\n\n` +
    `Need help? Just type /help for more information.`,
    UI.ICONS.WELCOME
  );

  // Create welcome buttons
  const keyboard = Markup.inlineKeyboard([
    [Markup.button.callback(`${UI.ICONS.CREATE} Create New Quiz`, 'create_quiz')],
    [Markup.button.callback(`${UI.ICONS.LIST} My Quizzes`, 'my_quizzes')],
    [Markup.button.callback(`${UI.ICONS.INFO} Help`, 'show_help')]
  ]);

  try {
    await ctx.replyWithHTML(welcomeMessage, keyboard);
  } catch (error) {
    logger.error('Error in startHandler:', error);
    await ctx.reply('Welcome to DXQuiz! Use /help to see available commands.');
  }
}

/**
 * Help command handler - Shows comprehensive help information
 * @param {Object} ctx - Telegram context
 */
async function helpHandler(ctx) {
  const helpText = formatMessage(
    'DXQuiz Bot Help',
    `${UI.ICONS.CREATE} <b>Creating Quizzes:</b>\n` +
    `/create_quiz - Start the quiz creation wizard\n` +
    `/my_quizzes - View and manage your quizzes\n\n` +
    
    `${UI.ICONS.PLAY} <b>Playing Quizzes:</b>\n` +
    `/start_quiz - Start a quiz in a group (admin only)\n` +
    `/end_quiz - End the current quiz (admin only)\n\n` +
    
    `${UI.ICONS.INFO} <b>Quiz Creation Tips:</b>\n` +
    `• Give your quiz a descriptive name\n` +
    `• Set an appropriate timer (10-30 seconds works best)\n` +
    `• Create clear questions with one correct answer\n` +
    `• Add at least 5 questions for a good experience\n\n` +
    
    `${UI.ICONS.STAR} <b>Playing Tips:</b>\n` +
    `• First correct answer gets points\n` +
    `• Timer counts down for each question\n` +
    `• Final rankings are shown at the end\n\n` +
    
    `Need more help? Contact us at @DXQuizSupport`,
    UI.ICONS.INFO
  );

  // Add help navigation buttons
  const keyboard = Markup.inlineKeyboard([
    [Markup.button.callback(`${UI.ICONS.CREATE} Create Quiz`, 'create_quiz')],
    [Markup.button.callback(`${UI.ICONS.PLAY} Play Quiz`, 'show_play_info')],
    [Markup.button.callback(`🏠 Back to Main Menu`, 'start')]
  ]);

  try {
    await ctx.replyWithHTML(helpText, keyboard);
  } catch (error) {
    logger.error('Error in helpHandler:', error);
    await ctx.reply('An error occurred while showing help. Please try again.');
  }
}

/**
 * Create quiz command handler - Initiates quiz creation wizard
 * @param {Object} ctx - Telegram context
 */
async function createQuizHandler(ctx) {
  try {
    // Check if in private chat
    if (ctx.chat.type !== 'private') {
      return await ctx.reply(
        `${UI.ICONS.INFO} Quiz creation is only available in private chats. Please message me directly to create a quiz.`
      );
    }
    
    // Start the scene
    await ctx.scene.enter('create_quiz');
  } catch (error) {
    logger.error('Error in createQuizHandler:', error);
    await ctx.reply(`${UI.COLORS.ERROR} Couldn't start quiz creation. Please try again later.`);
  }
}

/**
 * My quizzes command handler - Shows user's saved quizzes
 * @param {Object} ctx - Telegram context
 */
async function myQuizzesHandler(ctx) {
  try {
    const userId = ctx.from.id;
    const quizzes = await quizManager.getQuizzesByCreator(userId);
    
    if (quizzes.length === 0) {
      const noQuizzesMessage = formatMessage(
        'No Quizzes Found',
        'You haven\'t created any quizzes yet!\n\n' +
        'Create your first quiz by clicking the button below.',
        UI.COLORS.INFO
      );
      
      return await ctx.replyWithHTML(
        noQuizzesMessage,
        Markup.inlineKeyboard([
          [Markup.button.callback(`${UI.ICONS.CREATE} Create New Quiz`, 'create_quiz')]
        ])
      );
    }
    
    let message = formatMessage(
      'Your Quizzes',
      'Here are all the quizzes you\'ve created:',
      UI.ICONS.LIST
    );
    
    const quizButtons = [];
    
    quizzes.forEach((quiz, index) => {
      // Format creation date
      const createdDate = new Date(quiz.createdAt).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
      
      message += `\n\n<b>${index + 1}. ${quiz.title}</b>\n` +
                `${UI.ICONS.INFO} Questions: ${quiz.questions.length}\n` +
                `📅 Created: ${createdDate}`;
      
      // Add buttons for each quiz (in groups of 2)
      quizButtons.push([
        Markup.button.callback(`${UI.ICONS.PLAY} Start`, `start_quiz_${quiz.id}`),
        Markup.button.callback(`${UI.ICONS.EDIT} Edit`, `edit_quiz_${quiz.id}`),
        Markup.button.callback(`${UI.ICONS.DELETE} Delete`, `delete_quiz_${quiz.id}`)
      ]);
    });
    
    // Add Create New Quiz button at the bottom
    quizButtons.push([
      Markup.button.callback(`${UI.ICONS.CREATE} Create New Quiz`, 'create_quiz')
    ]);
    
    await ctx.replyWithHTML(message, Markup.inlineKeyboard(quizButtons));
  } catch (error) {
    logger.error('Error in myQuizzesHandler:', error);
    await ctx.reply(`${UI.COLORS.ERROR} Couldn't retrieve your quizzes. Please try again later.`);
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
    if (ctx.chat.type === 'private') {
      return await ctx.replyWithHTML(
        formatMessage(
          'Group Quizzes Only',
          'Quizzes can only be started in groups. Add me to a group and try again!\n\n' +
          'Alternatively, use /my_quizzes to see your saved quizzes that you can start in groups.',
          UI.COLORS.WARNING
        ),
        Markup.inlineKeyboard([
          [Markup.button.callback(`${UI.ICONS.LIST} My Quizzes`, 'my_quizzes')]
        ])
      );
    }
    
    // Check if user is admin
    const isAdmin = await quiz.isAdmin(ctx, chatId, userId);
    if (!isAdmin) {
      return await ctx.replyWithHTML(
        formatMessage(
          'Permission Denied',
          'Only group administrators can start quizzes in this group.',
          UI.COLORS.DANGER
        )
      );
    }
    
    // Check for quiz ID in command
    const args = ctx.message.text.split(' ');
    if (args.length < 2) {
      // No quiz ID provided, show user's quizzes
      const quizzes = await quizManager.getQuizzesByCreator(userId);
      
      if (quizzes.length === 0) {
        return await ctx.replyWithHTML(
          formatMessage(
            'No Quizzes Available',
            'You need to create a quiz first!\n\n' +
            'Use /create_quiz in a private chat with me to create a quiz.',
            UI.COLORS.WARNING
          ),
          Markup.inlineKeyboard([
            [Markup.button.url(`${UI.ICONS.CREATE} Create Quiz`, `https://t.me/${ctx.botInfo.username}`)]
          ])
        );
      }
      
      let message = formatMessage(
        'Select a Quiz',
        'Choose a quiz to start in this group:',
        UI.ICONS.PLAY
      );
      
      const quizButtons = [];
      quizzes.forEach((quiz, index) => {
        message += `\n\n<b>${index + 1}. ${quiz.title}</b>\n` +
                  `${UI.ICONS.INFO} ${quiz.questions.length} questions`;
                  
        quizButtons.push([
          Markup.button.callback(`${UI.ICONS.PLAY} Start "${quiz.title}"`, `start_quiz_${quiz.id}`)
        ]);
      });
      
      return await ctx.replyWithHTML(message, Markup.inlineKeyboard(quizButtons));
    }
    
    // Quiz ID provided
    const quizId = args[1];
    return await startQuizById(ctx, chatId, quizId);
  } catch (error) {
    logger.error('Error in startQuizHandler:', error);
    await ctx.reply(`${UI.COLORS.ERROR} Failed to start quiz. Please try again later.`);
  }
}

/**
 * Start quiz from button callback
 * @param {Object} ctx - Telegram context
 */
async function startQuizFromIdHandler(ctx) {
  try {
    // Extract quiz ID from callback data
    const quizId = ctx.callbackQuery.data.replace('start_quiz_', '');
    const chatId = ctx.chat.id;
    
    await ctx.answerCbQuery('Loading quiz...');
    
    // Check if in private chat
    if (ctx.chat.type === 'private') {
      return await ctx.replyWithHTML(
        formatMessage(
          'Group Quizzes Only',
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
          'Permission Denied',
          'Only group administrators can start quizzes in this group.',
          UI.COLORS.DANGER
        )
      );
    }
    
    return await startQuizById(ctx, chatId, quizId);
  } catch (error) {
    logger.error('Error in startQuizFromIdHandler:', error);
    await ctx.answerCbQuery(`${UI.COLORS.ERROR} Failed to start quiz`);
    await ctx.reply(`${UI.COLORS.ERROR} Failed to start quiz. Please try again later.`);
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
    if (activeQuiz && activeQuiz.status !== 'completed') {
      return await ctx.replyWithHTML(
        formatMessage(
          'Quiz Already Active',
          'A quiz is already running in this group! Please wait for it to finish or use /end_quiz to terminate it.',
          UI.COLORS.WARNING
        )
      );
    }
    
    // Get quiz data
    const quizData = await quizManager.getQuiz(quizId);
    if (!quizData) {
      return await ctx.replyWithHTML(
        formatMessage(
          'Quiz Not Found',
          'The requested quiz could not be found. Please check the ID and try again.',
          UI.COLORS.ERROR
        )
      );
    }
    
    // Show loading message
    await ctx.replyWithHTML(
      formatMessage(
        'Starting Quiz',
        `Preparing "${quizData.title}" for this group...\nGet ready to play!`,
        UI.ICONS.TIMER
      )
    );
    
    // Load quiz into memory and start it
    const result = await quiz.loadAndStartQuiz(ctx, chatId, quizData);
    
    if (!result.success) {
      await ctx.replyWithHTML(
        formatMessage(
          'Error Starting Quiz',
          result.message,
          UI.COLORS.ERROR
        )
      );
    }
    
    return result;
  } catch (error) {
    logger.error('Error in startQuizById:', error);
    await ctx.replyWithHTML(
      formatMessage(
        'Quiz Error',
        'An error occurred while starting the quiz. Please try again later.',
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
    if (ctx.chat.type === 'private') {
      return await ctx.replyWithHTML(
        formatMessage(
          'Group Quizzes Only',
          'Quizzes can only be ended in groups.',
          UI.COLORS.WARNING
        )
      );
    }
    
    // Check if user is admin
    const isAdmin = await quiz.isAdmin(ctx, chatId, userId);
    if (!isAdmin) {
      return await ctx.replyWithHTML(
        formatMessage(
          'Permission Denied',
          'Only group administrators can end quizzes in this group.',
          UI.COLORS.DANGER
        )
      );
    }
    
    // End the quiz
    const result = await quiz.endQuiz(ctx, chatId);
    
    if (!result.success) {
      await ctx.replyWithHTML(
        formatMessage(
          'End Quiz Error',
          result.message,
          UI.COLORS.ERROR
        )
      );
    }
    
    return result;
  } catch (error) {
    logger.error('Error in endQuizHandler:', error);
    await ctx.reply(`${UI.COLORS.ERROR} Failed to end quiz. Please try again later.`);
  }
}

/**
 * Delete quiz handler
 * @param {Object} ctx - Telegram context
 */
async function deleteQuizHandler(ctx) {
  try {
    // Extract quiz ID from callback data
    const quizId = ctx.callbackQuery.data.replace('delete_quiz_', '');
    const userId = ctx.from.id;
    
    // Get quiz title for confirmation
    const quizData = await quizManager.getQuiz(quizId);
    
    if (!quizData) {
      await ctx.answerCbQuery('Quiz not found!');
      return await ctx.reply(`${UI.COLORS.ERROR} This quiz no longer exists.`);
    }
    
    // Confirm deletion
    await ctx.answerCbQuery('Confirming deletion...');
    
    await ctx.replyWithHTML(
      formatMessage(
        'Confirm Deletion',
        `Are you sure you want to delete the quiz "<b>${quizData.title}</b>"?\n\nThis action cannot be undone.`,
        UI.COLORS.DANGER
      ),
      Markup.inlineKeyboard([
        [
          Markup.button.callback(`${UI.ICONS.DELETE} Yes, Delete Quiz`, `confirm_delete_${quizId}`),
          Markup.button.callback('Cancel', 'my_quizzes')
        ]
      ])
    );
  } catch (error) {
    logger.error('Error in deleteQuizHandler:', error);
    await ctx.answerCbQuery(`${UI.COLORS.ERROR} Failed to process deletion request`);
    await ctx.reply(`${UI.COLORS.ERROR} An error occurred while processing your request.`);
  }
}

/**
 * Confirm quiz deletion handler
 * @param {Object} ctx - Telegram context
 */
async function confirmDeleteQuizHandler(ctx) {
  try {
    // Extract quiz ID from callback data
    const quizId = ctx.callbackQuery.data.replace('confirm_delete_', '');
    const userId = ctx.from.id;
    
    await ctx.answerCbQuery('Deleting quiz...');
    
    // Delete the quiz
    const result = await quizManager.deleteQuiz(quizId, userId);
    
    if (result.success) {
      await ctx.replyWithHTML(
        formatMessage(
          'Quiz Deleted',
          'Your quiz has been successfully deleted.',
          UI.COLORS.SUCCESS
        )
      );
      // Refresh my quizzes view
      await myQuizzesHandler(ctx);
    } else {
      await ctx.replyWithHTML(
        formatMessage(
          'Deletion Error',
          result.message,
          UI.COLORS.ERROR
        )
      );
    }
  } catch (error) {
    logger.error('Error in confirmDeleteQuizHandler:', error);
    await ctx.answerCbQuery(`${UI.COLORS.ERROR} Failed to delete quiz`);
    await ctx.reply(`${UI.COLORS.ERROR} An error occurred while deleting the quiz.`);
  }
}

/**
 * Edit quiz handler (placeholder for future)
 * @param {Object} ctx - Telegram context
 */
async function editQuizHandler(ctx) {
  try {
    // Extract quiz ID from callback data
    const quizId = ctx.callbackQuery.data.replace('edit_quiz_', '');
    
    await ctx.answerCbQuery('Quiz editing coming soon!');
    
    await ctx.replyWithHTML(
      formatMessage(
        'Feature Coming Soon',
        'Quiz editing will be available in the next update!\n\nIn the meantime, you can create a new quiz with your updated content.',
        UI.ICONS.INFO
      ),
      Markup.inlineKeyboard([
        [Markup.button.callback(`${UI.ICONS.LIST} Back to My Quizzes`, 'my_quizzes')]
      ])
    );
  } catch (error) {
    logger.error('Error in editQuizHandler:', error);
    await ctx.answerCbQuery(`${UI.COLORS.ERROR} Failed to process request`);
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
    const userName = ctx.from.first_name || 'Player';
    
    // Parse callback data
    const match = ctx.callbackQuery.data.match(/answer_(\d+)_(\d+)/);
    if (!match) {
      await ctx.answerCbQuery('Invalid answer format');
      return;
    }
    
    const questionIndex = parseInt(match[1]);
    const answerIndex = parseInt(match[2]);
    
    // Process answer with user info
    const result = await quiz.processAnswer(ctx, chatId, userId, questionIndex, answerIndex, userName);
    
    // Provide feedback via answerCbQuery 
    if (result && result.correct) {
      await ctx.answerCbQuery('✅ Correct answer!');
    } else if (result && !result.correct) {
      await ctx.answerCbQuery('❌ Wrong answer!');
    } else {
      await ctx.answerCbQuery('Answer processed');
    }
  } catch (error) {
    logger.error('Error in answerHandler:', error);
    await ctx.answerCbQuery(`${UI.COLORS.ERROR} Error processing answer`);
  }
}

/**
 * Text handler for question input (if not in scene)
 * @param {Object} ctx - Telegram context
 */
async function textHandler(ctx) {
  try {
    // Only process in private chats for direct input
    if (ctx.chat.type !== 'private') {
      return;
    }
    
    // Scene will handle quiz creation, this is a fallback
    await ctx.replyWithHTML(
      formatMessage(
        'Command Required',
        'To create a quiz, use the /create_quiz command to start the wizard.\n\n' +
        'To see your existing quizzes, use /my_quizzes.',
        UI.ICONS.INFO
      ),
      Markup.inlineKeyboard([
        [
          Markup.button.callback(`${UI.ICONS.CREATE} Create Quiz`, 'create_quiz'),
          Markup.button.callback(`${UI.ICONS.LIST} My Quizzes`, 'my_quizzes')
        ],
        [Markup.button.callback(`${UI.ICONS.INFO} Help`, 'show_help')]
      ])
    );
  } catch (error) {
    logger.error('Error in textHandler:', error);
  }
}

/**
 * Button action mapper for handling button callbacks
 */
function setupButtonActions(bot) {
  // Main menu actions
  bot.action('start', startHandler);
  bot.action('create_quiz', createQuizHandler);
  bot.action('my_quizzes', myQuizzesHandler);
  bot.action('show_help', helpHandler);
  bot.action('show_play_info', async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.replyWithHTML(
      formatMessage(
        'How To Play',
        'To play a quiz:\n\n' +
        '1. Add me to your group\n' +
        '2. Use /start_quiz to begin\n' +
        '3. Select a quiz from your library\n' +
        '4. Players tap answer buttons\n' +
        '5. First correct answer wins points\n\n' +
        'Only group admins can start and end quizzes.',
        UI.ICONS.PLAY
      ),
      Markup.inlineKeyboard([
        [Markup.button.callback('🏠 Back to Main Menu', 'start')]
      ])
    );
  });
  
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
  answerHandler,
  startQuizFromIdHandler,
  deleteQuizHandler,
  editQuizHandler,
  textHandler,
  
  // Additional functionality
  setupButtonActions,
  UI
};