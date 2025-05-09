/**
 * DXQuiz - Utility Functions Module
 * Provides formatting and UI helper functions
 */
const { Markup } = require('telegraf');

/**
 * UI Constants for visual elements
 */
const UI_CONSTANTS = {
  ANSWER_LABELS: ['🅰️', '🅱️', '🅲️', '🅳️'],
  TIMER_EMOJIS: {
    NORMAL: '⏱️',
    WARNING: '⏰',
    CRITICAL: '⚡'
  },
  PROGRESS_CHARS: {
    FILLED: '█',
    EMPTY: '░'
  }
};

/**
 * Create keyboard markup for quiz answers
 * @param {number} questionIndex - Index of the current question
 * @returns {Object} Telegram inline keyboard markup
 */
function createAnswerKeyboard(questionIndex) {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback(`${UI_CONSTANTS.ANSWER_LABELS[0]}`, `answer_${questionIndex}_0`),
      Markup.button.callback(`${UI_CONSTANTS.ANSWER_LABELS[1]}`, `answer_${questionIndex}_1`)
    ],
    [
      Markup.button.callback(`${UI_CONSTANTS.ANSWER_LABELS[2]}`, `answer_${questionIndex}_2`),
      Markup.button.callback(`${UI_CONSTANTS.ANSWER_LABELS[3]}`, `answer_${questionIndex}_3`)
    ]
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
    return text.length <= maxLength ? text : text.substring(0, maxLength - 3) + '...';
  };

  return Markup.inlineKeyboard([
    [
      Markup.button.callback(`${UI_CONSTANTS.ANSWER_LABELS[0]} ${formatOption(options[0])}`, `answer_${questionIndex}_0`),
      Markup.button.callback(`${UI_CONSTANTS.ANSWER_LABELS[1]} ${formatOption(options[1])}`, `answer_${questionIndex}_1`)
    ],
    [
      Markup.button.callback(`${UI_CONSTANTS.ANSWER_LABELS[2]} ${formatOption(options[2])}`, `answer_${questionIndex}_2`),
      Markup.button.callback(`${UI_CONSTANTS.ANSWER_LABELS[3]} ${formatOption(options[3])}`, `answer_${questionIndex}_3`)
    ]
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
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
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
  
  const progressBar = filledChar.repeat(filledSegments) + emptyChar.repeat(emptySegments);
  
  // Create timer emoji based on time remaining
  let timerEmoji = UI_CONSTANTS.TIMER_EMOJIS.NORMAL;
  
  if (current <= total * 0.25) {
    timerEmoji = UI_CONSTANTS.TIMER_EMOJIS.WARNING; // Alarm clock for last 25% of time
  }
  
  if (current <= total * 0.1) {
    timerEmoji = UI_CONSTANTS.TIMER_EMOJIS.CRITICAL; // Lightning for last 10% of time
  }
  
  // Format the message
  return `${timerEmoji} Time remaining: ${formatTime(current)}\n${progressBar} ${percent}%`;
}

/**
 * Format a percentage value with color indicator
 * @param {number} percent - Percentage value (0-100)
 * @returns {string} Formatted percentage with emoji
 */
function formatPercentage(percent) {
  let emoji;
  
  if (percent >= 75) {
    emoji = '🟢'; // High percentage (green)
  } else if (percent >= 40) {
    emoji = '🟡'; // Medium percentage (yellow)
  } else {
    emoji = '🔴'; // Low percentage (red)
  }
  
  return `${emoji} ${Math.round(percent)}%`;
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
    buttons.push(Markup.button.callback('◀️ Previous', `${actionPrefix}_${currentPage - 1}`));
  }
  
  // Page indicator
  buttons.push(Markup.button.callback(`${currentPage}/${totalPages}`, 'noop'));
  
  // Next page button
  if (currentPage < totalPages) {
    buttons.push(Markup.button.callback('Next ▶️', `${actionPrefix}_${currentPage + 1}`));
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
  const options = question.options.map((option, index) => 
    `${UI_CONSTANTS.ANSWER_LABELS[index]} ${option}`
  ).join('\n');
  
  return `❓ *Question ${questionIndex + 1}/${totalQuestions}*\n\n` +
         `${question.text}\n\n` +
         `${options}`;
}

/**
 * Format a date for display
 * @param {number} timestamp - Unix timestamp
 * @returns {string} Formatted date string
 */
function formatDate(timestamp) {
  return new Date(timestamp).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
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
  UI_CONSTANTS
};