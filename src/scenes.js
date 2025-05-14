/**
 * Zano Quiz - Enhanced Scene Definitions for Quiz Creation Wizard
 * Handles the step-by-step creation of quizzes with improved UX
 */
const { Scenes, Markup } = require("telegraf");
const { v4: uuidv4 } = require("uuid");
const quizManager = require("./quizManager");
const utils = require("./utils");
const logger = require("./logger");
const { UI } = require("./handlers");

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
  OPTION_MAX_LENGTH: 100,
};

/**
 * Available quiz categories
 */
const QUIZ_CATEGORIES = [
  "General Knowledge",
  "Science",
  "History",
  "Geography",
  "Entertainment",
  "Sports",
  "Literature",
  "Art",
  "Technology",
  "Mathematics",
  "Languages",
  "Music",
  "Movies",
  "Current Events",
  "Custom"
];

/**
 * Format a message with HTML
 * @param {string} title - Title of the message
 * @param {string} content - Content of the message
 * @param {string} icon - Optional icon
 */
function formatHTML(title, content, icon = "") {
  const titleText = icon ? `${icon} ${title}` : title;
  return `<b>${titleText}</b>\n\n${content}`;
}

/**
 * Create keyboard with categories
 * @returns {Object} Inline keyboard markup
 */
function createCategoryKeyboard() {
  const buttons = [];
  const categoriesPerRow = 2;
  
  // Create rows of category buttons
  for (let i = 0; i < QUIZ_CATEGORIES.length; i += categoriesPerRow) {
    const row = [];
    for (let j = 0; j < categoriesPerRow && i + j < QUIZ_CATEGORIES.length; j++) {
      const category = QUIZ_CATEGORIES[i + j];
      row.push(Markup.button.callback(category, `category_${category}`));
    }
    buttons.push(row);
  }
  
  return Markup.inlineKeyboard(buttons);
}

/**
 * Enhanced scene for creating a quiz step by step
 */
const quizCreationScene = new Scenes.WizardScene(
  "create_quiz",
  // Step 1: Ask for quiz title
  async (ctx) => {
    try {
      // Check if user has reached quiz limit
      const hasReachedLimit = await quizManager.hasReachedQuizLimit(
        ctx.from.id
      );
      if (hasReachedLimit) {
        await ctx.replyWithHTML(
          formatHTML(
            `Quiz Limit Reached`,
            `You've reached the maximum number of quizzes you can create (${MAX_QUIZZES_PER_USER}). ` +
              `Please delete some of your existing quizzes with /my_quizzes to create new ones.`,
            UI.COLORS.WARNING
          )
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
          intermissionTime: 3,
        },
        createdAt: Date.now(),
        shared: false,
        sharedWith: [],
        category: "Uncategorized"
      };

      return ctx.wizard.next();
    } catch (error) {
      logger.error("Error in quiz creation step 1:", error);
      await ctx.reply(
        `${UI.COLORS.ERROR} An error occurred. Please try again later.`
      );
      return ctx.scene.leave();
    }
  },

  // Step 2: Get quiz title and ask for category
  async (ctx) => {
    try {
      // Validate title input
      if (!ctx.message || !ctx.message.text) {
        await ctx.reply(
          `${UI.COLORS.ERROR} Please send me a text message with the quiz title.`
        );
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

      // Ask for category
      await ctx.replyWithHTML(
        formatHTML(
          `Select Quiz Category`,
          `Now, let's categorize your quiz. This helps with organization and searching later.\n\n` +
          `Please select a category from the options below:`,
          UI.ICONS.LIST
        ),
        createCategoryKeyboard()
      );

      return ctx.wizard.next();
    } catch (error) {
      logger.error("Error in quiz creation step 2:", error);
      await ctx.reply(
        `${UI.COLORS.ERROR} An error occurred while processing the quiz title.`
      );
      return ctx.scene.leave();
    }
  },

  // Step 3: Process category selection and ask for timer
  async (ctx) => {
    try {
      let category;
      
      // Handle callback queries (button presses) for categories
      if (ctx.callbackQuery) {
        const data = ctx.callbackQuery.data;
        
        if (data.startsWith("category_")) {
          await ctx.answerCbQuery();
          category = data.replace("category_", "");
          
          // If custom category was selected, prompt for input
          if (category === "Custom") {
            await ctx.reply(
              `${UI.ICONS.INFO} Please enter a custom category name:`,
              Markup.forceReply()
            );
            return; // Stay in current step
          }
        } else {
          await ctx.answerCbQuery("Please select a category");
          return; // Stay in current step
        }
      }
      // Handle text input for custom category
      else if (ctx.message && ctx.message.text) {
        category = ctx.message.text.trim();
        
        // Validate category length
        if (category.length < 2 || category.length > 30) {
          await ctx.reply(
            `${UI.COLORS.ERROR} Category name must be between 2 and 30 characters. Please try again:`
          );
          return; // Stay in current step
        }
      } else {
        // Invalid input, ask again
        await ctx.reply(
          `${UI.COLORS.ERROR} Please select a category from the buttons or type a custom category name.`
        );
        return; // Stay in current step
      }
      
      // Save category
      ctx.wizard.state.quizData.category = category;
      
      // Ask for timer duration with visual buttons
      await ctx.replyWithHTML(
        formatHTML(
          `Set Question Timer`,
          `Great choice! Your quiz is categorized as <b>${category}</b>.\n\n` +
          `Now, how many seconds should players have to answer each question?\n\n` +
          `Choose a time between ${QUIZ_CONSTRAINTS.MIN_TIMER}-${QUIZ_CONSTRAINTS.MAX_TIMER} seconds:`,
          UI.ICONS.TIMER
        ),
        Markup.inlineKeyboard([
          [
            Markup.button.callback("10s", "timer_10"),
            Markup.button.callback("15s", "timer_15"),
            Markup.button.callback("20s", "timer_20"),
          ],
          [
            Markup.button.callback("30s", "timer_30"),
            Markup.button.callback("45s", "timer_45"),
            Markup.button.callback("60s", "timer_60"),
          ],
          [Markup.button.callback("Custom time", "timer_custom")],
        ])
      );

      return ctx.wizard.next();
    } catch (error) {
      logger.error("Error in quiz creation step 3:", error);
      await ctx.reply(
        `${UI.COLORS.ERROR} An error occurred while setting the category.`
      );
      return ctx.scene.leave();
    }
  },

  // Step 4: Process timer selection and go to question creation
  async (ctx) => {
    try {
      // Handle callback queries (button presses)
      if (ctx.callbackQuery) {
        const data = ctx.callbackQuery.data;

        // Handle timer selection
        if (data.startsWith("timer_")) {
          await ctx.answerCbQuery();

          // Check if custom time was selected
          if (data === "timer_custom") {
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
                  `Now let's add some questions to your quiz! Let's start with the first question.`,
                UI.ICONS.SUCCESS
              )
            );

            // Initialize question creation state
            ctx.wizard.state.currentQuestion = {
              index: 0,
              text: "",
              options: ["", "", "", ""],
              stage: "text", // text -> options -> correct
              currentOption: 0
            };
            
            // Go to question text prompt
            await promptForQuestionText(ctx);
            
            return ctx.wizard.next(); // Move to question creation step
          }
        }
      }
      // Handle text input (custom timer)
      else if (ctx.message && ctx.message.text) {
        const timeMatch = ctx.message.text.match(/(\d+)/);
        if (timeMatch) {
          let time = parseInt(timeMatch[1]);

          // Validate time range
          if (
            time < QUIZ_CONSTRAINTS.MIN_TIMER ||
            time > QUIZ_CONSTRAINTS.MAX_TIMER
          ) {
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
                `Now let's add some questions to your quiz! Let's start with the first question.`,
              UI.ICONS.SUCCESS
            )
          );

          // Initialize question creation state
          ctx.wizard.state.currentQuestion = {
            index: 0,
            text: "",
            options: ["", "", "", ""],
            stage: "text", // text -> options -> correct
            currentOption: 0
          };
          
          // Go to question text prompt
          await promptForQuestionText(ctx);
          
          return ctx.wizard.next(); // Move to question creation step
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
      logger.error("Error in quiz creation step 4:", error);
      await ctx.reply(
        `${UI.COLORS.ERROR} An error occurred while setting the timer.`
      );
      return ctx.scene.leave();
    }
  },

  // Step 5: Enhanced question creation flow
  async (ctx) => {
    try {
      // Check for "done" command to finish quiz
      if (
        ctx.message &&
        ctx.message.text &&
        ctx.message.text.toLowerCase() === "done"
      ) {
        return await handleDoneCommand(ctx);
      }
      
      // Get current question state
      const currentQuestion = ctx.wizard.state.currentQuestion;
      
      // Process input based on the current stage of question creation
      if (currentQuestion.stage === "text") {
        // Process question text input
        if (!ctx.message || !ctx.message.text) {
          await ctx.reply(
            `${UI.COLORS.ERROR} Please send the question text.`
          );
          return;
        }
        
        const questionText = ctx.message.text.trim();
        
        // Validate question text
        if (questionText.length < QUIZ_CONSTRAINTS.QUESTION_MIN_LENGTH) {
          await ctx.reply(
            `${UI.COLORS.ERROR} Question text is too short. Please provide at least ${QUIZ_CONSTRAINTS.QUESTION_MIN_LENGTH} characters.`
          );
          return;
        }
        
        if (questionText.length > QUIZ_CONSTRAINTS.QUESTION_MAX_LENGTH) {
          await ctx.reply(
            `${UI.COLORS.ERROR} Question text is too long. Maximum length is ${QUIZ_CONSTRAINTS.QUESTION_MAX_LENGTH} characters.`
          );
          return;
        }
        
        // Save question text
        currentQuestion.text = questionText;
        
        // Move to options stage
        currentQuestion.stage = "options";
        currentQuestion.currentOption = 0;
        
        // Prompt for first answer option
        await promptForOption(ctx, currentQuestion.currentOption);
        return;
      }
      else if (currentQuestion.stage === "options") {
        // Process option input
        if (!ctx.message || !ctx.message.text) {
          await ctx.reply(
            `${UI.COLORS.ERROR} Please send the answer option text.`
          );
          return;
        }
        
        const optionText = ctx.message.text.trim();
        
        // Validate option text
        if (optionText.length < 1) {
          await ctx.reply(
            `${UI.COLORS.ERROR} Option text cannot be empty. Please provide some text.`
          );
          return;
        }
        
        if (optionText.length > QUIZ_CONSTRAINTS.OPTION_MAX_LENGTH) {
          await ctx.reply(
            `${UI.COLORS.ERROR} Option text is too long. Maximum length is ${QUIZ_CONSTRAINTS.OPTION_MAX_LENGTH} characters.`
          );
          return;
        }
        
        // Save current option
        currentQuestion.options[currentQuestion.currentOption] = optionText;
        
        // Move to next option or to correct answer selection
        currentQuestion.currentOption++;
        
        if (currentQuestion.currentOption < 4) {
          // Prompt for next option
          await promptForOption(ctx, currentQuestion.currentOption);
        } else {
          // All options provided, move to correct answer selection
          currentQuestion.stage = "correct";
          await promptForCorrectAnswer(ctx, currentQuestion);
        }
        
        return;
      }
      else if (currentQuestion.stage === "correct") {
        // Process correct answer selection
        let correctIndex = -1;
        
        if (ctx.callbackQuery) {
          // Handle button selection
          const data = ctx.callbackQuery.data;
          if (data.startsWith("correct_")) {
            await ctx.answerCbQuery();
            correctIndex = parseInt(data.replace("correct_", ""));
          }
        } else if (ctx.message && ctx.message.text) {
          // Handle text input (A, B, C, D)
          const letterMap = { A: 0, B: 1, C: 2, D: 3 };
          const letter = ctx.message.text.trim().toUpperCase();
          
          if (letterMap[letter] !== undefined) {
            correctIndex = letterMap[letter];
          } else {
            // Try to parse as number
            const num = parseInt(ctx.message.text.trim());
            if (!isNaN(num) && num >= 1 && num <= 4) {
              correctIndex = num - 1;
            }
          }
        }
        
        if (correctIndex < 0 || correctIndex > 3) {
          await ctx.reply(
            `${UI.COLORS.ERROR} Please select a valid answer option (A, B, C, D or 1, 2, 3, 4).`
          );
          return;
        }
        
        // Complete the question
        const completedQuestion = {
          text: currentQuestion.text,
          options: [...currentQuestion.options],
          correctAnswer: correctIndex
        };
        
        // Add to quiz
        ctx.wizard.state.quizData.questions.push(completedQuestion);
        
        // Show question preview
        await showQuestionPreview(ctx, completedQuestion, ctx.wizard.state.quizData.questions.length);
        
        // Check if maximum questions reached
        if (ctx.wizard.state.quizData.questions.length >= QUIZ_CONSTRAINTS.MAX_QUESTIONS) {
          await ctx.replyWithHTML(
            formatHTML(
              `Maximum Questions Reached`,
              `You've reached the maximum limit of ${QUIZ_CONSTRAINTS.MAX_QUESTIONS} questions.\n\n` +
              `Your quiz is now complete! Saving...`,
              UI.COLORS.SUCCESS
            )
          );
          
          // Save and complete the quiz
          return await finalizeQuiz(ctx);
        }
        
        // Prepare for next question
        await ctx.replyWithHTML(
          formatHTML(
            `Question Added!`,
            `Question ${ctx.wizard.state.quizData.questions.length} has been added to your quiz.\n\n` +
            `Would you like to add another question or finish the quiz?`,
            UI.ICONS.SUCCESS
          ),
          Markup.inlineKeyboard([
            [
              Markup.button.callback(`${UI.ICONS.CREATE} Add Another Question`, `add_question`),
              Markup.button.callback(`${UI.ICONS.SUCCESS} Finish Quiz`, `finish_quiz`)
            ]
          ])
        );
        
        // Reset current question state
        ctx.wizard.state.currentQuestion = {
          index: ctx.wizard.state.quizData.questions.length,
          text: "",
          options: ["", "", "", ""],
          stage: "pending", // pending -> text -> options -> correct
          currentOption: 0
        };
        
        return;
      }
      else if (currentQuestion.stage === "pending") {
        // Waiting for user to choose add question or finish
        if (ctx.callbackQuery) {
          const data = ctx.callbackQuery.data;
          
          if (data === "add_question") {
            await ctx.answerCbQuery("Adding new question...");
            
            // Start new question
            currentQuestion.stage = "text";
            await promptForQuestionText(ctx);
            return;
          }
          else if (data === "finish_quiz") {
            await ctx.answerCbQuery("Finishing quiz...");
            
            // Finalize quiz
            return await finalizeQuiz(ctx);
          }
        }
        
        // Invalid input
        await ctx.reply(
          `${UI.COLORS.ERROR} Please select an option from the buttons or type "done" to finish.`
        );
        return;
      }
    } catch (error) {
      logger.error("Error in quiz creation step 5:", error);
      await ctx.reply(
        `${UI.COLORS.ERROR} An error occurred while creating the question.`
      );
      // Try to continue with next question rather than exiting
      try {
        // Reset current question state
        ctx.wizard.state.currentQuestion = {
          index: ctx.wizard.state.quizData.questions.length,
          text: "",
          options: ["", "", "", ""],
          stage: "text",
          currentOption: 0
        };
        
        await promptForQuestionText(ctx);
      } catch (e) {
        logger.error("Failed to recover from error:", e);
        return ctx.scene.leave();
      }
    }
  }
);

/**
 * Prompt for question text
 * @param {Object} ctx - Telegram context
 */
async function promptForQuestionText(ctx) {
  const questionNumber = ctx.wizard.state.currentQuestion.index + 1;
  
  await ctx.replyWithHTML(
    formatHTML(
      `Question ${questionNumber}`,
      `Please enter the text for question ${questionNumber}:\n\n` +
      `Example: "Who was the first person to walk on the moon?"\n\n` +
      `${UI.ICONS.INFO} Type "done" at any time to finish creating questions.`,
      UI.ICONS.CREATE
    )
  );
}

/**
 * Prompt for answer option
 * @param {Object} ctx - Telegram context
 * @param {number} optionIndex - Current option index
 */
async function promptForOption(ctx, optionIndex) {
  const letters = ["A", "B", "C", "D"];
  const letter = letters[optionIndex];
  
  await ctx.replyWithHTML(
    formatHTML(
      `Option ${letter}`,
      `Please enter the text for answer option ${letter}:\n\n` +
      `Example: "${optionIndex === 0 ? 'Neil Armstrong' : optionIndex === 1 ? 'Buzz Aldrin' : optionIndex === 2 ? 'Yuri Gagarin' : 'John Glenn'}"`,
      UI.ICONS.CREATE
    )
  );
}

/**
 * Prompt for correct answer selection
 * @param {Object} ctx - Telegram context
 * @param {Object} question - Current question data
 */
async function promptForCorrectAnswer(ctx, question) {
  const options = question.options;
  const letters = ["A", "B", "C", "D"];
  
  let message = formatHTML(
    `Select Correct Answer`,
    `Here are the options for your question:\n\n` +
    `<b>Question:</b> ${question.text}\n\n`,
    UI.ICONS.INFO
  );
  
  // Format options
  for (let i = 0; i < 4; i++) {
    message += `<b>${letters[i]}.</b> ${options[i]}\n`;
  }
  
  message += `\nWhich option is the correct answer? Select A, B, C, or D:`;
  
  // Create buttons for options
  const buttons = [];
  for (let i = 0; i < 4; i++) {
    buttons.push(Markup.button.callback(
      `Option ${letters[i]}`,
      `correct_${i}`
    ));
  }
  
  await ctx.replyWithHTML(
    message,
    Markup.inlineKeyboard([buttons])
  );
}

/**
 * Show preview of a question
 * @param {Object} ctx - Telegram context
 * @param {Object} question - Question data
 * @param {number} questionNumber - Question number
 */
async function showQuestionPreview(ctx, question, questionNumber) {
  const letters = ["A", "B", "C", "D"];
  const correctLetter = letters[question.correctAnswer];
  
  let message = formatHTML(
    `Question ${questionNumber} Preview`,
    `<b>Question:</b> ${question.text}\n\n`,
    UI.ICONS.SUCCESS
  );
  
  // Format options, highlighting correct answer
  for (let i = 0; i < 4; i++) {
    const isCorrect = i === question.correctAnswer;
    message += isCorrect 
      ? `<b>${letters[i]}. ${question.options[i]}</b> ✅\n` 
      : `${letters[i]}. ${question.options[i]}\n`;
  }
  
  await ctx.replyWithHTML(message);
}

/**
 * Handle "done" command to finish quiz
 * @param {Object} ctx - Telegram context
 */
async function handleDoneCommand(ctx) {
  // Check if we have enough questions
  if (
    ctx.wizard.state.quizData.questions.length <
    QUIZ_CONSTRAINTS.MIN_QUESTIONS
  ) {
    await ctx.replyWithHTML(
      formatHTML(
        `More Questions Needed`,
        `You need to add at least <b>${QUIZ_CONSTRAINTS.MIN_QUESTIONS} question</b> to your quiz.\n\n` +
          `Please add a question or type /cancel to exit.`,
        UI.COLORS.WARNING
      )
    );
    
    // Reset to asking for question text
    ctx.wizard.state.currentQuestion.stage = "text";
    await promptForQuestionText(ctx);
    return;
  }

  // Complete the quiz
  return await finalizeQuiz(ctx);
}

/**
 * Finalize and save the quiz
 * @param {Object} ctx - Telegram context
 */
async function finalizeQuiz(ctx) {
  try {
    // Save the quiz
    await quizManager.saveQuiz(ctx.wizard.state.quizData);

    // Show summary
    const questionCount = ctx.wizard.state.quizData.questions.length;
    const quizTitle = ctx.wizard.state.quizData.title;
    const quizId = ctx.wizard.state.quizData.id;
    const category = ctx.wizard.state.quizData.category;

    await ctx.replyWithHTML(
      formatHTML(
        `Quiz Created Successfully!`,
        `Your quiz "<b>${quizTitle}</b>" has been created with ${questionCount} questions in the ${category} category.\n\n` +
          `${UI.ICONS.PLAY} <b>To start this quiz in a group:</b>\n` +
          `1. Add me to your group\n` +
          `2. Use this command in the group:\n` +
          `/start_quiz ${quizId}\n\n` +
          `${UI.ICONS.LIST} Use /my_quizzes to manage your quizzes.`,
        UI.ICONS.SUCCESS
      ),
      Markup.inlineKeyboard([
        [
          Markup.button.callback(
            `${UI.ICONS.LIST} View My Quizzes`,
            "my_quizzes"
          ),
        ],
        [
          Markup.button.callback(
            `${UI.ICONS.SHARE} Share This Quiz`,
            `share_quiz_${quizId}`
          ),
        ],
      ])
    );

    return ctx.scene.leave();
  } catch (error) {
    logger.error("Error saving quiz:", error);
    await ctx.reply(
      `${UI.COLORS.ERROR} An error occurred while saving your quiz. Please try again later.`
    );
    return ctx.scene.leave();
  }
}

// Add button handlers for the creation process
quizCreationScene.action(/category_(.+)/, async (ctx) => {
  try {
    const category = ctx.match[1];
    await ctx.answerCbQuery(`Selected category: ${category}`);
    
    // Update category in state
    ctx.wizard.state.quizData.category = category;
    
    // If custom selected, prompt for custom category
    if (category === "Custom") {
      await ctx.reply(
        `${UI.ICONS.INFO} Please enter a custom category name:`,
        Markup.forceReply()
      );
      return;
    }
    
    // Move to timer step
    await ctx.replyWithHTML(
      formatHTML(
        `Set Question Timer`,
        `Great choice! Your quiz is categorized as <b>${category}</b>.\n\n` +
        `Now, how many seconds should players have to answer each question?\n\n` +
        `Choose a time between ${QUIZ_CONSTRAINTS.MIN_TIMER}-${QUIZ_CONSTRAINTS.MAX_TIMER} seconds:`,
        UI.ICONS.TIMER
      ),
      Markup.inlineKeyboard([
        [
          Markup.button.callback("10s", "timer_10"),
          Markup.button.callback("15s", "timer_15"),
          Markup.button.callback("20s", "timer_20"),
        ],
        [
          Markup.button.callback("30s", "timer_30"),
          Markup.button.callback("45s", "timer_45"),
          Markup.button.callback("60s", "timer_60"),
        ],
        [Markup.button.callback("Custom time", "timer_custom")],
      ])
    );
    
    ctx.wizard.next();
  } catch (error) {
    logger.error("Error in category selection handler:", error);
    await ctx.answerCbQuery("An error occurred. Please try again.");
  }
});

// Add timer selection handlers
const timerActions = [10, 15, 20, 30, 45, 60];
timerActions.forEach((time) => {
  quizCreationScene.action(`timer_${time}`, async (ctx) => {
    try {
      ctx.wizard.state.quizData.settings.questionTime = time;
      await ctx.answerCbQuery(`Timer set to ${time} seconds!`);

      await ctx.replyWithHTML(
        formatHTML(
          `Timer Set`,
          `Timer set to <b>${time} seconds</b> per question.\n\n` +
            `Now let's add some questions to your quiz! Let's start with the first question.`,
          UI.ICONS.SUCCESS
        )
      );

      // Initialize question creation state
      ctx.wizard.state.currentQuestion = {
        index: 0,
        text: "",
        options: ["", "", "", ""],
        stage: "text", // text -> options -> correct
        currentOption: 0
      };
      
      // Go to question text prompt
      await promptForQuestionText(ctx);
      
      ctx.wizard.next();
    } catch (error) {
      logger.error("Error in timer selection handler:", error);
      await ctx.answerCbQuery("An error occurred. Please try again.");
    }
  });
});

// Custom timer action
quizCreationScene.action("timer_custom", async (ctx) => {
  try {
    await ctx.answerCbQuery();
    await ctx.reply(


      `${UI.ICONS.INFO} Please enter a custom time in seconds (${QUIZ_CONSTRAINTS.MIN_TIMER}-${QUIZ_CONSTRAINTS.MAX_TIMER}):`,
      Markup.forceReply()
    );
  } catch (error) {
    logger.error("Error in custom timer handler:", error);
    await ctx.answerCbQuery("An error occurred. Please try again.");
  }
});

// Add question action
quizCreationScene.action("add_question", async (ctx) => {
  try {
    await ctx.answerCbQuery("Adding new question...");
    
    // Update current question state
    ctx.wizard.state.currentQuestion.stage = "text";
    await promptForQuestionText(ctx);
  } catch (error) {
    logger.error("Error in add question handler:", error);
    await ctx.answerCbQuery("An error occurred. Please try again.");
  }
});

// Finish quiz action
quizCreationScene.action("finish_quiz", async (ctx) => {
  try {
    await ctx.answerCbQuery("Finalizing quiz...");
    await finalizeQuiz(ctx);
  } catch (error) {
    logger.error("Error in finish quiz handler:", error);
    await ctx.answerCbQuery("An error occurred. Please try again.");
  }
});

// Correct answer selection actions
for (let i = 0; i < 4; i++) {
  quizCreationScene.action(`correct_${i}`, async (ctx) => {
    try {
      const letter = ["A", "B", "C", "D"][i];
      await ctx.answerCbQuery(`Option ${letter} selected as correct answer`);
      
      // Complete the question with the selected correct answer
      const currentQuestion = ctx.wizard.state.currentQuestion;
      
      // Create completed question
      const completedQuestion = {
        text: currentQuestion.text,
        options: [...currentQuestion.options],
        correctAnswer: i
      };
      
      // Add to quiz
      ctx.wizard.state.quizData.questions.push(completedQuestion);
      
      // Show question preview
      await showQuestionPreview(ctx, completedQuestion, ctx.wizard.state.quizData.questions.length);
      
      // Check if maximum questions reached
      if (ctx.wizard.state.quizData.questions.length >= QUIZ_CONSTRAINTS.MAX_QUESTIONS) {
        await ctx.replyWithHTML(
          formatHTML(
            `Maximum Questions Reached`,
            `You've reached the maximum limit of ${QUIZ_CONSTRAINTS.MAX_QUESTIONS} questions.\n\n` +
            `Your quiz is now complete! Saving...`,
            UI.COLORS.SUCCESS
          )
        );
        
        // Save and complete the quiz
        return await finalizeQuiz(ctx);
      }
      
      // Prepare for next question
      await ctx.replyWithHTML(
        formatHTML(
          `Question Added!`,
          `Question ${ctx.wizard.state.quizData.questions.length} has been added to your quiz.\n\n` +
          `Would you like to add another question or finish the quiz?`,
          UI.ICONS.SUCCESS
        ),
        Markup.inlineKeyboard([
          [
            Markup.button.callback(`${UI.ICONS.CREATE} Add Another Question`, `add_question`),
            Markup.button.callback(`${UI.ICONS.SUCCESS} Finish Quiz`, `finish_quiz`)
          ]
        ])
      );
      
      // Reset current question state for potential next question
      ctx.wizard.state.currentQuestion = {
        index: ctx.wizard.state.quizData.questions.length,
        text: "",
        options: ["", "", "", ""],
        stage: "pending", // pending -> text -> options -> correct
        currentOption: 0
      };
    } catch (error) {
      logger.error("Error in correct answer selection handler:", error);
      await ctx.answerCbQuery("An error occurred. Please try again.");
    }
  });
}

// Cancel action
quizCreationScene.command("cancel", async (ctx) => {
  await ctx.reply(`${UI.ICONS.INFO} Quiz creation cancelled.`);
  return ctx.scene.leave();
});

// Add help command
quizCreationScene.command("help", async (ctx) => {
  await ctx.replyWithHTML(
    formatHTML(
      `Quiz Creation Help`,
      `You're currently creating a quiz. Follow these steps:\n\n` +
        `1. Provide a quiz title\n` +
        `2. Select a category\n` +
        `3. Set the timer for questions\n` +
        `4. Add questions with answer options\n` +
        `5. Type "done" or click "Finish Quiz" when finished\n\n` +
        `To cancel quiz creation, use /cancel`,
      UI.ICONS.INFO
    )
  );
});

module.exports = {
  quizCreationScene,
};