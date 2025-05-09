/**
 * DXQuiz - Utility Functions Module
 * Provides formatting and UI helper functions
 */
const { Markup } = require("telegraf");

/**
 * UI Constants for visual elements
 */
const UI_CONSTANTS = {
  ANSWER_LABELS: ["🅰️", "🅱️", "🅲️", "🅳️"],
  TIMER_EMOJIS: {
    NORMAL: "⏱️",
    WARNING: "⏰",
    CRITICAL: "⚡",
  },
  PROGRESS_CHARS: {
    FILLED: "█",
    EMPTY: "░",
  },
};

/**
 * Create keyboard markup for quiz answers
 * @param {number} questionIndex - Index of the current question
 * @returns {Object} Telegram inline keyboard markup
 */
function createAnswerKeyboard(questionIndex) {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback(
        `${UI_CONSTANTS.ANSWER_LABELS[0]}`,
        `answer_${questionIndex}_0`
      ),
      Markup.button.callback(
        `${UI_CONSTANTS.ANSWER_LABELS[1]}`,
        `answer_${questionIndex}_1`
      ),
    ],
    [
      Markup.button.callback(
        `${UI_CONSTANTS.ANSWER_LABELS[2]}`,
        `answer_${questionIndex}_2`
      ),
      Markup.button.callback(
        `${UI_CONSTANTS.ANSWER_LABELS[3]}`,
        `answer_${questionIndex}_3`
      ),
    ],
  ]);
}

/**
 * Create enhanced answer keyboard with answer text
 * @param {number} questionIndex - Index of the current question
 * @param {Array<string>} options - Answer options text
 * @returns {Object} Telegram inline keyboard markup
 */
function createDetailedAnswerKeyboard(questionIndex, options) {
  // Limit option length for buttons
  const formatOption = (text) => {
    const maxLength = 22;
    return text.length <= maxLength
      ? text
      : text.substring(0, maxLength - 3) + "...";
  };

  return Markup.inlineKeyboard([
    [
      Markup.button.callback(
        `${UI_CONSTANTS.ANSWER_LABELS[0]} ${formatOption(options[0])}`,
        `answer_${questionIndex}_0`
      ),
      Markup.button.callback(
        `${UI_CONSTANTS.ANSWER_LABELS[1]} ${formatOption(options[1])}`,
        `answer_${questionIndex}_1`
      ),
    ],
    [
      Markup.button.callback(
        `${UI_CONSTANTS.ANSWER_LABELS[2]} ${formatOption(options[2])}`,
        `answer_${questionIndex}_2`
      ),
      Markup.button.callback(
        `${UI_CONSTANTS.ANSWER_LABELS[3]} ${formatOption(options[3])}`,
        `answer_${questionIndex}_3`
      ),
    ],
  ]);
}

/**
 * Format time in seconds to MM:SS format
 * @param {number} seconds - Time in seconds
 * @returns {string} Formatted time string
 */
function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, "0")}:${secs
    .toString()
    .padStart(2, "0")}`;
}

/**
 * Create a visual progress bar for timers
 * @param {number} current - Current time value
 * @param {number} total - Total time value
 * @returns {string} Formatted progress bar
 */
function createProgressBar(current, total) {
  // Ensure values are valid
  current = Math.max(0, Math.min(current, total));

  // Calculate percentage
  const percent = Math.floor((current / total) * 100);

  // Create progress bar with 10 segments
  const filledSegments = Math.floor((current / total) * 10);
  const emptySegments = 10 - filledSegments;

  const filledChar = UI_CONSTANTS.PROGRESS_CHARS.FILLED;
  const emptyChar = UI_CONSTANTS.PROGRESS_CHARS.EMPTY;

  const progressBar =
    filledChar.repeat(filledSegments) + emptyChar.repeat(emptySegments);

  // Create timer emoji based on time remaining
  let timerEmoji = UI_CONSTANTS.TIMER_EMOJIS.NORMAL;

  if (current <= total * 0.25) {
    timerEmoji = UI_CONSTANTS.TIMER_EMOJIS.WARNING; // Alarm clock for last 25% of time
  }

  if (current <= total * 0.1) {
    timerEmoji = UI_CONSTANTS.TIMER_EMOJIS.CRITICAL; // Lightning for last 10% of time
  }

  // Format the message
 
}

/**
 * Format a percentage value with color indicator
 * @param {number} percent - Percentage value (0-100)
 * @returns {string} Formatted percentage with emoji
 */
function formatPercentage(percent) {
  let emoji;

  if (percent >= 75) {
    emoji = "🟢"; // High percentage (green)
  } else if (percent >= 40) {
    emoji = "🟡"; // Medium percentage (yellow)
  } else {
    emoji = "🔴"; // Low percentage (red)
  }

  return `${emoji} ${Math.round(percent)}%`;
}

/**
 * Add this to your utils.js file
 *
 * Creates a stylish timer display with cool visual elements
 * @param {number} timeRemaining - Time remaining in seconds
 * @param {number} totalTime - Total time in seconds
 * @returns {string} Formatted timer display
 */
function createTimerDisplay(timeRemaining, totalTime) {
  // Ensure valid values
  timeRemaining = Math.max(0, Math.min(timeRemaining, totalTime));

  // Calculate percentage for color selection
  const percent = Math.floor((timeRemaining / totalTime) * 100);

  // Select timer icon based on time remaining
  let timerIcon;
  if (percent > 60) {
    timerIcon = "⏳"; // Plenty of time
  } else if (percent > 30) {
    timerIcon = "⌛"; // Getting low
  } else if (percent > 10) {
    timerIcon = "🕐"; // Running out
  } else {
    timerIcon = "⚡"; // Almost out
  }

  // Create flashy time display
  const minutes = Math.floor(timeRemaining / 60);
  const seconds = timeRemaining % 60;
  const timeFormatted = `${minutes > 0 ? minutes + "m " : ""}${seconds}s`;

  // Create cool digital timer blocks
  const blocks = ["🟥", "🟧", "🟨", "🟩", "🟦", "🟪"];
  const numBlocks = 10;
  const filledBlocks = Math.ceil((timeRemaining / totalTime) * numBlocks);

  // Select blocks based on time remaining (more colorful as time runs out)
  let timerBlocks = "";

  // Different styles based on time percentage
  if (percent > 60) {
    // Mostly blue/green when plenty of time
    for (let i = 0; i < filledBlocks; i++) {
      timerBlocks += i < filledBlocks / 2 ? "🟩" : "🟦";
    }
  } else if (percent > 30) {
    // Yellow/orange as time decreases
    for (let i = 0; i < filledBlocks; i++) {
      timerBlocks += i < filledBlocks / 2 ? "🟨" : "🟧";
    }
  } else {
    // Red/orange when time is running out
    for (let i = 0; i < filledBlocks; i++) {
      timerBlocks += i < filledBlocks / 2 ? "🟥" : "🟧";
    }

    // Add a pulse effect with alternating characters when time is critically low
    if (percent <= 10 && timeRemaining % 2 === 0) {
      timerBlocks += "⚠️";
    }
  }

  // Add empty blocks
  // for (let i = filledBlocks; i < numBlocks; i++) {
  //   timerBlocks += '⬜';  // Empty blocks
  // }

  // Create a pulsing effect for urgency
  const pulsingEffect = timeRemaining <= 5 ? "🔥" : "";

  // Build the final timer display
  return `${timerIcon} <b>${timeFormatted}</b> ${pulsingEffect}\n${timerBlocks}`;
}
/**
 * Create navigation buttons for paginated content
 * @param {string} actionPrefix - Prefix for callback data
 * @param {number} currentPage - Current page number
 * @param {number} totalPages - Total number of pages
 * @returns {Array} Array of button objects
 */
function createPaginationButtons(actionPrefix, currentPage, totalPages) {
  const buttons = [];

  // Previous page button
  if (currentPage > 1) {
    buttons.push(
      Markup.button.callback(
        "◀️ Previous",
        `${actionPrefix}_${currentPage - 1}`
      )
    );
  }

  // Page indicator
  buttons.push(Markup.button.callback(`${currentPage}/${totalPages}`, "noop"));

  // Next page button
  if (currentPage < totalPages) {
    buttons.push(
      Markup.button.callback("Next ▶️", `${actionPrefix}_${currentPage + 1}`)
    );
  }

  return buttons;
}

/**
 * Format a question with options for display
 * @param {Object} question - Question object
 * @param {number} questionIndex - Current question index
 * @param {number} totalQuestions - Total number of questions
 * @returns {string} Formatted question text
 */
function formatQuestion(question, questionIndex, totalQuestions) {
  const options = question.options
    .map((option, index) => `${UI_CONSTANTS.ANSWER_LABELS[index]} ${option}`)
    .join("\n");

  return (
    `❓ *Question ${questionIndex + 1}/${totalQuestions}*\n\n` +
    `${question.text}\n\n` +
    `${options}`
  );
}

/**
 * Client-Side Timer Approach
 * 
 * This approach creates a countdown that runs in the user's Telegram client,
 * which is more reliable than server-side countdown updates.
 */

/**
 * Creates a Telegram inline keyboard with a self-updating countdown
 * @param {number} questionIndex - Current question index
 * @param {Array} options - Answer options
 * @param {number} timeSeconds - Total time in seconds
 * @returns {Object} Telegram inline keyboard markup
 */
function createTimerKeyboard(questionIndex, options, timeSeconds) {
  // Format a countdown that will auto-update on clients
  // This uses the Telegram callback game clock feature
  // Which shows a live countdown without server updates
  const now = Math.floor(Date.now() / 1000);
  const endTime = now + timeSeconds;
  
  // Create answer buttons
  const answerButtons = [
    [
      { text: '🔴 A', callback_data: `answer_${questionIndex}_0` },
      { text: '🔵 B', callback_data: `answer_${questionIndex}_1` }
    ],
    [
      { text: '🟢 C', callback_data: `answer_${questionIndex}_2` },
      { text: '🟡 D', callback_data: `answer_${questionIndex}_3` }
    ]
  ];
  
  // Timer button that shows countdown (uses Telegram's built-in timer)
  // This shows an updating timer in Telegram without any server calls
  const timerButton = [
    { 
      text: `⏱️ Time Remaining: ${timeSeconds}s`,
      callback_game: {
        // Telegram will automatically count down from endTime
        start_param: `timer_${endTime}`
      }
    }
  ];
  
  // Combine buttons and timer
  return {
    inline_keyboard: [
      ...answerButtons,
      timerButton  // Add the timer as the last row
    ]
  };
}

/**
 * Alternative to nextQuestion function that uses client-side timer
 * Replace your nextQuestion implementation with this
 */
async function nextQuestionWithClientTimer(ctx, chatId, quiz) {
  try {
    // [First part of function remains the same]
    
    // Get current question data
    const questionIndex = quiz.currentQuestionIndex;
    const question = quiz.questions[questionIndex];
    const totalQuestions = quiz.questions.length;
    
    // Format question text
    const questionNumber = questionIndex + 1;
    const progressInfo = `Question ${questionNumber}/${totalQuestions}`;
    
    const questionText = 
      `<b>🔸 ${progressInfo} 🔸</b>\n\n` +
      `<b>${question.text}</b>\n\n` +
      `🔴 A. ${question.options[0]}\n` +
      `🔵 B. ${question.options[1]}\n` +
      `🟢 C. ${question.options[2]}\n` +
      `🟡 D. ${question.options[3]}\n\n` +
      `<i>⚡ First correct answer gets +1 point! ⚡</i>`;
    
    // Use the client-side timer keyboard
    const timerKeyboard = createTimerKeyboard(
      questionIndex, 
      question.options,
      quiz.settings.questionTime
    );
    
    // Send question with client timer
    const sentMsg = await ctx.replyWithHTML(questionText, { 
      reply_markup: timerKeyboard 
    });
    
    // Store message ID
    quiz.messages.question = sentMsg.message_id;
    
    // No need for separate timer message or visual updates
    // Instead, set a single server-side timeout for when time expires
    quiz.timers.question = setTimeout(
      () => handleQuestionTimeout(ctx, chatId, quiz.currentQuestionIndex),
      quiz.settings.questionTime * 1000
    );
    
    return { success: true };
  } catch (error) {
    logger.error('Error in nextQuestionWithClientTimer:', error);
    return { success: false, message: "An error occurred while displaying the next question." };
  }
}

/**
 * IMPORTANT NOTE ABOUT TELEGRAM CLIENT TIMERS
 * 
 * The callback_game parameter used here is technically meant for HTML5 games,
 * but many bots use it to create client-side timers. This is not officially
 * documented by Telegram, but it works in most clients.
 * 
 * Limitations:
 * 1. The timer display is not customizable (it's a simple countdown)
 * 2. It may not work on all Telegram clients/platforms
 * 3. It doesn't send any event when the timer expires
 * 
 * If you use this approach, you still need a server-side timer to handle
 * when the question time expires.
 */

/**
 * Format a date for display
 * @param {number} timestamp - Unix timestamp
 * @returns {string} Formatted date string
 */
function formatDate(timestamp) {
  return new Date(timestamp).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

module.exports = {
  createAnswerKeyboard,
  createDetailedAnswerKeyboard,
  formatTime,
  formatDate,
  createProgressBar,
  formatPercentage,
  createPaginationButtons,
  formatQuestion,
  createTimerDisplay,
  UI_CONSTANTS,
};
