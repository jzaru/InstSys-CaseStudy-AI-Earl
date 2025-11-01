// check_grades_database.js
// Check if grades are actually in the database

const { StudentDatabase, StudentGradesManager } = require('./main');

async function checkGrades() {
  console.log('='.repeat(70));
  console.log('🔍 CHECKING GRADES IN DATABASE');
  console.log('='.repeat(70));

  const db = new StudentDatabase();
  
  try {
    await db.connect();
    console.log('✅ Connected to MongoDB\n');

    // Get all collections
    const allCollections = await db.db.listCollections().toArray();
    const collectionNames = allCollections.map(c => c.name);

    console.log('📦 All collections in database:');
    collectionNames.forEach(name => console.log(`   - ${name}`));

    // Find grades collections (grades_* pattern)
    const gradesCollections = collectionNames.filter(name => 
      name.startsWith('grades_')
    );

    console.log(`\n📊 Grades collections found: ${gradesCollections.length}`);
    
    if (gradesCollections.length === 0) {
      console.log('❌ No grades collections found!');
      console.log('\n💡 This means grades were never stored.');
      console.log('   Possible reasons:');
      console.log('   1. No grades Excel files processed yet');
      console.log('   2. Students not found when trying to store grades');
      console.log('   3. Error during grades processing');
      await db.close();
      return;
    }

    // Count grades in each collection
    let totalGrades = 0;
    const departmentCounts = {};

    console.log('\n📊 Grades by collection:');
    for (const collectionName of gradesCollections) {
      const collection = db.db.collection(collectionName);
      const count = await collection.countDocuments();
      totalGrades += count;
      
      // Extract department from collection name
      const dept = collectionName.replace('grades_', '').toUpperCase();
      departmentCounts[dept] = count;
      
      console.log(`   ${collectionName}: ${count} grade record(s)`);
      
      // Show sample grades
      if (count > 0) {
        const samples = await collection.find({}).limit(3).toArray();
        samples.forEach((g, i) => {
          console.log(`      ${i + 1}. ${g.student_name || g.full_name || 'N/A'} (${g.student_id || 'No ID'})`);
          console.log(`         Course: ${g.course || 'N/A'}, GWA: ${g.gwa || 'N/A'}`);
          console.log(`         Total Subjects: ${g.total_subjects || 0}`);
        });
      }
    }

    // Summary
    console.log('\n' + '='.repeat(70));
    console.log('📊 SUMMARY');
    console.log('='.repeat(70));
    console.log(`Total Grade Records: ${totalGrades}`);
    
    if (Object.keys(departmentCounts).length > 0) {
      console.log('\nBy Department:');
      Object.entries(departmentCounts).sort().forEach(([dept, count]) => {
        console.log(`   ${dept}: ${count} grade record(s)`);
      });
    }

    // Check for students without grades
    console.log('\n' + '='.repeat(70));
    console.log('🔍 CHECKING STUDENTS VS GRADES');
    console.log('='.repeat(70));
    
    const studentCollections = collectionNames.filter(name => 
      name.startsWith('students_')
    );
    
    let totalStudents = 0;
    for (const studentCol of studentCollections) {
      const collection = db.db.collection(studentCol);
      const count = await collection.countDocuments();
      totalStudents += count;
    }
    
    console.log(`Total Students: ${totalStudents}`);
    console.log(`Total Grade Records: ${totalGrades}`);
    console.log(`Students without grades: ${totalStudents - totalGrades}`);
    
    if (totalGrades === 0 && totalStudents > 0) {
      console.log('\n⚠️  WARNING: You have students but NO grades!');
      console.log('   To add grades:');
      console.log('   1. Put grades Excel files in: uploaded_files/student_grades_excel/');
      console.log('   2. Run: node run_system.js');
      console.log('   3. Select Option 1 (will process all files)');
    }

    await db.close();

  } catch (error) {
    console.error(`\n❌ Error: ${error.message}`);
    console.error(error.stack);
  }

  console.log('\n' + '='.repeat(70));
}

// Run
checkGrades()
  .then(() => {
    console.log('\n✅ Check complete!');
    process.exit(0);
  })
  .catch(error => {
    console.error(`Fatal error: ${error.message}`);
    process.exit(1);
  });