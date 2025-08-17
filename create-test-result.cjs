// Create a test result with high score for eligibility testing
const mongoose = require('mongoose');
const Result = require('./models/Result');
const Question = require('./models/Question');
require('dotenv').config();

async function createTestResult() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');

    // Get some MCA questions
    const questions = await Question.find({ topic: 'MCA' }).limit(30);
    
    // Create answers with high score (25 correct out of 30)
    const answers = questions.map((question, index) => ({
      question_id: question._id,
      selected_option: question.correct_option_index, // Use correct answer for first 25
      is_correct: index < 25 // First 25 are correct
    }));

    // Create a high-scoring result
    const highScoreResult = new Result({
      student_name: 'Test Student Eligible',
      roll_number: 'TESTELIG001',
      email: 'testelig@example.com',
      topic: 'MCA',
      answers: answers,
      score: 25,
      total_questions: 30,
      time_taken: 1200
    });

    await highScoreResult.save();
    console.log('✅ Created high-scoring test result');
    console.log(`Score: ${highScoreResult.score}/30 (${highScoreResult.percentage}%)`);
    console.log(`Eligible: ${highScoreResult.score > 20}`);

    // Create a low-scoring result
    const lowScoreAnswers = questions.map((question, index) => ({
      question_id: question._id,
      selected_option: (question.correct_option_index + 1) % 4, // Wrong answer
      is_correct: index < 10 // Only first 10 are correct
    }));

    const lowScoreResult = new Result({
      student_name: 'Test Student Not Eligible',
      roll_number: 'TESTNOTELIG001',
      email: 'testnotelig@example.com',
      topic: 'MCA',
      answers: lowScoreAnswers,
      score: 10,
      total_questions: 30,
      time_taken: 1200
    });

    await lowScoreResult.save();
    console.log('✅ Created low-scoring test result');
    console.log(`Score: ${lowScoreResult.score}/30 (${lowScoreResult.percentage}%)`);
    console.log(`Eligible: ${lowScoreResult.score > 20}`);

    console.log('\n🎯 Test data created successfully!');
    console.log('You can now test:');
    console.log('1. Roll number TESTELIG001 should be eligible for MBA');
    console.log('2. Roll number TESTNOTELIG001 should NOT be eligible for MBA');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

createTestResult();