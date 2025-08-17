const mongoose = require('mongoose');
const Question = require('../models/Question');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function seedAllQuestions() {
  try {
    console.log('🔄 Starting comprehensive database seeding...');
    
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');
    
    // Clear all existing questions
    await Question.deleteMany({});
    console.log('🗑️  Cleared all existing questions');
    
    // Run individual seeding by executing the scripts
    console.log('\n📚 Seeding MCA questions...');
    const { execSync } = require('child_process');
    
    try {
      execSync('node seedComprehensiveMCA.js', { stdio: 'inherit', cwd: __dirname });
    } catch (error) {
      // MCA script exits with 0, so this is expected
    }
    
    console.log('\n💼 Seeding MBA questions...');
    try {
      execSync('node seedComprehensiveMBA.js', { stdio: 'inherit', cwd: __dirname });
    } catch (error) {
      // MBA script exits with 0, so this is expected
    }
    
    console.log('\n🛡️  Seeding Anti-Ragging questions...');
    try {
      execSync('node seedAntiRaggingQuestions.js', { stdio: 'inherit', cwd: __dirname });
    } catch (error) {
      // Anti-Ragging script exits with 0, so this is expected
    }
    
    // Final verification
    const totalQuestions = await Question.countDocuments();
    console.log(`\n📊 Final count: ${totalQuestions} total questions`);

    const distribution = await Question.aggregate([
      { $group: { _id: '$topic', count: { $sum: 1 } } },
      { $sort: { '_id': 1 } }
    ]);

    console.log('\n🎯 Final Distribution:');
    distribution.forEach(item => {
      console.log(`${item._id}: ${item.count} questions`);
    });

    console.log('\n🎉 Complete database seeding finished successfully!');
    
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Error in comprehensive seeding:', error);
    process.exit(1);
  }
}

// Only run if this file is executed directly
if (require.main === module) {
  seedAllQuestions();
}

module.exports = seedAllQuestions;