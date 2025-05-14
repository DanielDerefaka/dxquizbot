/**
 * Zano Quiz - Quiz Storage and Management Module
 * Handles the persistence of quizzes to the filesystem with enhanced privacy
 */
const fs = require("fs").promises;
const path = require("path");
const { v4: uuidv4 } = require("uuid");
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
    
    // Ensure shared status is defined
    if (quizData.shared === undefined) {
      quizData.shared = false;
    }
    
    // Ensure sharedWith array exists
    if (!Array.isArray(quizData.sharedWith)) {
      quizData.sharedWith = [];
    }
    
    // Ensure category exists
    if (!quizData.category) {
      quizData.category = "Uncategorized";
    }

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
 * Get a quiz by ID with privacy check
 * @param {string} quizId - ID of the quiz to retrieve
 * @param {number} requestingUserId - ID of user requesting the quiz (for access control)
 * @returns {Promise<Object|null>} - Quiz data or null if not found or not authorized
 */
async function getQuiz(quizId, requestingUserId = null) {
  try {
    const quizPath = path.join(QUIZ_DIR, `${quizId}.json`);
    const quizData = await fs.readFile(quizPath, "utf8");
    const quiz = JSON.parse(quizData);
    
    // If requesting user ID is provided, verify access
    if (requestingUserId !== null) {
      const hasAccess = 
        quiz.creator === requestingUserId || 
        quiz.shared === true || 
        (Array.isArray(quiz.sharedWith) && quiz.sharedWith.includes(requestingUserId));
      
      if (!hasAccess) {
        logger.warn(`Unauthorized quiz access attempt: User ${requestingUserId} tried to access quiz ${quizId}`);
        return null;
      }
    }
    
    return quiz;
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
 * Get all quizzes shared with a specific user
 * @param {number} userId - ID of the user
 * @returns {Promise<Array>} - Array of quiz data objects shared with the user
 */
async function getQuizzesSharedWithUser(userId) {
  try {
    // Ensure directory exists
    await ensureQuizDir();

    // Get all quiz files
    const files = await fs.readdir(QUIZ_DIR);
    const quizzes = [];

    // Read and filter quizzes that are shared with the user
    for (const file of files) {
      if (file.endsWith(".json")) {
        try {
          const quizPath = path.join(QUIZ_DIR, file);
          const quizData = await fs.readFile(quizPath, "utf8");
          const quiz = JSON.parse(quizData);

          // Check if quiz is publicly shared or specifically shared with this user
          if (
            quiz.creator !== userId && // Not created by this user
            (quiz.shared === true || // Publicly shared
             (Array.isArray(quiz.sharedWith) && quiz.sharedWith.includes(userId))) // Shared with this user
          ) {
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
      const dateA = b.updatedAt || b.createdAt;
      const dateB = a.updatedAt || a.createdAt;
      return dateA - dateB;
    });

    logger.info(`Found ${quizzes.length} quizzes shared with user ${userId}`);
    return quizzes;
  } catch (error) {
    logger.error("Error reading quizzes directory:", error);
    return [];
  }
}

/**
 * Share a quiz with specific users or publicly
 * @param {string} quizId - ID of the quiz to share
 * @param {number} creatorId - ID of the quiz creator (for verification)
 * @param {boolean} isPublic - Whether to share publicly
 * @param {Array<number>} userIds - IDs of users to share with (if not public)
 * @returns {Promise<Object>} - Result object with success flag and message
 */
async function shareQuiz(quizId, creatorId, isPublic = false, userIds = []) {
  try {
    // Get quiz data first
    const quiz = await getQuiz(quizId);

    // Check if quiz exists and belongs to the creator
    if (!quiz) {
      return { success: false, message: "Quiz not found." };
    }

    if (quiz.creator !== creatorId) {
      logger.warn(
        `Unauthorized share attempt for quiz ${quizId} by user ${creatorId}`
      );
      return {
        success: false,
        message: "You don't have permission to share this quiz.",
      };
    }

    // Update sharing settings
    quiz.shared = isPublic;
    
    if (!isPublic && Array.isArray(userIds) && userIds.length > 0) {
      // Ensure shared with array exists
      if (!Array.isArray(quiz.sharedWith)) {
        quiz.sharedWith = [];
      }
      
      // Add new users while preventing duplicates
      userIds.forEach(userId => {
        if (!quiz.sharedWith.includes(userId)) {
          quiz.sharedWith.push(userId);
        }
      });
    }

    // Save the updated quiz
    await saveQuiz(quiz);

    logger.info(`Quiz ${quizId} sharing updated by creator ${creatorId}`);
    return { 
      success: true, 
      message: isPublic 
        ? "Quiz is now publicly shared." 
        : `Quiz shared with ${userIds.length} users.` 
    };
  } catch (error) {
    logger.error(`Error sharing quiz ${quizId}:`, error);
    return {
      success: false,
      message: "Error sharing quiz. Please try again later.",
    };
  }
}

/**
 * Stop sharing a quiz with specific users
 * @param {string} quizId - ID of the quiz
 * @param {number} creatorId - ID of the quiz creator (for verification)
 * @param {Array<number>} userIds - IDs of users to remove sharing with
 * @returns {Promise<Object>} - Result object with success flag and message
 */
async function unshareQuiz(quizId, creatorId, userIds = []) {
  try {
    // Get quiz data first
    const quiz = await getQuiz(quizId);

    // Check if quiz exists and belongs to the creator
    if (!quiz) {
      return { success: false, message: "Quiz not found." };
    }

    if (quiz.creator !== creatorId) {
      logger.warn(
        `Unauthorized unshare attempt for quiz ${quizId} by user ${creatorId}`
      );
      return {
        success: false,
        message: "You don't have permission to modify this quiz's sharing.",
      };
    }

    // If no specific users provided, make quiz completely private
    if (!Array.isArray(userIds) || userIds.length === 0) {
      quiz.shared = false;
      quiz.sharedWith = [];
    } else {
      // Remove specific users from sharedWith array
      if (Array.isArray(quiz.sharedWith)) {
        quiz.sharedWith = quiz.sharedWith.filter(
          userId => !userIds.includes(userId)
        );
      }
    }

    // Save the updated quiz
    await saveQuiz(quiz);

    logger.info(`Quiz ${quizId} sharing updated by creator ${creatorId}`);
    return { 
      success: true, 
      message: "Quiz sharing updated successfully." 
    };
  } catch (error) {
    logger.error(`Error updating quiz sharing ${quizId}:`, error);
    return {
      success: false,
      message: "Error updating quiz sharing. Please try again later.",
    };
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
 * Create a copy of a quiz for a user
 * @param {string} quizId - ID of the quiz to copy
 * @param {number} userId - ID of the user making the copy
 * @param {string} newTitle - Optional new title for the copied quiz
 * @returns {Promise<Object>} - Result object with success flag, message, and new quiz ID
 */
async function copyQuiz(quizId, userId, newTitle = null) {
  try {
    // Get the original quiz with privacy check
    const originalQuiz = await getQuiz(quizId, userId);
    
    if (!originalQuiz) {
      return { 
        success: false, 
        message: "Quiz not found or you don't have permission to copy it." 
      };
    }
    
    // Create a new quiz object
    const newQuiz = {
      id: uuidv4(),
      creator: userId,
      title: newTitle || `Copy of ${originalQuiz.title}`,
      questions: [...originalQuiz.questions], // Copy all questions
      settings: { ...originalQuiz.settings }, // Copy settings
      category: originalQuiz.category,
      createdAt: Date.now(),
      shared: false,
      sharedWith: [],
      originalQuizId: quizId, // Reference to source quiz
    };
    
    // Save the new quiz
    await saveQuiz(newQuiz);
    
    logger.info(`Quiz ${quizId} copied to ${newQuiz.id} by user ${userId}`);
    return { 
      success: true, 
      message: "Quiz copied successfully.", 
      newQuizId: newQuiz.id 
    };
  } catch (error) {
    logger.error(`Error copying quiz ${quizId}:`, error);
    return {
      success: false,
      message: "Error copying quiz. Please try again later."
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

/**
 * Get quizzes by category
 * @param {string} category - Category to filter by
 * @param {number} userId - User ID for privacy check
 * @returns {Promise<Array>} - Array of quizzes in that category
 */
async function getQuizzesByCategory(category, userId) {
  try {
    // Get all quizzes for this user
    const userQuizzes = await getQuizzesByCreator(userId);
    
    // Filter by category
    return userQuizzes.filter(quiz => quiz.category === category);
  } catch (error) {
    logger.error(`Error getting quizzes by category ${category}:`, error);
    return [];
  }
}

/**
 * Get all categories with quiz counts for a user
 * @param {number} userId - User ID
 * @returns {Promise<Array>} - Array of {category, count} objects
 */
async function getUserCategories(userId) {
  try {
    // Get all quizzes for this user
    const userQuizzes = await getQuizzesByCreator(userId);
    
    // Group by category
    const categories = {};
    userQuizzes.forEach(quiz => {
      const category = quiz.category || "Uncategorized";
      if (!categories[category]) {
        categories[category] = 0;
      }
      categories[category]++;
    });
    
    // Convert to array format
    return Object.keys(categories).map(category => ({
      category,
      count: categories[category]
    }));
  } catch (error) {
    logger.error(`Error getting categories for user ${userId}:`, error);
    return [];
  }
}

/**
 * Search quizzes by title or content
 * @param {string} query - Search query
 * @param {number} userId - User ID for privacy check
 * @returns {Promise<Array>} - Array of matching quizzes
 */
async function searchQuizzes(query, userId) {
  try {
    // Get all quizzes for this user
    const userQuizzes = await getQuizzesByCreator(userId);
    
    // If query is empty, return all quizzes
    if (!query || query.trim() === '') {
      return userQuizzes;
    }
    
    // Normalize query for case-insensitive search
    const normalizedQuery = query.toLowerCase().trim();
    
    // Search in titles and questions
    return userQuizzes.filter(quiz => {
      // Check title
      if (quiz.title.toLowerCase().includes(normalizedQuery)) {
        return true;
      }
      
      // Check questions
      if (Array.isArray(quiz.questions)) {
        for (const question of quiz.questions) {
          if (question.text.toLowerCase().includes(normalizedQuery)) {
            return true;
          }
          
          // Check options
          if (Array.isArray(question.options)) {
            for (const option of question.options) {
              if (option.toLowerCase().includes(normalizedQuery)) {
                return true;
              }
            }
          }
        }
      }
      
      return false;
    });
  } catch (error) {
    logger.error(`Error searching quizzes for user ${userId}:`, error);
    return [];
  }
}

module.exports = {
  saveQuiz,
  getQuiz,
  getQuizzesByCreator,
  getQuizzesSharedWithUser,
  shareQuiz,
  unshareQuiz,
  deleteQuiz,
  copyQuiz,
  updateQuiz,
  getQuizCountByCreator,
  hasReachedQuizLimit,
  getQuizzesByCategory,
  getUserCategories,
  searchQuizzes
};