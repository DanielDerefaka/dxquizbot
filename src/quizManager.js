/**
 * Zano Quiz - Quiz Storage and Management Module
 * Handles the persistence of quizzes to the filesystem
 */
const fs = require("fs").promises;
const path = require("path");
const logger = require("./logger");

/**
 * Constants for Quiz Management
 */
const QUIZ_DIR = path.join(__dirname, "../data/quizzes");
const MAX_QUIZZES_PER_USER = 100; // Limit quizzes per user

/**
 * Create necessary directories if they don't exist
 * @returns {Promise<void>}
 */
async function ensureQuizDir() {
  try {
    await fs.mkdir(QUIZ_DIR, { recursive: true });
  } catch (error) {
    logger.error("Error creating quiz directory:", error);
    throw new Error("Failed to create quiz directory. Check file permissions.");
  }
}

/**
 * Save a quiz to the file system
 * @param {Object} quizData - Quiz data to save
 * @returns {Promise<string>} - ID of the saved quiz
 */
async function saveQuiz(quizData) {
  try {
    // Ensure directory exists
    await ensureQuizDir();

    // Validate quiz data
    if (!quizData || !quizData.id || !quizData.creator || !quizData.questions) {
      throw new Error("Invalid quiz data");
    }

    // Validate quiz has questions
    if (!Array.isArray(quizData.questions) || quizData.questions.length === 0) {
      throw new Error("Quiz must have at least one question");
    }

    // Make sure quiz questions have all required fields
    quizData.questions.forEach((question, index) => {
      if (
        !question.text ||
        !Array.isArray(question.options) ||
        question.correctAnswer === undefined
      ) {
        throw new Error(`Invalid question data at index ${index}`);
      }
    });

    // Set updated timestamp
    quizData.updatedAt = Date.now();

    // Write quiz to file
    const quizPath = path.join(QUIZ_DIR, `${quizData.id}.json`);
    await fs.writeFile(quizPath, JSON.stringify(quizData, null, 2));

    logger.info(`Quiz saved with ID: ${quizData.id}`);
    return quizData.id;
  } catch (error) {
    logger.error(`Error saving quiz:`, error);
    throw error;
  }
}

/**
 * Get a quiz by ID
 * @param {string} quizId - ID of the quiz to retrieve
 * @returns {Promise<Object|null>} - Quiz data or null if not found
 */
async function getQuiz(quizId) {
  try {
    const quizPath = path.join(QUIZ_DIR, `${quizId}.json`);
    const quizData = await fs.readFile(quizPath, "utf8");
    return JSON.parse(quizData);
  } catch (error) {
    if (error.code === "ENOENT") {
      logger.warn(`Quiz not found: ${quizId}`);
      return null;
    }

    logger.error(`Error reading quiz ${quizId}:`, error);
    return null;
  }
}

/**
 * Get all quizzes created by a specific user
 * @param {number} creatorId - ID of the quiz creator
 * @returns {Promise<Array>} - Array of quiz data objects
 */
async function getQuizzesByCreator(creatorId) {
  try {
    // Ensure directory exists
    await ensureQuizDir();

    // Get all quiz files
    const files = await fs.readdir(QUIZ_DIR);
    const quizzes = [];

    // Read and filter quizzes by creator
    for (const file of files) {
      if (file.endsWith(".json")) {
        try {
          const quizPath = path.join(QUIZ_DIR, file);
          const quizData = await fs.readFile(quizPath, "utf8");
          const quiz = JSON.parse(quizData);

          if (quiz.creator === creatorId) {
            quizzes.push(quiz);
          }
        } catch (fileErr) {
          logger.error(`Error reading quiz file ${file}:`, fileErr);
          // Continue to next file
        }
      }
    }

    // Sort by creation date (newest first)
    quizzes.sort((a, b) => {
      // Default to createdAt if updatedAt doesn't exist
      const dateA = b.updatedAt || b.createdAt;
      const dateB = a.updatedAt || a.createdAt;
      return dateA - dateB;
    });

    logger.info(`Found ${quizzes.length} quizzes for creator ${creatorId}`);
    return quizzes;
  } catch (error) {
    logger.error("Error reading quizzes directory:", error);
    return [];
  }
}

/**
 * Delete a quiz by ID if it belongs to the specified creator
 * @param {string} quizId - ID of the quiz to delete
 * @param {number} creatorId - ID of the requesting user
 * @returns {Promise<Object>} - Result object with success flag and message
 */
async function deleteQuiz(quizId, creatorId) {
  try {
    // Get quiz data first
    const quiz = await getQuiz(quizId);

    // Check if quiz exists and belongs to the creator
    if (!quiz) {
      return { success: false, message: "Quiz not found." };
    }

    if (quiz.creator !== creatorId) {
      logger.warn(
        `Unauthorized delete attempt for quiz ${quizId} by user ${creatorId}`
      );
      return {
        success: false,
        message: "You don't have permission to delete this quiz.",
      };
    }

    // Delete the quiz file
    const quizPath = path.join(QUIZ_DIR, `${quizId}.json`);
    await fs.unlink(quizPath);

    logger.info(`Quiz ${quizId} deleted by creator ${creatorId}`);
    return { success: true, message: "Quiz deleted successfully." };
  } catch (error) {
    logger.error(`Error deleting quiz ${quizId}:`, error);
    return {
      success: false,
      message: "Error deleting quiz. Please try again later.",
    };
  }
}

/**
 * Update an existing quiz
 * @param {string} quizId - ID of the quiz to update
 * @param {Object} updatedData - New quiz data to apply
 * @param {number} creatorId - ID of the requesting user
 * @returns {Promise<Object>} - Result object with success flag and message
 */
async function updateQuiz(quizId, updatedData, creatorId) {
  try {
    // Get quiz data first
    const quiz = await getQuiz(quizId);

    // Check if quiz exists and belongs to the creator
    if (!quiz) {
      return { success: false, message: "Quiz not found." };
    }

    if (quiz.creator !== creatorId) {
      logger.warn(
        `Unauthorized update attempt for quiz ${quizId} by user ${creatorId}`
      );
      return {
        success: false,
        message: "You don't have permission to update this quiz.",
      };
    }

    // Ensure critical properties can't be changed
    const protectedProps = {
      id: quiz.id,
      creator: quiz.creator,
      createdAt: quiz.createdAt,
    };

    // Merge updated data with existing quiz, keeping protected properties
    const updatedQuiz = {
      ...quiz,
      ...updatedData,
      ...protectedProps,
      updatedAt: Date.now(),
    };

    // Save the updated quiz
    await saveQuiz(updatedQuiz);

    logger.info(`Quiz ${quizId} updated by creator ${creatorId}`);
    return { success: true, message: "Quiz updated successfully." };
  } catch (error) {
    logger.error(`Error updating quiz ${quizId}:`, error);
    return {
      success: false,
      message: "Error updating quiz. Please try again later.",
    };
  }
}

/**
 * Get count of quizzes by creator
 * @param {number} creatorId - ID of the creator
 * @returns {Promise<number>} - Number of quizzes
 */
async function getQuizCountByCreator(creatorId) {
  const quizzes = await getQuizzesByCreator(creatorId);
  return quizzes.length;
}

/**
 * Check if user has reached quiz limit
 * @param {number} creatorId - ID of the creator
 * @returns {Promise<boolean>} - True if user has reached limit
 */
async function hasReachedQuizLimit(creatorId) {
  const count = await getQuizCountByCreator(creatorId);
  return count >= MAX_QUIZZES_PER_USER;
}

module.exports = {
  saveQuiz,
  getQuiz,
  getQuizzesByCreator,
  deleteQuiz,
  updateQuiz,
  getQuizCountByCreator,
  hasReachedQuizLimit,
};
