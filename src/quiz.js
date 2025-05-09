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
    // Check for existing quiz
    if (activeQuizzes.has(chatId)) {
      const existingQuiz = activeQuizzes.get(chatId);
      if (existingQuiz.status !== "completed") {
        return {
          success: false,
          message: "A quiz is already active in this chat.",
        };
      }
    }

    // Validate quiz data
    if (!quizData || !quizData.questions || quizData.questions.length === 0) {
      return {
        success: false,
        message: "Invalid quiz data. The quiz has no questions.",
      };
    }

    // Create new quiz instance
    const quiz = createNewQuiz(ctx.from.id);
    quiz.questions = [...quizData.questions];
    quiz.settings = { ...quizData.settings };
    quiz.quizId = quizData.id;
    quiz.title = quizData.title;
    quiz.startTime = Date.now();

    activeQuizzes.set(chatId, quiz);

    // Send announcement
    const announcementMsg = await ctx.replyWithHTML(
      `<b>${UI.ICONS.PLAY} QUIZ STARTING: "${quiz.title}" ${UI.ICONS.PLAY}</b>\n\n` +
        `This quiz has ${quiz.questions.length} questions.\n` +
        `Each question has a ${quiz.settings.questionTime} second time limit.\n\n` +
        `${UI.ICONS.TIMER} <b>Get ready! Starting in 5 seconds...</b>`
    );

    // Start countdown
    let countdown = 5;
    const updateCountdown = async () => {
      try {
        if (countdown > 0) {
          // Create a message with a subtle difference to avoid the "message not modified" error
          // We'll add a zero-width space character after the timer number
          // This is invisible to users but makes the message different each time
          const zeroWidthSpace = '\u200B';
          const randomSpaces = zeroWidthSpace.repeat(countdown); // Add different number of zero-width spaces each time
          
          await ctx.telegram.editMessageText(
            chatId,
            announcementMsg.message_id,
            null,
            `<b>${UI.ICONS.PLAY} QUIZ STARTING: "${quiz.title}" ${UI.ICONS.PLAY}</b>\n\n` +
            `This quiz has ${quiz.questions.length} questions.\n` +
            `Each question has a ${quiz.settings.questionTime} second time limit.\n\n` +
            `${UI.ICONS.TIMER} <b>Get ready! Starting in ${countdown}${randomSpaces} seconds...</b>`,
            { parse_mode: 'HTML' }
          );
          
          countdown--;
          quiz.timers.countdown = setTimeout(updateCountdown, 1000);
        } else {
          await ctx.telegram.editMessageText(
            chatId,
            announcementMsg.message_id,
            null,
            `<b>${UI.ICONS.PLAY} QUIZ STARTING: "${quiz.title}" ${UI.ICONS.PLAY}</b>\n\n` +
            `This quiz has ${quiz.questions.length} questions.\n` +
            `Each question has a ${quiz.settings.questionTime} second time limit.\n\n` +
            `${UI.COLORS.SUCCESS} <b>Quiz has started!</b>`,
            { parse_mode: 'HTML' }
          );
          
          // Start first question
          await nextQuestion(ctx, chatId);
        }
      } catch (error) {
        // Handle "message not modified" error specifically (ignore it)
        if (error.description && error.description.includes('message is not modified')) {
          logger.debug('Ignoring "message not modified" error in countdown');
          countdown--;
          quiz.timers.countdown = setTimeout(updateCountdown, 1000);
        } else {
          // Log other errors but continue with the countdown
          logger.error("Error updating countdown:", error);
          countdown--; 
          if (countdown >= 0) {
            quiz.timers.countdown = setTimeout(updateCountdown, 1000);
          } else {
            // Proceed to first question even if there's an error
            await nextQuestion(ctx, chatId);
          }
        }
      }
    };

    quiz.timers.countdown = setTimeout(updateCountdown, 1000);
    return { success: true };
  } catch (error) {
    logger.error("Error in loadAndStartQuiz:", error);
    return {
      success: false,
      message: "An error occurred while starting the quiz.",
    };
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
    if (!quiz || (quiz.status !== "setup" && quiz.status !== "intermission")) {
      return {
        success: false,
        message: "No active quiz or quiz not in correct state.",
      };
    }

    // Clear any existing timers
    clearTimers(quiz);

    // Update quiz status
    quiz.status = "running";
    quiz.currentQuestionIndex++;

    // Check if we've reached the end of the quiz
    if (quiz.currentQuestionIndex >= quiz.questions.length) {
      return await endQuiz(ctx, chatId);
    }

    // Get current question data
    const questionIndex = quiz.currentQuestionIndex;
    const question = quiz.questions[questionIndex];
    const totalQuestions = quiz.questions.length;

    // Format question text with HTML
    const questionNumber = questionIndex + 1;
    const progressInfo = `Question ${questionNumber}/${totalQuestions}`;

    const questionText =
      `<b>${UI.ICONS.STAR} ${progressInfo}</b>\n\n` +
      `${question.text}\n\n` +
      `${utils.UI_CONSTANTS.ANSWER_LABELS[0]} ${question.options[0]}\n` +
      `${utils.UI_CONSTANTS.ANSWER_LABELS[1]} ${question.options[1]}\n` +
      `${utils.UI_CONSTANTS.ANSWER_LABELS[2]} ${question.options[2]}\n` +
      `${utils.UI_CONSTANTS.ANSWER_LABELS[3]} ${question.options[3]}\n\n` +
      `${UI.ICONS.TIMER} Time: ${quiz.settings.questionTime}s`;

    // Send question with answer buttons
    const sentMsg = await ctx.replyWithHTML(
      questionText,
      utils.createAnswerKeyboard(questionIndex)
    );

    // Store message ID for later reference
    quiz.messages.question = sentMsg.message_id;

    // Send timer message
    const timerMsg = await ctx.reply(
      utils.createProgressBar(
        quiz.settings.questionTime,
        quiz.settings.questionTime
      )
    );
    quiz.messages.timer = timerMsg.message_id;

    // Start visual timer
    await runVisualTimer(ctx, chatId, quiz);

    return { success: true };
  } catch (error) {
    logger.error("Error in nextQuestion:", error);
    return {
      success: false,
      message: "An error occurred while displaying the next question.",
    };
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

    const updateTimer = async () => {
      try {
        timeRemaining--;
        
        // Update timer at specific intervals to avoid excessive API calls
        // Update more frequently in the final seconds
        if (timeRemaining <= 5 || timeRemaining === Math.floor(totalTime / 2) || 
            timeRemaining === Math.floor(totalTime / 4) || timeRemaining === totalTime - 2) {
          
          // Add a random invisible character to make each message unique
          const zeroWidthSpace = '\u200B';
          const randomSpaces = zeroWidthSpace.repeat((timeRemaining % 5) + 1);
          
          const progressBar = utils.createProgressBar(timeRemaining, totalTime);
          
          await ctx.telegram.editMessageText(
            chatId,
            quiz.messages.timer,
            null,
            progressBar + randomSpaces // Add invisible characters to avoid "message not modified" error
          );
        }
        
        if (timeRemaining > 0) {
          quiz.timers.question = setTimeout(updateTimer, 1000);
        } else {
          // Time's up
          await handleQuestionTimeout(ctx, chatId, quiz.currentQuestionIndex);
        }
      } catch (error) {
        // Handle "message not modified" error specifically (ignore it)
        if (error.description && error.description.includes('message is not modified')) {
          logger.debug('Ignoring "message not modified" error in timer');
          
          if (timeRemaining > 0) {
            quiz.timers.question = setTimeout(updateTimer, 1000);
          } else {
            await handleQuestionTimeout(ctx, chatId, quiz.currentQuestionIndex);
          }
        } 
        // Handle rate limiting errors
        else if (error.code === 429) {
          const retryAfter = (error.response?.parameters?.retry_after || 5) * 1000;
          logger.warn(`Rate limited in runVisualTimer. Retry after ${retryAfter}ms`);
          quiz.timers.question = setTimeout(updateTimer, retryAfter);
        } else {
          logger.error("Error updating timer:", error);
          // Continue with timeout handler to ensure quiz advances
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
    logger.error("Error in runVisualTimer:", error);
    // Ensure quiz still advances if timer fails
    setTimeout(
      () => handleQuestionTimeout(ctx, chatId, quiz.currentQuestionIndex),
      quiz.settings.questionTime * 1000
    );
  }
}

/**
 * Handle question timeout with HTML formatting
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
    
    // Disable keyboard buttons
    try {
      await ctx.telegram.editMessageReplyMarkup(
        chatId,
        quiz.messages.question,
        null,
        { inline_keyboard: [] }
      );
    } catch (error) {
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
    const correctLetter = utils.UI_CONSTANTS.ANSWER_LABELS[question.correctAnswer];
    const correctOption = question.options[question.correctAnswer];
    
    // Calculate response statistics
    let totalResponses = 0;
    let correctResponses = 0;
    let responseCounts = [0, 0, 0, 0];
    
    if (Array.isArray(question.responses)) {
      question.responses.forEach(response => {
        totalResponses++;
        if (response.answerIndex >= 0 && response.answerIndex < 4) {
          responseCounts[response.answerIndex]++;
        }
        if (response.isCorrect) correctResponses++;
      });
    }
    
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
    
    // Format response statistics
    let responseStats = '';
    if (totalResponses > 0) {
      responseStats = '\n\n📊 <b>Answers:</b>\n';
      for (let i = 0; i < 4; i++) {
        const percent = totalResponses > 0 ? Math.round((responseCounts[i] / totalResponses) * 100) : 0;
        const isCorrect = i === question.correctAnswer ? '✅ ' : '';
        responseStats += `${isCorrect}${utils.UI_CONSTANTS.ANSWER_LABELS[i]} ${responseCounts[i]} (${percent}%)\n`;
      }
    }
    
    // Add correct answer percentage
    if (totalResponses > 0) {
      const correctPercent = Math.round((correctResponses / totalResponses) * 100);
      responseStats += `\n${utils.formatPercentage(correctPercent)} of players answered correctly`;
    }
    
    // Send intermission message
    try {
      await ctx.replyWithHTML(
        `${UI.ICONS.TIMER} <b>Time's up!</b>\n\n` +
        `✅ <b>Correct Answer:</b> ${correctLetter} (${correctOption})` +
        winnerMessage +
        responseStats +
        `\n\n<b>Next question starts in ${quiz.settings.intermissionTime} seconds.</b>`
      );
    } catch (error) {
      logger.error("Failed to send intermission message:", error);
    }

    // Schedule next question
    quiz.timers.intermission = setTimeout(
      () => nextQuestion(ctx, chatId),
      quiz.settings.intermissionTime * 1000
    );
  } catch (error) {
    logger.error('Error in handleQuestionTimeout:', error);
    // Ensure quiz continues
    setTimeout(() => nextQuestion(ctx, chatId), 5000);
  }
}


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
function calculateResults(quiz) {
  try {
    const participants = Array.from(quiz.participants.values());
    
    // Sort participants by score
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
    
    // Build leaderboard text
    let leaderboard = '';
    topPerformers.forEach((p, index) => {
      // Select medal based on position
      let medal;
      if (index === 0) medal = UI.ICONS.MEDAL_GOLD;
      else if (index === 1) medal = UI.ICONS.MEDAL_SILVER;
      else if (index === 2) medal = UI.ICONS.MEDAL_BRONZE;
      else medal = `${index + 1}.`;
      
      // Format display name
      const displayName = p.username ? `@${p.username}` : p.firstName;
      
      // Add to leaderboard showing points (first correct answers) and total correct
      leaderboard += `${medal} <b>${displayName}</b> - ${p.score} points (${p.correctAnswers}/${quiz.questions.length} correct)\n`;
    });
    
    // Handle no participants
    if (leaderboard === '') {
      leaderboard = 'No participants in this quiz!';
    }
    
    // Generate additional statistics
    let stats = '';
    
    if (participants.length > 0) {
      stats += `👥 <b>Total Participants:</b> ${participants.length}\n`;
      
      // Calculate average score
      const totalScore = participants.reduce((sum, p) => sum + p.score, 0);
      const avgScore = totalScore / participants.length;
      stats += `📊 <b>Average Score:</b> ${avgScore.toFixed(1)} points\n`;
      
      // Calculate average correct answers
      const totalCorrect = participants.reduce((sum, p) => sum + p.correctAnswers, 0);
      const avgCorrect = totalCorrect / participants.length;
      stats += `✅ <b>Average Correct:</b> ${avgCorrect.toFixed(1)}/${quiz.questions.length}\n`;
      
      // Find most contested questions (ones with most correct answers but not everyone got first)
      const contestedQuestions = quiz.questions
        .map((q, idx) => {
          const correctResponses = q.responses?.filter(r => r.isCorrect)?.length || 0;
          // A contested question has multiple correct answers but only one first
          return { 
            index: idx, 
            text: q.text,
            contestedScore: correctResponses > 0 ? correctResponses - 1 : 0 // Number of correct but not first
          };
        })
        .filter(q => q.contestedScore > 0)
        .sort((a, b) => b.contestedScore - a.contestedScore);
      
      if (contestedQuestions.length > 0) {
        const mostContested = contestedQuestions[0];
        const shortText = mostContested.text.length > 30 
          ? mostContested.text.substring(0, 27) + '...' 
          : mostContested.text;
        
        stats += `🔥 <b>Most Contested:</b> Q${mostContested.index + 1} - "${shortText}" (${mostContested.contestedScore} correct but not first)\n`;
      }
      
      // Add quiz duration
      if (quiz.startTime && quiz.endTime) {
        const durationMs = quiz.endTime - quiz.startTime;
        const durationMin = Math.floor(durationMs / 60000);
        const durationSec = Math.floor((durationMs % 60000) / 1000);
        stats += `⏱️ <b>Duration:</b> ${durationMin}m ${durationSec}s\n`;
      }
    }
    
    // Build the complete results message
    const groupMessage = 
      `🏆 <b>QUIZ COMPLETE!</b> 🏆\n` +
      `"${quiz.title}"\n\n` +
      `${UI.ICONS.CROWN} <b>LEADERBOARD</b> ${UI.ICONS.CROWN}\n` +
      `${leaderboard}\n` +
      `${stats}\n` +
      `<i>Points are awarded to the first person to answer correctly (1 point per question)</i>\n\n` +
      `Thanks for playing! Use /start_quiz to play another quiz.`;
    
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
};
