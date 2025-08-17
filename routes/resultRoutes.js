const express = require('express');
const { body, validationResult } = require('express-validator');
const Question = require('../models/Question');
const Result = require('../models/Result');

const router = express.Router();

// Validation middleware for quiz submission
const validateSubmission = [
  body('student_name')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Student name must be between 2 and 100 characters'),
  
  body('roll_number')
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Roll number must be between 1 and 50 characters'),
  
  body('email')
    .trim()
    .isEmail()
    .withMessage('Please enter a valid email address')
    .normalizeEmail(),
  
  body('topic')
    .isIn(['MBA', 'MCA', 'ANTI_RAGGING'])
    .withMessage('Topic must be MBA, MCA, or ANTI_RAGGING'),
  
  body('answers')
    .isArray({ min: 1, max: 30 })
    .withMessage('Answers must be an array with 1-30 items'),
  
  body('answers.*.question_id')
    .isMongoId()
    .withMessage('Invalid question ID format'),
  
  body('answers.*.selected_option')
    .isInt({ min: 0, max: 3 })
    .withMessage('Selected option must be between 0 and 3'),
  
  body('time_taken')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Time taken must be a positive number')
];

// POST /submit - Submit quiz answers
router.post('/submit', validateSubmission, async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { student_name, roll_number, email, topic, answers, time_taken } = req.body;

    // Get question IDs from answers
    const questionIds = answers.map(answer => answer.question_id);

    // Fetch all questions to verify answers
    const questions = await Question.find({
      _id: { $in: questionIds },
      topic: topic
    });

    if (questions.length !== answers.length) {
      return res.status(400).json({
        error: 'Question mismatch',
        message: 'Some questions not found or topic mismatch'
      });
    }

    // Create a map for quick question lookup
    const questionMap = {};
    questions.forEach(q => {
      questionMap[q._id.toString()] = q;
    });

    // Calculate score and prepare answers with correctness
    let correctAnswers = 0;
    const processedAnswers = answers.map(answer => {
      const question = questionMap[answer.question_id];
      const isCorrect = question.correct_option_index === answer.selected_option;
      
      if (isCorrect) {
        correctAnswers++;
      }

      return {
        question_id: answer.question_id,
        selected_option: answer.selected_option,
        is_correct: isCorrect
      };
    });

    // Create result document
    const result = new Result({
      student_name,
      roll_number,
      email,
      topic,
      answers: processedAnswers,
      score: correctAnswers,
      total_questions: answers.length,
      time_taken: time_taken || null
    });

    // Save to database
    await result.save();

    // Return response without revealing correct answers
    res.status(201).json({
      success: true,
      message: 'Quiz submitted successfully',
      result: {
        id: result._id,
        student_name: result.student_name,
        roll_number: result.roll_number,
        topic: result.topic,
        score: result.score,
        total_questions: result.total_questions,
        percentage: result.percentage,
        grade: result.grade,
        date: result.date
      }
    });

  } catch (error) {
    console.error('Error submitting quiz:', error);
    
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        error: 'Validation failed',
        details: Object.values(error.errors).map(e => e.message)
      });
    }

    res.status(500).json({
      error: 'Failed to submit quiz',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// GET /results/student/:rollNumber - Get results for a specific student
router.get('/results/student/:rollNumber', async (req, res) => {
  try {
    const { rollNumber } = req.params;
    const { topic } = req.query;

    const query = { roll_number: rollNumber };
    if (topic) {
      query.topic = topic;
    }

    const results = await Result.find(query)
      .select('-answers') // Don't include detailed answers
      .sort({ date: -1 })
      .limit(10);

    res.json({
      success: true,
      roll_number: rollNumber,
      results
    });

  } catch (error) {
    console.error('Error fetching student results:', error);
    res.status(500).json({
      error: 'Failed to fetch student results'
    });
  }
});

// GET /results/student/:rollNumber/eligibility - Check if student is eligible for second round
router.get('/results/student/:rollNumber/eligibility', async (req, res) => {
  try {
    const { rollNumber } = req.params;

    // Find the highest score across all topics for this student
    const bestResult = await Result.findOne({ roll_number: rollNumber })
      .sort({ score: -1, date: -1 })
      .select('score total_questions percentage topic date');

    if (!bestResult) {
      return res.json({
        success: true,
        eligible: false,
        message: 'No quiz attempts found'
      });
    }

    const isEligible = bestResult.score > 20;

    res.json({
      success: true,
      eligible: isEligible,
      bestScore: bestResult.score,
      totalQuestions: bestResult.total_questions,
      percentage: bestResult.percentage,
      topic: bestResult.topic,
      date: bestResult.date,
      message: isEligible 
        ? 'Congratulations! You are eligible for the second round.' 
        : 'Keep practicing! You need more than 20 correct answers to be eligible for the second round.'
    });

  } catch (error) {
    console.error('Error checking student eligibility:', error);
    res.status(500).json({
      error: 'Failed to check eligibility'
    });
  }
});

// GET /results/student/:rollNumber/latest - Get latest result with answer correctness (no correct answers revealed)
router.get('/results/student/:rollNumber/latest', async (req, res) => {
  try {
    const { rollNumber } = req.params;
    const { topic } = req.query;

    const query = { roll_number: rollNumber };
    if (topic) {
      query.topic = topic;
    }

    const result = await Result.findOne(query)
      .populate('answers.question_id', 'question_text options difficulty sub_category') // Populate question details but not correct answers
      .sort({ date: -1 });

    if (!result) {
      return res.status(404).json({
        error: 'No results found for this student'
      });
    }

    // Return result with answer correctness but without revealing correct answers
    const responseData = {
      _id: result._id,
      student_name: result.student_name,
      roll_number: result.roll_number,
      email: result.email,
      topic: result.topic,
      score: result.score,
      total_questions: result.total_questions,
      percentage: result.percentage,
      time_taken: result.time_taken,
      date: result.date,
      answers: result.answers.map(answer => ({
        question: {
          id: answer.question_id._id,
          question_text: answer.question_id.question_text,
          options: answer.question_id.options,
          difficulty: answer.question_id.difficulty,
          sub_category: answer.question_id.sub_category
        },
        selected_option: answer.selected_option,
        is_correct: answer.is_correct
        // Note: We don't include the correct_option_index for security
      }))
    };

    res.json({
      success: true,
      result: responseData
    });

  } catch (error) {
    console.error('Error fetching latest student result:', error);
    res.status(500).json({
      error: 'Failed to fetch latest student result'
    });
  }
});

module.exports = router;