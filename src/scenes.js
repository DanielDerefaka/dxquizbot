/**
 * DXQuiz - Scene Definitions for Quiz Creation Wizard
 * Handles the step-by-step creation of quizzes
 */
const { Scenes, Markup } = require('telegraf');
const { v4: uuidv4 } = require('uuid');
const quizManager = require('./quizManager');
const utils = require('./utils');
const logger = require('./logger');
const { UI } = require('./handlers');

/**
 * Constants for quiz creation
 */
const QUIZ_CONSTRAINTS = {
  TITLE_MIN_LENGTH: 3,
  TITLE_MAX_LENGTH: 100,
  MIN_TIMER: 5,
  MAX_TIMER: 60,
  MIN_QUESTIONS: 1,
  MAX_QUESTIONS: 50,
  MIN_OPTIONS: 2,
  MAX_OPTIONS: 4,
  QUESTION_MIN_LENGTH: 5,
  QUESTION_MAX_LENGTH: 255,
  OPTION_MAX_LENGTH: 100
};

/**
 * Format a message with HTML
 * @param {string} title - Title of the message
 * @param {string} content - Content of the message
 * @param {string} icon - Optional icon
 */
function formatHTML(title, content, icon = '') {
  const titleText = icon ? `${icon} ${title}` : title;
  return `<b>${titleText}</b>\n\n${content}`;
}

/**
 * Scene for creating a quiz step by step
 */
const quizCreationScene = new Scenes.WizardScene(
  'create_quiz',
  // Step 1: Ask for quiz title
  async (ctx) => {
    try {
      // Check if user has reached quiz limit
      const hasReachedLimit = await quizManager.hasReachedQuizLimit(ctx.from.id);
      if (hasReachedLimit) {
        await ctx.replyWithHTML(
          `${UI.COLORS.WARNING} <b>Quiz Limit Reached</b>\n\n` +
          `You've reached the maximum number of quizzes you can create. ` +
          `Please delete some of your existing quizzes with /my_quizzes to create new ones.`
        );
        return ctx.scene.leave();
      }
      
      // Welcome message
      await ctx.replyWithHTML(
        formatHTML(
          `Quiz Creation Wizard`,
          `Let's create a new quiz! I'll guide you through the process step by step.\n\n` +
          `First, what should we call this quiz? Please send me a title.\n\n` +
          `${UI.ICONS.INFO} The title should be between ${QUIZ_CONSTRAINTS.TITLE_MIN_LENGTH}-${QUIZ_CONSTRAINTS.TITLE_MAX_LENGTH} characters.`,
          UI.ICONS.CREATE
        )
      );
      
      // Initialize quiz data in wizard state
      ctx.wizard.state.quizData = {
        id: uuidv4(),
        creator: ctx.from.id,
        creatorName: ctx.from.first_name,
        creatorUsername: ctx.from.username,
        questions: [],
        settings: {
          questionTime: 15, // Default timer
          intermissionTime: 3
        },
        createdAt: Date.now()
      };
      
      return ctx.wizard.next();
    } catch (error) {
      logger.error('Error in quiz creation step 1:', error);
      await ctx.reply(`${UI.COLORS.ERROR} An error occurred. Please try again later.`);
      return ctx.scene.leave();
    }
  },
  
  // Step 2: Get quiz title and ask for timer
  async (ctx) => {
    try {
      // Validate title input
      if (!ctx.message || !ctx.message.text) {
        await ctx.reply(`${UI.COLORS.ERROR} Please send me a text message with the quiz title.`);
        return;
      }
      
      const title = ctx.message.text.trim();
      
      // Validate title length
      if (title.length < QUIZ_CONSTRAINTS.TITLE_MIN_LENGTH) {
        await ctx.reply(
          `${UI.COLORS.ERROR} Title is too short. Please provide at least ${QUIZ_CONSTRAINTS.TITLE_MIN_LENGTH} characters.`
        );
        return;
      }
      
      if (title.length > QUIZ_CONSTRAINTS.TITLE_MAX_LENGTH) {
        await ctx.reply(
          `${UI.COLORS.ERROR} Title is too long. Maximum length is ${QUIZ_CONSTRAINTS.TITLE_MAX_LENGTH} characters.`
        );
        return;
      }
      
      // Save quiz title
      ctx.wizard.state.quizData.title = title;
      
      // Ask for timer duration with visual buttons
      await ctx.replyWithHTML(
        formatHTML(
          `Set Question Timer`,
          `How many seconds should players have to answer each question?\n\n` +
          `Choose a time between ${QUIZ_CONSTRAINTS.MIN_TIMER}-${QUIZ_CONSTRAINTS.MAX_TIMER} seconds:`,
          UI.ICONS.TIMER
        ),
        Markup.inlineKeyboard([
          [
            Markup.button.callback('10s', 'timer_10'),
            Markup.button.callback('15s', 'timer_15'),
            Markup.button.callback('20s', 'timer_20')
          ],
          [
            Markup.button.callback('30s', 'timer_30'),
            Markup.button.callback('45s', 'timer_45'),
            Markup.button.callback('60s', 'timer_60')
          ],
          [
            Markup.button.callback('Custom time', 'timer_custom')
          ]
        ])
      );
      
      return ctx.wizard.next();
    } catch (error) {
      logger.error('Error in quiz creation step 2:', error);
      await ctx.reply(`${UI.COLORS.ERROR} An error occurred while processing the quiz title.`);
      return ctx.scene.leave();
    }
  },
  
  // Step 3: Process timer selection and go to question input
  async (ctx) => {
    try {
      // Handle callback queries (button presses)
      if (ctx.callbackQuery) {
        const data = ctx.callbackQuery.data;
        
        // Handle timer selection
        if (data.startsWith('timer_')) {
          await ctx.answerCbQuery();
          
          // Check if custom time was selected
          if (data === 'timer_custom') {
            await ctx.reply(
              `${UI.ICONS.INFO} Please enter a custom time in seconds (${QUIZ_CONSTRAINTS.MIN_TIMER}-${QUIZ_CONSTRAINTS.MAX_TIMER}):`,
              Markup.forceReply()
            );
            return; // Stay in current step
          }
          
          // Parse selected time
          const match = data.match(/timer_(\d+)/);
          if (match) {
            const time = parseInt(match[1]);
            ctx.wizard.state.quizData.settings.questionTime = time;
            
            await ctx.replyWithHTML(
              formatHTML(
                `Timer Set`,
                `Timer set to <b>${time} seconds</b> per question.\n\n` +
                `Now let's add some questions to your quiz!`,
                UI.ICONS.SUCCESS
              )
            );
            
            // Start adding questions
            await promptForQuestion(ctx, 1);
            return ctx.wizard.next(); // Move to question input step
          }
        }
      } 
      // Handle text input (custom timer)
      else if (ctx.message && ctx.message.text) {
        const timeMatch = ctx.message.text.match(/(\d+)/);
        if (timeMatch) {
          let time = parseInt(timeMatch[1]);
          
          // Validate time range
          if (time < QUIZ_CONSTRAINTS.MIN_TIMER || time > QUIZ_CONSTRAINTS.MAX_TIMER) {
            await ctx.reply(
              `${UI.COLORS.ERROR} Time must be between ${QUIZ_CONSTRAINTS.MIN_TIMER} and ${QUIZ_CONSTRAINTS.MAX_TIMER} seconds. Please try again:`
            );
            return;
          }
          
          // Save timer setting
          ctx.wizard.state.quizData.settings.questionTime = time;
          
          await ctx.replyWithHTML(
            formatHTML(
              `Timer Set`,
              `Timer set to <b>${time} seconds</b> per question.\n\n` +
              `Now let's add some questions to your quiz!`,
              UI.ICONS.SUCCESS
            )
          );
          
          // Start adding questions
          await promptForQuestion(ctx, 1);
          return ctx.wizard.next(); // Move to question input step
        } else {
          // Invalid input, ask again
          await ctx.reply(
            `${UI.COLORS.ERROR} Please enter a valid number between ${QUIZ_CONSTRAINTS.MIN_TIMER} and ${QUIZ_CONSTRAINTS.MAX_TIMER}.`
          );
          return;
        }
      } else {
        // Invalid input, ask again
        await ctx.reply(
          `${UI.COLORS.ERROR} Please select a time from the buttons or type a number between ${QUIZ_CONSTRAINTS.MIN_TIMER} and ${QUIZ_CONSTRAINTS.MAX_TIMER}.`
        );
        return;
      }
    } catch (error) {
      logger.error('Error in quiz creation step 3:', error);
      await ctx.reply(`${UI.COLORS.ERROR} An error occurred while setting the timer.`);
      return ctx.scene.leave();
    }
  },
  
  // Step 4: Handle question input
  async (ctx) => {
    try {
      // Handle "done" command
      if (ctx.message && ctx.message.text && ctx.message.text.toLowerCase() === 'done') {
        // Check if we have enough questions
        if (ctx.wizard.state.quizData.questions.length < QUIZ_CONSTRAINTS.MIN_QUESTIONS) {
          await ctx.replyWithHTML(
            formatHTML(
              `More Questions Needed`,
              `You need to add at least <b>${QUIZ_CONSTRAINTS.MIN_QUESTIONS} question</b> to your quiz.\n\n` +
              `Please add a question in the correct format or type /cancel to exit.`,
              UI.COLORS.WARNING
            )
          );
          return;
        }
        
        // Save the quiz
        await quizManager.saveQuiz(ctx.wizard.state.quizData);
        
        // Show summary
        const questionCount = ctx.wizard.state.quizData.questions.length;
        const quizTitle = ctx.wizard.state.quizData.title;
        const quizId = ctx.wizard.state.quizData.id;
        
        await ctx.replyWithHTML(
          formatHTML(
            `Quiz Created Successfully!`,
            `Your quiz "<b>${quizTitle}</b>" has been created with ${questionCount} questions.\n\n` +
            `${UI.ICONS.PLAY} <b>To start this quiz in a group:</b>\n` +
            `1. Add me to your group\n` +
            `2. Use this command in the group:\n` +
            `/start_quiz ${quizId}\n\n` +
            `${UI.ICONS.LIST} Use /my_quizzes to manage your quizzes.`,
            UI.ICONS.SUCCESS
          ),
          Markup.inlineKeyboard([
            [Markup.button.callback(`${UI.ICONS.LIST} View My Quizzes`, 'my_quizzes')]
          ])
        );
        
        return ctx.scene.leave();
      }
      
      // Handle question input
      if (!ctx.message || !ctx.message.text) {
        await ctx.reply(
          `${UI.COLORS.ERROR} Please send me a question in the correct format, or type "done" to finish.`
        );
        return;
      }
      
      // Parse question input
      const parsedQuestion = parseQuestionInput(ctx.message.text);
      if (!parsedQuestion) {
        await ctx.replyWithHTML(
          formatHTML(
            `Invalid Question Format`,
            `Please use this format:\n\n` +
            `Question: Who invented the telephone?\n` +
            `A. Thomas Edison\n` +
            `B. Alexander Graham Bell\n` +
            `C. Nikola Tesla\n` +
            `D. Guglielmo Marconi\n` +
            `Correct: B\n\n` +
            `Or type "done" to finish.`,
            UI.COLORS.ERROR
          )
        );
        return;
      }
      
      // Validate question content
      if (parsedQuestion.questionText.length < QUIZ_CONSTRAINTS.QUESTION_MIN_LENGTH) {
        await ctx.reply(
          `${UI.COLORS.ERROR} Question text is too short. Please provide at least ${QUIZ_CONSTRAINTS.QUESTION_MIN_LENGTH} characters.`
        );
        return;
      }
      
      if (parsedQuestion.questionText.length > QUIZ_CONSTRAINTS.QUESTION_MAX_LENGTH) {
        await ctx.reply(
          `${UI.COLORS.ERROR} Question text is too long. Maximum length is ${QUIZ_CONSTRAINTS.QUESTION_MAX_LENGTH} characters.`
        );
        return;
      }
      
      // Check for valid options
      for (const option of parsedQuestion.options) {
        if (option.length > QUIZ_CONSTRAINTS.OPTION_MAX_LENGTH) {
          await ctx.reply(
            `${UI.COLORS.ERROR} Answer option is too long. Maximum length is ${QUIZ_CONSTRAINTS.OPTION_MAX_LENGTH} characters.`
          );
          return;
        }
      }
      
      // Add the question
      ctx.wizard.state.quizData.questions.push({
        text: parsedQuestion.questionText,
        options: parsedQuestion.options,
        correctAnswer: parsedQuestion.correctAnswer
      });
      
      const questionCount = ctx.wizard.state.quizData.questions.length;
      
      // Check if maximum questions reached
      if (questionCount >= QUIZ_CONSTRAINTS.MAX_QUESTIONS) {
        await ctx.replyWithHTML(
          formatHTML(
            `Question Added!`,
            `You've reached the maximum limit of ${QUIZ_CONSTRAINTS.MAX_QUESTIONS} questions.\n\n` +
            `Your quiz is now complete! Saving...`,
            UI.ICONS.SUCCESS
          )
        );
        
        // Save the quiz
        await quizManager.saveQuiz(ctx.wizard.state.quizData);
        
        // Show completion message
        const quizTitle = ctx.wizard.state.quizData.title;
        const quizId = ctx.wizard.state.quizData.id;
        
        await ctx.replyWithHTML(
          formatHTML(
            `Quiz Created Successfully!`,
            `Your quiz "<b>${quizTitle}</b>" has been created with ${questionCount} questions.\n\n` +
            `${UI.ICONS.PLAY} <b>To start this quiz in a group:</b>\n` +
            `1. Add me to your group\n` +
            `2. Use this command in the group:\n` +
            `/start_quiz ${quizId}\n\n` +
            `${UI.ICONS.LIST} Use /my_quizzes to manage your quizzes.`,
            UI.ICONS.SUCCESS
          ),
          Markup.inlineKeyboard([
            [Markup.button.callback(`${UI.ICONS.LIST} View My Quizzes`, 'my_quizzes')]
          ])
        );
        
        return ctx.scene.leave();
      }
      
      // Question added successfully, show confirmation
      await ctx.replyWithHTML(
        formatHTML(
          `Question ${questionCount} Added!`,
          `You can add another question or type "done" to finish.`,
          UI.ICONS.SUCCESS
        )
      );
      
      // Prompt for next question
      await promptForQuestion(ctx, questionCount + 1);
    } catch (error) {
      logger.error('Error in quiz creation step 4:', error);
      await ctx.reply(`${UI.COLORS.ERROR} An error occurred while processing your question.`);
      return ctx.scene.leave();
    }
  }
);

/**
 * Helper function to prompt for a new question
 * @param {Object} ctx - Telegram context
 * @param {number} number - Question number
 */
async function promptForQuestion(ctx, number) {
  await ctx.replyWithHTML(
    formatHTML(
      `Question ${number}`,
      `Please send your question in this format:\n\n` +
      `Question: Who invented the telephone?\n` +
      `A. Thomas Edison\n` +
      `B. Alexander Graham Bell\n` +
      `C. Nikola Tesla\n` +
      `D. Guglielmo Marconi\n` +
      `Correct: B\n\n` +
      `Or type "done" to finish your quiz.`,
      UI.ICONS.CREATE
    )
  );
}

/**
 * Helper function to parse question input
 * @param {string} text - Question text input
 * @returns {Object|null} Parsed question data or null if invalid
 */
function parseQuestionInput(text) {
  try {
    // Extract question text
    const questionMatch = text.match(/Question:\s*(.+?)(?=\nA\.|\n$)/s);
    if (!questionMatch) return null;
    const questionText = questionMatch[1].trim();
    
    // Extract options
    const optionA = text.match(/A\.\s*(.+?)(?=\nB\.|\n|$)/s)?.[1]?.trim();
    const optionB = text.match(/B\.\s*(.+?)(?=\nC\.|\n|$)/s)?.[1]?.trim();
    const optionC = text.match(/C\.\s*(.+?)(?=\nD\.|\n|$)/s)?.[1]?.trim();
    const optionD = text.match(/D\.\s*(.+?)(?=\nCorrect:|\n|$)/s)?.[1]?.trim();
    
    if (!optionA || !optionB || !optionC || !optionD) return null;
    
    // Extract correct answer
    const correctMatch = text.match(/Correct:\s*([A-D])/i);
    if (!correctMatch) return null;
    
    const correctLetter = correctMatch[1].toUpperCase();
    const correctIndex = correctLetter.charCodeAt(0) - 'A'.charCodeAt(0);
    
    // Ensure correctIndex is valid
    if (correctIndex < 0 || correctIndex > 3) return null;
    
    return {
      questionText,
      options: [optionA, optionB, optionC, optionD],
      correctAnswer: correctIndex
    };
  } catch (error) {
    logger.error("Error parsing question:", error);
    return null;
  }
}

// Add button handlers for timer selection
const timerActions = [10, 15, 20, 30, 45, 60];
timerActions.forEach(time => {
  quizCreationScene.action(`timer_${time}`, async (ctx) => {
    try {
      ctx.wizard.state.quizData.settings.questionTime = time;
      await ctx.answerCbQuery(`Timer set to ${time} seconds!`);
      
      await ctx.replyWithHTML(
        formatHTML(
          `Timer Set`,
          `Timer set to <b>${time} seconds</b> per question.\n\n` +
          `Now let's add some questions to your quiz!`,
          UI.ICONS.SUCCESS
        )
      );
      
      // Start adding questions
      await promptForQuestion(ctx, 1);
      return ctx.wizard.next();
    } catch (error) {
      logger.error('Error in timer selection handler:', error);
      await ctx.answerCbQuery('An error occurred. Please try again.');
    }
  });
});

// Custom timer action
quizCreationScene.action('timer_custom', async (ctx) => {
  try {
    await ctx.answerCbQuery();
    await ctx.reply(
      `${UI.ICONS.INFO} Please enter a custom time in seconds (${QUIZ_CONSTRAINTS.MIN_TIMER}-${QUIZ_CONSTRAINTS.MAX_TIMER}):`,
      Markup.forceReply()
    );
  } catch (error) {
    logger.error('Error in custom timer handler:', error);
    await ctx.answerCbQuery('An error occurred. Please try again.');
  }
});

// Cancel action
quizCreationScene.command('cancel', async (ctx) => {
  await ctx.reply(`${UI.ICONS.INFO} Quiz creation cancelled.`);
  return ctx.scene.leave();
});

// Add help command
quizCreationScene.command('help', async (ctx) => {
  await ctx.replyWithHTML(
    formatHTML(
      `Quiz Creation Help`,
      `You're currently creating a quiz. Follow these steps:\n\n` +
      `1. Provide a quiz title\n` +
      `2. Set the timer for questions\n` +
      `3. Add questions with answer options\n` +
      `4. Type "done" when finished\n\n` +
      `To cancel quiz creation, use /cancel`,
      UI.ICONS.INFO
    )
  );
});

module.exports = {
  quizCreationScene
};