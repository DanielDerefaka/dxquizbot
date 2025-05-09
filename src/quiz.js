/**
 * DXQuiz - Quiz Core Module
 * Handles quiz state management, questions, timers, and scoring
 */
const { Markup } = require("telegraf");
const utils = require("./utils");
const logger = require("./logger");
const { UI } = require("./constants");

/**
 * In-memory storage for active quizzes (chatId -> quizState)
 */
const activeQuizzes = new Map();

/**
 * Quiz state object template
 * @param {number} adminId - Admin user ID
 * @returns {Object} New quiz state object
 */
function createNewQuiz(adminId) {
  return {
    adminId,
    status: "setup",
    questions: [],
    currentQuestionIndex: -1,
    participants: new Map(),
    timers: {
      question: null,
      intermission: null,
      countdown: null,
    },
    messages: {
      question: null,
      timer: null,
    },
    settings: {
      questionTime: 10,
      intermissionTime: 5,
    },
    quizId: null,
    title: "",
    startTime: null,
    endTime: null,
  };
}

/**
 * Question object template
 * @param {string} text - Question text
 * @param {Array<string>} options - Answer options
 * @param {number} correctAnswer - Index of correct answer
 * @returns {Object} New question object
 */
function createQuestion(text, options, correctAnswer) {
  return {
    text,
    options,
    correctAnswer,
    responses: [],
  };
}

/**
 * Participant data template
 * @param {number} userId - User ID
 * @param {string} firstName - User first name
 * @param {string} username - Username (optional)
 * @returns {Object} New participant object
 */
function createParticipant(userId, firstName, username) {
  return {
    userId,
    firstName,
    username,
    correctAnswers: 0,
    responses: [],
    lastResponseTime: 0,
    score: 0,
    streak: 0, // Bonus for consecutive correct answers
  };
}

/**
 * Start quiz setup
 * @param {number} chatId - Chat ID
 * @param {number} adminId - Admin user ID
 * @returns {Object} Result object
 */
function startQuizSetup(chatId, adminId) {
  try {
    if (activeQuizzes.has(chatId)) {
      const existingQuiz = activeQuizzes.get(chatId);
      if (existingQuiz.status !== "completed") {
        return {
          success: false,
          message: "A quiz is already active in this chat.",
        };
      }
    }

    activeQuizzes.set(chatId, createNewQuiz(adminId));
    return {
      success: true,
      message:
        "Quiz setup started. Please send me your first question in this format:\n\nQuestion: Who invented the telephone?\nA. Thomas Edison\nB. Alexander Graham Bell\nC. Nikola Tesla\nD. Guglielmo Marconi\nCorrect: B",
    };
  } catch (error) {
    logger.error("Error in startQuizSetup:", error);
    return {
      success: false,
      message: "An error occurred while setting up the quiz.",
    };
  }
}

/**
 * Add a question to a quiz in setup
 * @param {number} chatId - Chat ID
 * @param {string} questionText - Question text
 * @param {Array<string>} options - Answer options
 * @param {number} correctAnswer - Index of correct answer
 * @returns {Object} Result object
 */
function addQuestion(chatId, questionText, options, correctAnswer) {
  try {
    const quiz = activeQuizzes.get(chatId);
    if (!quiz || quiz.status !== "setup") {
      return { success: false, message: "No quiz setup in progress." };
    }

    quiz.questions.push(createQuestion(questionText, options, correctAnswer));

    const maxQuestions = 50;
    if (quiz.questions.length >= maxQuestions) {
      return {
        success: true,
        message: `Maximum questions reached (${maxQuestions}). You can start the quiz with /start_quiz or add fewer questions.`,
        questionCount: quiz.questions.length,
      };
    }

    return {
      success: true,
      message: `Question ${quiz.questions.length} added. Send another question or type /start_quiz to begin.`,
      questionCount: quiz.questions.length,
    };
  } catch (error) {
    logger.error("Error in addQuestion:", error);
    return {
      success: false,
      message: "An error occurred while adding the question.",
    };
  }
}

/**
 * Parse question input text
 * @param {string} text - Question input text
 * @returns {Object|null} Parsed question object or null if invalid
 */
function parseQuestionInput(text) {
  try {
    const questionMatch = text.match(/Question:\s*(.+?)(?=\nA\.|\n$)/s);
    if (!questionMatch) return null;
    const questionText = questionMatch[1].trim();

    const optionA = text.match(/A\.\s*(.+?)(?=\nB\.|\n|$)/s)?.[1]?.trim();
    const optionB = text.match(/B\.\s*(.+?)(?=\nC\.|\n|$)/s)?.[1]?.trim();
    const optionC = text.match(/C\.\s*(.+?)(?=\nD\.|\n|$)/s)?.[1]?.trim();
    const optionD = text.match(/D\.\s*(.+?)(?=\nCorrect:|\n|$)/s)?.[1]?.trim();

    if (!optionA || !optionB || !optionC || !optionD) return null;

    const correctMatch = text.match(/Correct:\s*([A-D])/i);
    if (!correctMatch) return null;

    const correctLetter = correctMatch[1].toUpperCase();
    const correctIndex = correctLetter.charCodeAt(0) - "A".charCodeAt(0);

    return {
      questionText,
      options: [optionA, optionB, optionC, optionD],
      correctAnswer: correctIndex,
    };
  } catch (error) {
    logger.error("Error parsing question:", error);
    return null;
  }
}

/**
 * Load and start a quiz with HTML formatting
 * @param {Object} ctx - Telegram context
 * @param {number} chatId - Chat ID
 * @param {Object} quizData - Quiz data object
 * @returns {Promise<Object>} Result object
 */
async function loadAndStartQuiz(ctx, chatId, quizData) {
  try {
    // [Initial validation code remains the same]
    
    const quiz = createNewQuiz(ctx.from.id);
    quiz.questions = [...quizData.questions];
    quiz.settings = { ...quizData.settings };
    quiz.quizId = quizData.id;
    quiz.title = quizData.title;
    quiz.startTime = Date.now();
    
    activeQuizzes.set(chatId, quiz);
    
    // Send announcement with minimal animations
    const announcementMsg = await ctx.replyWithHTML(
      `<b>🎮 QUIZ STARTING: "${quiz.title}" 🎮</b>\n\n` +
      `<b>• ${quiz.questions.length} Questions</b>\n` +
      `<b>• ${quiz.settings.questionTime} Seconds Per Question</b>\n` +
      `<b>• First correct answer gets +1 point</b>\n\n` +
      `<b>Starting in 5 seconds...</b>`
    );
    
    // Use a single setTimeout instead of multiple updates
    setTimeout(async () => {
      try {
        // Single update to "GO" message
        await ctx.telegram.editMessageText(
          chatId,
          announcementMsg.message_id,
          null,
          `<b>🎮 QUIZ STARTING: "${quiz.title}" 🎮</b>\n\n` +
          `<b>• ${quiz.questions.length} Questions</b>\n` +
          `<b>• ${quiz.settings.questionTime} Seconds Per Question</b>\n` +
          `<b>• First correct answer gets +1 point</b>\n\n` +
          `<b>🔥 GO! 🔥</b>`,
          { parse_mode: 'HTML' }
        );
      } catch (error) {
        logger.error("Error updating GO message:", error);
        // Continue anyway
      }
      
      // Start first question
      await nextQuestion(ctx, chatId);
    }, 5000);
    
    return { success: true };
  } catch (error) {
    logger.error('Error in loadAndStartQuiz:', error);
    return { success: false, message: "An error occurred while starting the quiz." };
  }
}

/**
 * Send the next question with HTML formatting
 * @param {Object} ctx - Telegram context
 * @param {number} chatId - Chat ID
 * @returns {Promise<Object>} Result object
 */
async function nextQuestion(ctx, chatId) {
  try {
    const quiz = activeQuizzes.get(chatId);
    if (!quiz || (quiz.status !== 'setup' && quiz.status !== 'intermission')) {
      return { success: false, message: "No active quiz or quiz not in correct state." };
    }
    
    // Clear any existing timers
    clearTimers(quiz);
    
    // Update quiz status
    quiz.status = 'running';
    quiz.currentQuestionIndex++;
    
    // Check if we've reached the end of the quiz
    if (quiz.currentQuestionIndex >= quiz.questions.length) {
      return await endQuiz(ctx, chatId);
    }
    
    // Get current question data
    const questionIndex = quiz.currentQuestionIndex;
    const question = quiz.questions[questionIndex];
    const totalQuestions = quiz.questions.length;
    const timerSeconds = quiz.settings.questionTime;
    
    // Format question text with embedded timer information
    const questionNumber = questionIndex + 1;
    const progressInfo = `Question ${questionNumber}/${totalQuestions}`;
    
    // Include the time in the question message
    const questionText = 
      `<b>🔸 ${progressInfo} 🔸</b>\n\n` +
      `<b>${question.text}</b>\n\n` +
      `🔴 A. ${question.options[0]}\n` +
      `🔵 B. ${question.options[1]}\n` +
      `🟢 C. ${question.options[2]}\n` +
      `🟡 D. ${question.options[3]}\n\n` +
      `⏱️ <b>Time: ${timerSeconds} seconds</b>\n` +
      `<i>⚡ First correct answer gets +1 point! ⚡</i>`;
    
    // Create a keyboard with answer buttons
    const keyboard = Markup.inlineKeyboard([
      [
        Markup.button.callback('🔴 A', `answer_${questionIndex}_0`),
        Markup.button.callback('🔵 B', `answer_${questionIndex}_1`)
      ],
      [
        Markup.button.callback('🟢 C', `answer_${questionIndex}_2`),
        Markup.button.callback('🟡 D', `answer_${questionIndex}_3`)
      ]
    ]);
    
    // Send question with answer buttons
    const sentMsg = await ctx.replyWithHTML(questionText, keyboard);
    
    // Store message ID for later reference
    quiz.messages.question = sentMsg.message_id;
    
    // Instead of sending and updating a timer message, just set a timeout
    quiz.timers.question = setTimeout(
      () => handleQuestionTimeout(ctx, chatId, quiz.currentQuestionIndex),
      timerSeconds * 1000
    );
    
    return { success: true };
  } catch (error) {
    logger.error('Error in nextQuestion:', error);
    return { success: false, message: "An error occurred while displaying the next question." };
  }
}




/**
 * Run a visual countdown timer for the current question
 * @param {Object} ctx - Telegram context
 * @param {number} chatId - Chat ID
 * @param {Object} quiz - Quiz state object
 */
async function runVisualTimer(ctx, chatId, quiz) {
  try {
    const totalTime = quiz.settings.questionTime;
    let timeRemaining = totalTime;
    
    // Send initial timer
    const initialTimer = utils.createTimerDisplay(timeRemaining, totalTime);
    const timerMsg = await ctx.replyWithHTML(initialTimer);
    quiz.messages.timer = timerMsg.message_id;
    
    // Update function with optimizations to reduce lag
    const updateTimer = async () => {
      try {
        timeRemaining--;
        
        // Only update at specific intervals to reduce API calls and lag
        // Update more frequently in critical moments
        const shouldUpdate = 
          timeRemaining <= 5 || // Update every second when ≤ 5 seconds
          timeRemaining % 3 === 0 || // Update every 3 seconds otherwise
          timeRemaining === Math.floor(totalTime / 2); // Update at halfway point
        
        if (shouldUpdate) {
          const timerDisplay = utils.createTimerDisplay(timeRemaining, totalTime);
          
          // Add a zero-width space to make each message unique
          // This prevents "message not modified" errors
          const zeroWidthSpace = '\u200B';
          const uniqueSpaces = zeroWidthSpace.repeat(Math.floor(Math.random() * 10) + 1);
          
          await ctx.telegram.editMessageText(
            chatId,
            quiz.messages.timer,
            null,
            timerDisplay + uniqueSpaces,
            { parse_mode: 'HTML' }
          );
        }
        
        if (timeRemaining > 0) {
          // Use setTimeout instead of setInterval for better timing
          quiz.timers.question = setTimeout(updateTimer, 1000);
        } else {
          // Time's up
          await ctx.telegram.editMessageText(
            chatId,
            quiz.messages.timer,
            null,
            `⚠️ <b>TIME'S UP!</b> ⚠️`,
            { parse_mode: 'HTML' }
          );
          await handleQuestionTimeout(ctx, chatId, quiz.currentQuestionIndex);
        }
      } catch (error) {
        // Handle common error types
        if (error.description && error.description.includes('message is not modified')) {
          // Ignore "message not modified" errors and continue
          if (timeRemaining > 0) {
            quiz.timers.question = setTimeout(updateTimer, 1000);
          } else {
            await handleQuestionTimeout(ctx, chatId, quiz.currentQuestionIndex);
          }
        } else if (error.code === 429) {
          // Handle rate limiting by backing off
          const retryAfter = (error.response?.parameters?.retry_after || 5) * 1000;
          logger.warn(`Rate limited in runVisualTimer. Retry after ${retryAfter}ms`);
          quiz.timers.question = setTimeout(updateTimer, retryAfter);
        } else {
          // Log other errors but continue timer
          logger.error("Error updating timer:", error);
          if (timeRemaining > 0) {
            quiz.timers.question = setTimeout(updateTimer, 1000);
          } else {
            setTimeout(() => handleQuestionTimeout(ctx, chatId, quiz.currentQuestionIndex), 1000);
          }
        }
      }
    };
    
    // Start the timer update loop
    quiz.timers.question = setTimeout(updateTimer, 1000);
  } catch (error) {
    logger.error('Error in runVisualTimer:', error);
    // Ensure quiz advances even if timer fails
    setTimeout(() => handleQuestionTimeout(ctx, chatId, quiz.currentQuestionIndex), 
      quiz.settings.questionTime * 1000);
  }
}

function createEnhancedAnswerKeyboard(questionIndex, options) {
  // Enhanced labels for buttons
  const enhancedLabels = [
    '🔴 A', 
    '🔵 B', 
    '🟢 C', 
    '🟡 D'
  ];
  
  // Format options for button display (shortened)
  const formatOption = (text) => {
    const maxLength = 20;
    return text.length <= maxLength ? text : text.substring(0, maxLength - 3) + '...';
  };

  return Markup.inlineKeyboard([
    [
      Markup.button.callback(`${enhancedLabels[0]} ${formatOption(options[0])}`, `answer_${questionIndex}_0`),
      Markup.button.callback(`${enhancedLabels[1]} ${formatOption(options[1])}`, `answer_${questionIndex}_1`)
    ],
    [
      Markup.button.callback(`${enhancedLabels[2]} ${formatOption(options[2])}`, `answer_${questionIndex}_2`),
      Markup.button.callback(`${enhancedLabels[3]} ${formatOption(options[3])}`, `answer_${questionIndex}_3`)
    ]
  ]);
}


/**
 * Rate Limit Handler for Telegram Bot
 * 
 * This file provides solutions to handle Telegram's rate limits
 */

/**
 * Add this helper function to utils.js
 * Makes API calls with automatic retry for rate limiting
 * @param {Function} apiCall - Function that makes Telegram API call
 * @param {number} maxRetries - Maximum number of retries
 * @returns {Promise} Result of the API call
 */
async function withRateLimitRetry(apiCall, maxRetries = 3) {
  let retries = 0;
  
  while (retries <= maxRetries) {
    try {
      return await apiCall();
    } catch (error) {
      // Check if it's a rate limit error
      if (error.code === 429 && error.description && error.description.includes('Too Many Requests')) {
        // Extract retry time from error (default to progressively longer delays)
        const retryAfter = error.parameters?.retry_after || (Math.pow(2, retries) * 3);
        
        logger.warn(`Rate limited. Retry after ${retryAfter}s (Attempt ${retries + 1}/${maxRetries + 1})`);
        
        // Don't retry if we've exceeded max retries
        if (retries >= maxRetries) {
          throw error;
        }
        
        // Wait for the specified time
        await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
        retries++;
      } else {
        // Not a rate limit error, just throw it
        throw error;
      }
    }
  }
}

/**
 * Handle question timeout with no timer updates
 * @param {Object} ctx - Telegram context
 * @param {number} chatId - Chat ID
 * @param {number} questionIndex - Question index
 */
async function handleQuestionTimeout(ctx, chatId, questionIndex) {
  try {
    const quiz = activeQuizzes.get(chatId);
    if (!quiz || quiz.status !== 'running' || quiz.currentQuestionIndex !== questionIndex) {
      return;
    }

    // Update quiz status
    quiz.status = 'intermission';
    
    // Disable keyboard buttons with error handling
    try {
      await ctx.telegram.editMessageReplyMarkup(
        chatId,
        quiz.messages.question,
        null,
        { inline_keyboard: [] }
      );
    } catch (error) {
      // Log but continue execution
      logger.error("Failed to disable keyboard:", error);
    }

    // Get question data
    const question = quiz.questions[questionIndex];
    if (!question) {
      logger.error(`Question index ${questionIndex} not found`);
      setTimeout(() => nextQuestion(ctx, chatId), 3000);
      return;
    }

    // Prepare results message
    // Define correct answer info
    const correctAnswer = question.correctAnswer;
    const correctLetter = ['A', 'B', 'C', 'D'][correctAnswer];
    const correctOption = question.options[correctAnswer];
    
    // Format first winner message
    let winnerMessage = '';
    if (question.firstCorrectAnswer) {
      const winner = question.firstCorrectAnswer;
      const displayName = winner.username ? `@${winner.username}` : winner.firstName;
      
      // Calculate response time in seconds
      const questionStartTime = quiz.startTime + (questionIndex * (quiz.settings.questionTime + quiz.settings.intermissionTime) * 1000);
      const responseTimeSeconds = ((winner.time - questionStartTime) / 1000).toFixed(2);
      
      winnerMessage = `\n\n🏆 <b>First correct answer:</b> ${displayName} (+1 point)\n⏱️ Response time: ${responseTimeSeconds}s`;
    } else {
      winnerMessage = '\n\n❌ <b>No one answered correctly!</b>';
    }
    
    // [Rest of your response stats calculation]
    
    // Send intermission message with error handling and retry
    try {
      // Try up to 3 times with exponential backoff
      let attempt = 0;
      const maxAttempts = 3;
      let success = false;
      
      while (attempt < maxAttempts && !success) {
        try {
          await ctx.replyWithHTML(
            `<b>⏱️ TIME'S UP! ⏱️</b>\n\n` +
            `✅ <b>Correct Answer:</b> ${correctLetter} (${correctOption})` +
            winnerMessage +
            `\n\n<b>Next question in ${quiz.settings.intermissionTime}s</b>`
          );
          success = true;
        } catch (error) {
          if (error.code === 429) {
            // Rate limited, wait and retry
            const retryAfter = error.parameters?.retry_after || Math.pow(2, attempt);
            logger.warn(`Rate limited (attempt ${attempt+1}/${maxAttempts}). Retry after ${retryAfter}s`);
            await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
            attempt++;
          } else {
            // Other error, don't retry
            throw error;
          }
        }
      }
      
      if (!success) {
        logger.error("Failed to send intermission message after multiple attempts");
      }
    } catch (error) {
      logger.error("Failed to send intermission message:", error);
    }

    // Schedule next question with increased delay to avoid rate limits
    const baseDelay = quiz.settings.intermissionTime * 1000;
    const extraDelay = 2000; // Add 2 seconds to ensure rate limit resets
    
    quiz.timers.intermission = setTimeout(
      () => nextQuestion(ctx, chatId),
      baseDelay + extraDelay
    );
  } catch (error) {
    logger.error('Error in handleQuestionTimeout:', error);
    // Ensure quiz continues with extra delay
    setTimeout(() => nextQuestion(ctx, chatId), quiz.settings.intermissionTime * 1000 + 3000);
  }
}


/**
 * Run a precise visual timer with accurate timing
 * @param {Object} ctx - Telegram context
 * @param {number} chatId - Chat ID
 * @param {Object} quiz - Quiz state object
 */
async function runVisualTimer(ctx, chatId, quiz) {
  try {
    const totalTime = quiz.settings.questionTime;
    
    // Important: Store the exact start time for the timer
    const timerStartTime = Date.now();
    
    // Send initial timer display
    const initialTimer = utils.createTimerDisplay ? 
      utils.createTimerDisplay(totalTime, totalTime) : 
      utils.createProgressBar(totalTime, totalTime);
      
    const timerMsg = await ctx.replyWithHTML(initialTimer);
    quiz.messages.timer = timerMsg.message_id;
    
    // Schedule updates at specific times for visual display
    // We'll use a different approach to ensure accurate timing
    const updateTimes = [
      Math.floor(totalTime * 0.75), // 75% of time remaining
      Math.floor(totalTime * 0.5),  // 50% of time remaining
      Math.floor(totalTime * 0.25), // 25% of time remaining
      5,  // 5 seconds remaining
      3,  // 3 seconds remaining
      1   // 1 second remaining
    ];
    
    // Set up timeout for each update point
    updateTimes.forEach(updateTime => {
      if (updateTime < totalTime) {
        const delay = (totalTime - updateTime) * 1000;
        
        setTimeout(async () => {
          try {
            // Check if the quiz is still running
            const currentQuiz = activeQuizzes.get(chatId);
            if (!currentQuiz || 
                currentQuiz.status !== 'running' || 
                currentQuiz.currentQuestionIndex !== quiz.currentQuestionIndex) {
              return;
            }
            
            // Calculate exact time remaining based on elapsed time
            const elapsedMs = Date.now() - timerStartTime;
            const exactTimeRemaining = Math.max(0, totalTime - Math.floor(elapsedMs / 1000));
            
            // Only update if the time remaining is close to expected
            // This ensures we don't send updates for outdated times
            if (Math.abs(exactTimeRemaining - updateTime) <= 1) {
              const timerDisplay = utils.createTimerDisplay ? 
                utils.createTimerDisplay(exactTimeRemaining, totalTime) : 
                utils.createProgressBar(exactTimeRemaining, totalTime);
              
              // Add unique invisible characters
              const zeroWidthSpace = '\u200B';
              const uniqueSpaces = zeroWidthSpace.repeat(Math.floor(Math.random() * 10) + 1);
              
              await ctx.telegram.editMessageText(
                chatId,
                quiz.messages.timer,
                null,
                timerDisplay + uniqueSpaces,
                { parse_mode: 'HTML' }
              );
            }
          } catch (error) {
            // Just log errors - don't stop the timer
            if (!error.description || !error.description.includes('message is not modified')) {
              logger.error(`Error updating timer at ${updateTime}s:`, error);
            }
          }
        }, delay);
      }
    });
    
    // Primary timer that actually ends the question
    // This is separate from the visual updates and ensures accuracy
    const questionTimeout = setTimeout(() => {
      try {
        // Final "Time's up" message
        ctx.telegram.editMessageText(
          chatId,
          quiz.messages.timer,
          null,
          '⚠️ <b>TIME\'S UP!</b> ⚠️',
          { parse_mode: 'HTML' }
        ).catch(err => logger.error("Failed to show final timer message:", err));
        
        // Call the timeout handler
        handleQuestionTimeout(ctx, chatId, quiz.currentQuestionIndex);
      } catch (error) {
        logger.error("Error in timer completion:", error);
        handleQuestionTimeout(ctx, chatId, quiz.currentQuestionIndex);
      }
    }, totalTime * 1000);
    
    // Store the timeout so it can be cleared if needed
    quiz.timers.question = questionTimeout;
    
  } catch (error) {
    logger.error('Error in runVisualTimer:', error);
    // Ensure quiz advances even if timer setup fails
    setTimeout(() => handleQuestionTimeout(ctx, chatId, quiz.currentQuestionIndex), 
      quiz.settings.questionTime * 1000);
  }
}

/**
 * Alternative simple timer with minimal UI updates
 * If you prefer an even simpler approach with fewer API calls:
 */
async function runSimpleTimer(ctx, chatId, quiz) {
  try {
    const totalTime = quiz.settings.questionTime;
    
    // Send a timer message with minimal information
    await ctx.replyWithHTML(
      `⏱️ <b>Time remaining: ${totalTime} seconds</b>\n` +
      `<i>First correct answer gets +1 point!</i>`
    );
    
    // Just set a single timeout for the end - no visual updates
    quiz.timers.question = setTimeout(() => {
      handleQuestionTimeout(ctx, chatId, quiz.currentQuestionIndex);
    }, totalTime * 1000);
    
  } catch (error) {
    logger.error('Error in simple timer:', error);
    setTimeout(() => handleQuestionTimeout(ctx, chatId, quiz.currentQuestionIndex), 
      quiz.settings.questionTime * 1000);
  }
}


/**
 * Process answer with no update to timer display
 * @param {Object} ctx - Telegram context
 * @param {number} chatId - Chat ID
 * @param {number} userId - User ID
 * @param {number} questionIndex - Question index
 * @param {number} answerIndex - Answer index
 * @returns {Promise<Object>} Result object
 */
async function processAnswer(ctx, chatId, userId, questionIndex, answerIndex) {
  try {
    const quiz = activeQuizzes.get(chatId);
    if (!quiz || quiz.status !== 'running' || quiz.currentQuestionIndex !== questionIndex) {
      return { success: false };
    }
    
    const question = quiz.questions[questionIndex];
    if (!question) {
      logger.error(`Question at index ${questionIndex} not found`);
      return { success: false };
    }
    
    // Initialize responses array if needed
    if (!question.responses) {
      question.responses = [];
      question.firstCorrectAnswer = null; // Track first correct answer
    }
    
    // Get user info
    const user = ctx.from;
    const firstName = user.first_name;
    const username = user.username || firstName;
    
    // Create or get participant record
    if (!quiz.participants.has(userId)) {
      quiz.participants.set(userId, createParticipant(userId, firstName, username));
    }
    
    const participant = quiz.participants.get(userId);
    
    // Check if user already answered this question
    const alreadyAnswered = participant.responses.some(r => r.questionIndex === questionIndex);
    if (alreadyAnswered) {
      await ctx.answerCbQuery("You already answered this question!");
      return { success: false, message: "Already answered" };
    }
    
    // Check if answer is correct
    const isCorrect = (answerIndex === question.correctAnswer);
    const responseTime = Date.now();
    
    // Create response record
    const response = {
      questionIndex,
      answerIndex,
      time: responseTime,
      isCorrect,
      userId,
      username,
      firstName
    };
    
    // Update participant stats
    participant.responses.push(response);
    participant.lastResponseTime = responseTime;
    
    if (isCorrect) {
      participant.correctAnswers++;
      
      // Check if this is the first correct answer for this question
      if (!question.firstCorrectAnswer) {
        question.firstCorrectAnswer = {
          userId,
          username,
          firstName,
          time: responseTime
        };
        
        // Award 1 point to the first correct answerer
        participant.score += 1;
        response.isFirst = true;
        response.points = 1;
      } else {
        // No points for correct but not first
        response.isFirst = false;
        response.points = 0;
      }
    } else {
      // No points for wrong answers
      response.isFirst = false;
      response.points = 0;
    }
    
    // Add to question responses
    question.responses.push(response);
    
    // Provide feedback to user
    let feedback;
    if (isCorrect) {
      if (response.isFirst) {
        feedback = `✅ Correct! You were first! +1 point`;
      } else {
        feedback = `✅ Correct! But someone was faster`;
      }
    } else {
      feedback = "❌ Wrong answer!";
    }
    
    await ctx.answerCbQuery(feedback);
    
    return { 
      success: true, 
      correct: isCorrect,
      isFirst: response.isFirst,
      points: response.points
    };
  } catch (error) {
    logger.error('Error in processAnswer:', error);
    return { success: false, message: "An error occurred while processing your answer." };
  }
}

/**
 * Calculate and display quiz results with HTML formatting
 * @param {Object} quiz - Quiz state object
 * @returns {Object} Formatted results
 */
/**
 * Enhanced Quiz Results Display
 * 
 * Replace the calculateResults function in quiz.js with this version
 * for a more visually appealing and exciting results display.
 */

function calculateResults(quiz) {
  try {
    const participants = Array.from(quiz.participants.values());
    
    // Sort participants by score and then by other factors
    participants.sort((a, b) => {
      if (b.score !== a.score) {
        // Higher score first (number of first correct answers)
        return b.score - a.score;
      }
      if (b.correctAnswers !== a.correctAnswers) {
        // If same score, sort by total correct answers
        return b.correctAnswers - a.correctAnswers;
      }
      // If still tied, sort by fastest response time
      return a.lastResponseTime - b.lastResponseTime;
    });
    
    // Get top performers for display
    const topPerformers = participants.slice(0, 10);
    
    // Build an exciting, visually appealing leaderboard
    let leaderboard = '';
    
    // Special highlighting for top 3 winners
    if (topPerformers.length > 0) {
      // Champion section with extra flair
      if (topPerformers.length >= 1) {
        const champion = topPerformers[0];
        const displayName = champion.username ? `@${champion.username}` : champion.firstName;
        
        // Calculate win percentage
        const winPercent = Math.round((champion.score / quiz.questions.length) * 100);
        
        // Champion trophy display
        leaderboard += `${UI.ICONS.CROWN} <b>CHAMPION</b> ${UI.ICONS.CROWN}\n` +
                       `${UI.ICONS.MEDAL_GOLD} <b>${displayName}</b> ${UI.ICONS.MEDAL_GOLD}\n` +
                       `${champion.score} points (${champion.correctAnswers}/${quiz.questions.length} correct)\n` +
                       `Win rate: ${winPercent}%\n\n`;
      }
      
      // Other top finishers
      if (topPerformers.length >= 2) {
        // Create podium section for 2nd and 3rd
        leaderboard += `<b>🏆 PODIUM FINISHERS 🏆</b>\n`;
        
        // Second place
        const silver = topPerformers[1];
        const silverName = silver.username ? `@${silver.username}` : silver.firstName;
        leaderboard += `${UI.ICONS.MEDAL_SILVER} <b>${silverName}</b> - ${silver.score} pts (${silver.correctAnswers} correct)\n`;
        
        // Third place if available
        if (topPerformers.length >= 3) {
          const bronze = topPerformers[2];
          const bronzeName = bronze.username ? `@${bronze.username}` : bronze.firstName;
          leaderboard += `${UI.ICONS.MEDAL_BRONZE} <b>${bronzeName}</b> - ${bronze.score} pts (${bronze.correctAnswers} correct)\n`;
        }
        
        leaderboard += '\n';
      }
      
      // Other participants (4th place onwards)
      if (topPerformers.length > 3) {
        leaderboard += `<b>OTHER FINISHERS</b>\n`;
        
        for (let i = 3; i < topPerformers.length; i++) {
          const player = topPerformers[i];
          const playerName = player.username ? `@${player.username}` : player.firstName;
          leaderboard += `${i + 1}. <b>${playerName}</b> - ${player.score} pts (${player.correctAnswers} correct)\n`;
        }
      }
    } else {
      leaderboard = '😢 No participants in this quiz!';
    }
    
    // Generate exciting statistics section
    let stats = '';
    
    if (participants.length > 0) {
      stats += `<b>📊 QUIZ STATS 📊</b>\n\n`;
      
      // Basic stats with visual elements
      stats += `👥 <b>Players:</b> ${participants.length}\n`;
      
      // Calculate average score and add visual flair
      const totalScore = participants.reduce((sum, p) => sum + p.score, 0);
      const avgScore = totalScore / participants.length;
      stats += `🎯 <b>Avg Score:</b> ${avgScore.toFixed(1)} points\n`;
      
      // Calculate average correct answers
      const totalCorrect = participants.reduce((sum, p) => sum + p.correctAnswers, 0);
      const avgCorrect = totalCorrect / participants.length;
      stats += `✅ <b>Avg Correct:</b> ${avgCorrect.toFixed(1)}/${quiz.questions.length}\n\n`;
      
      // Find interesting stats about the quiz
      
      // Most contested questions
      const contestedQuestions = quiz.questions
        .map((q, idx) => {
          const correctResponses = q.responses?.filter(r => r.isCorrect)?.length || 0;
          return { 
            index: idx, 
            text: q.text,
            contestedScore: correctResponses > 0 ? correctResponses - 1 : 0
          };
        })
        .filter(q => q.contestedScore > 0)
        .sort((a, b) => b.contestedScore - a.contestedScore);
      
      if (contestedQuestions.length > 0) {
        const mostContested = contestedQuestions[0];
        const shortText = mostContested.text.length > 30 
          ? mostContested.text.substring(0, 27) + '...' 
          : mostContested.text;
        
        stats += `🔥 <b>Hottest Q:</b> #${mostContested.index + 1} with ${mostContested.contestedScore + 1} correct answers\n`;
      }
      
      // Find questions with no correct answers
      const trickyQuestions = quiz.questions
        .map((q, idx) => {
          const correctResponses = q.responses?.filter(r => r.isCorrect)?.length || 0;
          return { index: idx, text: q.text, correctCount: correctResponses };
        })
        .filter(q => q.correctCount === 0);
      
      if (trickyQuestions.length > 0) {
        stats += `❓ <b>Stumped Everyone:</b> ${trickyQuestions.length} questions had no correct answers\n`;
      }
      
      // Find fastest responder
      const allResponses = [];
      participants.forEach(p => {
        p.responses.forEach(r => {
          if (r.isCorrect && r.isFirst) {
            allResponses.push({
              userId: p.userId,
              name: p.username || p.firstName,
              questionIndex: r.questionIndex,
              time: r.time
            });
          }
        });
      });
      
      if (allResponses.length > 0) {
        // Group by user
        const userResponses = {};
        allResponses.forEach(r => {
          if (!userResponses[r.userId]) {
            userResponses[r.userId] = {
              name: r.name,
              responses: []
            };
          }
          userResponses[r.userId].responses.push(r);
        });
        
        // Find fastest responder
        let fastestUser = null;
        let fastestAvg = Infinity;
        
        Object.keys(userResponses).forEach(userId => {
          const user = userResponses[userId];
          if (user.responses.length >= 2) { // At least 2 first answers
            const avgTime = user.responses.reduce((sum, r) => sum + (r.time - quiz.startTime), 0) / user.responses.length;
            if (avgTime < fastestAvg) {
              fastestAvg = avgTime;
              fastestUser = user;
            }
          }
        });
        
        if (fastestUser) {
          stats += `⚡ <b>Speed Demon:</b> ${fastestUser.name} (avg: ${(fastestAvg/1000).toFixed(2)}s)\n`;
        }
      }
      
      // Add quiz duration with visual flair
      if (quiz.startTime && quiz.endTime) {
        const durationMs = quiz.endTime - quiz.startTime;
        const durationMin = Math.floor(durationMs / 60000);
        const durationSec = Math.floor((durationMs % 60000) / 1000);
        stats += `\n⏱️ <b>Quiz Time:</b> ${durationMin}m ${durationSec}s\n`;
      }
    }
    
    // Create cool closing message
    let closingMessage = '';
    if (participants.length > 0 && topPerformers.length > 0) {
      const winner = topPerformers[0];
      const winnerName = winner.username ? `@${winner.username}` : winner.firstName;
      
      closingMessage = `\n🎊 <b>Congratulations ${winnerName}!</b> 🎊\n` +
                      `You've earned the title of Quiz Champion!\n\n`;
    }
    
    closingMessage += `Thanks for playing! Use /start_quiz to battle again.`;
    
    // Build the complete results message with visual separation
    const groupMessage = 
      `🏆 <b>QUIZ BATTLE COMPLETE!</b> 🏆\n` +
      `"${quiz.title}"\n\n` +
      `${leaderboard}\n` +
      `${stats.length > 0 ? '━━━━━━━━━━━━━━━━\n\n' + stats : ''}\n` +
      `${closingMessage}`;
    
    return { groupMessage, parse_mode: 'HTML' };
  } catch (error) {
    logger.error('Error in calculateResults:', error);
    return { 
      groupMessage: `${UI.COLORS.ERROR} <b>Quiz Complete!</b>\n\nAn error occurred while calculating the results. Thanks for playing!`,
      parse_mode: 'HTML'
    };
  }
}


async function endQuiz(ctx, chatId) {
  try {
    const quiz = activeQuizzes.get(chatId);
    if (!quiz) {
      return { success: false, message: "No active quiz to end." };
    }

    // Clear any active timers
    clearTimers(quiz);

    // Update quiz status and end time
    quiz.status = "completed";
    quiz.endTime = Date.now();

    // Calculate and show results
    const results = calculateResults(quiz);

    await ctx.replyWithHTML(results.groupMessage, {
      disable_web_page_preview: true,
    });

    // Keep the quiz in memory for a short time for analytics
    setTimeout(() => {
      activeQuizzes.delete(chatId);
    }, 30000);

    return { success: true };
  } catch (error) {
    logger.error("Error in endQuiz:", error);
    return {
      success: false,
      message: "An error occurred while ending the quiz.",
    };
  }
}
/**
 * Check if a user is an admin in a chat
 * @param {Object} ctx - Telegram context
 * @param {number} chatId - Chat ID
 * @param {number} userId - User ID to check
 * @returns {Promise<boolean>} Whether the user is an admin
 */
async function isAdmin(ctx, chatId, userId) {
  try {
    const member = await ctx.telegram.getChatMember(chatId, userId);
    return ["creator", "administrator"].includes(member.status);
  } catch (error) {
    logger.error("Error checking admin status:", error);
    return false;
  }
}

/**
 * Helper function to create a new participant record - updated for first winner scoring
 * @param {number} userId - User ID
 * @param {string} firstName - User first name
 * @param {string} username - Username (optional)
 * @returns {Object} New participant object
 */
function createParticipant(userId, firstName, username) {
  return {
    userId,
    firstName,
    username,
    correctAnswers: 0,  // Total number of correct answers
    score: 0,           // Score (1 point per first correct answer)
    responses: [],      // All responses from this participant
    lastResponseTime: 0 // Time of last response (for tiebreakers)
  };
}

/**
 * Get the status of a quiz in a chat
 * @param {number} chatId - Chat ID
 * @returns {Object|undefined} Quiz state or undefined if no quiz
 */
function getQuizStatus(chatId) {
  return activeQuizzes.get(chatId);
}

/**
 * Clear all timers for a quiz
 * @param {Object} quiz - Quiz state object
 */
function clearTimers(quiz) {
  for (const timerKey in quiz.timers) {
    if (quiz.timers[timerKey]) {
      clearTimeout(quiz.timers[timerKey]);
      quiz.timers[timerKey] = null;
    }
  }
}

module.exports = {
  startQuizSetup,
  addQuestion,
  parseQuestionInput,
  loadAndStartQuiz,
  nextQuestion,
  processAnswer,
  endQuiz,
  isAdmin,
  getQuizStatus,
  runSimpleTimer
};
