// process_students_improved.js
// Improved student Excel processor with detailed debugging

const path = require('path');
const fs = require('fs').promises;
const { StudentDatabase, StudentDataExtractor } = require('./main');

async function processStudents() {
  console.log('='.repeat(70));
  console.log('🎓 IMPROVED STUDENT EXCEL PROCESSOR');
  console.log('='.repeat(70));

  // Setup paths
  const excelFolder = path.join(__dirname, 'uploaded_files', 'student_list_excel');
  console.log(`\n📁 Excel folder: ${excelFolder}`);

  // Check folder exists
  try {
    await fs.access(excelFolder);
    console.log('✅ Folder exists');
  } catch {
    console.log('❌ Folder not found, creating...');
    await fs.mkdir(excelFolder, { recursive: true });
    console.log('✅ Folder created');
    console.log('💡 Add your Excel files to this folder and run again');
    return;
  }

  // Find Excel files
  const files = await fs.readdir(excelFolder);
  const excelFiles = files.filter(file => 
    file.toLowerCase().endsWith('.xlsx') || 
    file.toLowerCase().endsWith('.xls')
  );

  console.log(`\n📊 Found ${excelFiles.length} Excel file(s):`);
  
  if (excelFiles.length === 0) {
    console.log('❌ No Excel files found');
    console.log('\n📋 Files in folder:');
    files.forEach(file => console.log(`   - ${file}`));
    return;
  }

  excelFiles.forEach((file, i) => {
    console.log(`   ${i + 1}. ${file}`);
  });

  // Connect to MongoDB
  console.log('\n🔌 Connecting to MongoDB...');
  const db = new StudentDatabase();
  
  try {
    await db.connect();
    console.log('✅ Connected successfully');
  } catch (error) {
    console.log(`❌ Connection failed: ${error.message}`);
    console.log('💡 Make sure MongoDB is running: net start MongoDB');
    return;
  }

  // Show current stats
  let stats = await db.getStatistics();
  console.log('\n📊 Current Database:');
  console.log(`   Students: ${stats.total_students}`);
  console.log(`   Pending Media: ${stats.pending_media}`);

  // Process each file
  console.log('\n' + '='.repeat(70));
  console.log('🔄 PROCESSING FILES...');
  console.log('='.repeat(70));

  let totalStudents = 0;
  let totalProcessed = 0;

  for (let i = 0; i < excelFiles.length; i++) {
    const file = excelFiles[i];
    const filePath = path.join(excelFolder, file);
    
    console.log(`\n[${i + 1}/${excelFiles.length}] 📄 ${file}`);
    console.log('-'.repeat(70));

    try {
      // Get count before
      const beforeStats = await db.getStatistics();
      const beforeCount = beforeStats.total_students;
      console.log(`   Students before: ${beforeCount}`);

      // Process file with detailed logging
      console.log('   ⏳ Processing...');
      
      const result = await StudentDataExtractor.processExcel(filePath, db);
      
      // Get count after
      const afterStats = await db.getStatistics();
      const afterCount = afterStats.total_students;
      const added = afterCount - beforeCount;

      console.log(`   Students after: ${afterCount}`);
      console.log(`   Students added: ${added}`);

      if (result && added > 0) {
        console.log(`   ✅ Success! Added ${added} students`);
        totalStudents += added;
        totalProcessed++;
      } else if (result) {
        console.log('   ⚠️  Processed but no students added');
        console.log('   💡 Check if file format is correct');
      } else {
        console.log('   ❌ Processing failed');
        console.log('   💡 Check file format and data structure');
      }

    } catch (error) {
      console.log(`   ❌ Error: ${error.message}`);
      console.log('\n   📋 Error details:');
      console.error('   ' + error.stack.split('\n').join('\n   '));
    }
  }

  // Final summary
  console.log('\n' + '='.repeat(70));
  console.log('✅ PROCESSING COMPLETE');
  console.log('='.repeat(70));
  console.log(`Files processed: ${totalProcessed}/${excelFiles.length}`);
  console.log(`Total students added: ${totalStudents}`);

  // Final stats
  const finalStats = await db.getStatistics();
  console.log('\n📊 Final Database:');
  console.log(`   Total Students: ${finalStats.total_students}`);
  console.log(`   Pending Media: ${finalStats.pending_media}`);
  console.log(`   Average Completion: ${finalStats.average_completion.toFixed(1)}%`);

  if (Object.keys(finalStats.by_department).length > 0) {
    console.log('\n📚 By Department:');
    Object.entries(finalStats.by_department).forEach(([dept, count]) => {
      console.log(`   • ${dept}: ${count} students`);
    });
  }

  // Show some sample students
  if (finalStats.total_students > 0) {
    console.log('\n📋 Sample Students:');
    const collection = db.db.collection('students');
    const samples = await collection.find({}).limit(5).toArray();
    
    samples.forEach((student, i) => {
      console.log(`   ${i + 1}. ${student.full_name || 'N/A'}`);
      console.log(`      ID: ${student.student_id || 'N/A'}`);
      console.log(`      Course: ${student.course || 'N/A'}`);
      console.log(`      Department: ${student.department || 'N/A'}`);
    });
  }

  await db.close();
  console.log('\n👋 Disconnected from MongoDB');
  console.log('='.repeat(70));
}

// Run
processStudents()
  .then(() => {
    console.log('\n✅ Done!');
    process.exit(0);
  })
  .catch(error => {
    console.error(`\n❌ Fatal error: ${error.message}`);
    console.error(error.stack);
    process.exit(1);
  });