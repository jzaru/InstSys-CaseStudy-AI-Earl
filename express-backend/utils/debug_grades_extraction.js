// debug_grades_extraction.js
// Detailed diagnostic for grades extraction

const { StudentDatabase, StudentGradesManager } = require('./main');
const StudentGradesExtractor = require('./student_grades_extractor');
const path = require('path');
const fs = require('fs').promises;

async function debugGradesExtraction() {
  console.log('\n' + '='.repeat(70));
  console.log('🔍 DEBUGGING GRADES EXTRACTION');
  console.log('='.repeat(70));

  const db = new StudentDatabase();
  await db.connect();

  const gradesManager = new StudentGradesManager(db);
  const gradesExtractor = new StudentGradesExtractor();

  // STEP 1: Check if grades folder exists
  console.log('\n📁 STEP 1: Checking grades folder...');
  const gradesFolder = path.join(__dirname, 'uploaded_files', 'student_grades_excel');
  
  try {
    await fs.access(gradesFolder);
    console.log(`✅ Grades folder exists: ${gradesFolder}`);
  } catch {
    console.log(`❌ Grades folder NOT FOUND: ${gradesFolder}`);
    console.log('\n💡 Create folder and add grades Excel files:');
    console.log(`   mkdir -p "${gradesFolder}"`);
    await db.close();
    return;
  }

  // STEP 2: List files in grades folder
  console.log('\n📂 STEP 2: Listing files in grades folder...');
  const files = await fs.readdir(gradesFolder);
  const excelFiles = files.filter(f => f.endsWith('.xlsx') || f.endsWith('.xls'));
  
  console.log(`   Total files: ${files.length}`);
  console.log(`   Excel files: ${excelFiles.length}`);
  
  if (excelFiles.length === 0) {
    console.log('\n❌ NO EXCEL FILES FOUND!');
    console.log('   Add .xlsx files to this folder:');
    console.log(`   ${gradesFolder}`);
    await db.close();
    return;
  }

  console.log('\n   Excel files found:');
  excelFiles.forEach(f => console.log(`   - ${f}`));

  // STEP 3: Check if students exist in database
  console.log('\n👥 STEP 3: Checking students in database...');
  const depts = ['ccs', 'cba', 'chtm', 'cte', 'unknown'];
  let totalStudents = 0;
  const studentsByDept = {};

  for (const dept of depts) {
    try {
      const collection = db.db.collection(`students_${dept}`);
      const count = await collection.countDocuments();
      if (count > 0) {
        totalStudents += count;
        studentsByDept[dept] = count;
        console.log(`   students_${dept}: ${count} student(s)`);
      }
    } catch (e) {
      // Collection doesn't exist, skip
    }
  }

  console.log(`\n   TOTAL STUDENTS: ${totalStudents}`);

  if (totalStudents === 0) {
    console.log('\n❌ NO STUDENTS IN DATABASE!');
    console.log('   You must load students BEFORE grades.');
    console.log('   Students are required because grades are linked to student IDs.');
    await db.close();
    return;
  }

  // Get sample student IDs
  console.log('\n   Sample student IDs (first 5):');
  for (const dept of Object.keys(studentsByDept)) {
    const collection = db.db.collection(`students_${dept}`);
    const samples = await collection.find({}).limit(5).toArray();
    samples.forEach(s => {
      console.log(`   - ${s.student_id || s.student_number || 'NO ID'} (${s.full_name || 'No name'})`);
    });
    break; // Just show from first department
  }

  // STEP 4: Try extracting from first grades file
  console.log('\n📋 STEP 4: Testing extraction from first file...');
  const testFile = excelFiles[0];
  const testFilePath = path.join(gradesFolder, testFile);
  
  console.log(`   Testing: ${testFile}`);
  console.log(`   Full path: ${testFilePath}`);

  try {
    console.log('\n   Calling extractStudentGradesExcelInfo()...');
    const gradesData = await gradesExtractor.extractStudentGradesExcelInfo(testFilePath);
    
    if (!gradesData) {
      console.log('   ❌ Extractor returned NULL');
      console.log('   This means the Excel file could not be read or parsed.');
      await db.close();
      return;
    }

    console.log('   ✅ Data extracted successfully!');
    console.log('\n   Extracted data structure:');
    console.log(`   - Has student_info: ${!!gradesData.student_info}`);
    console.log(`   - Has grades: ${!!gradesData.grades}`);
    
    if (gradesData.student_info) {
      console.log('\n   Student Info:');
      console.log(`   - Student Number: ${gradesData.student_info.student_number || gradesData.metadata?.student_number || 'NOT FOUND'}`);
      console.log(`   - Student Name: ${gradesData.student_info.student_name || gradesData.metadata?.student_name || 'NOT FOUND'}`);
      console.log(`   - Course: ${gradesData.student_info.course || gradesData.metadata?.course || 'NOT FOUND'}`);
    }

    if (gradesData.metadata) {
      console.log('\n   Metadata:');
      console.log(`   - Student Number: ${gradesData.metadata.student_number || 'NOT FOUND'}`);
      console.log(`   - Student Name: ${gradesData.metadata.student_name || 'NOT FOUND'}`);
      console.log(`   - GWA: ${gradesData.metadata.gwa || 'NOT FOUND'}`);
      console.log(`   - Total Subjects: ${gradesData.metadata.total_subjects || 0}`);
    }

    if (gradesData.grades_info?.grades) {
      console.log(`\n   Grades: ${gradesData.grades_info.grades.length} records`);
      if (gradesData.grades_info.grades.length > 0) {
        console.log('   Sample grades (first 3):');
        gradesData.grades_info.grades.slice(0, 3).forEach((g, i) => {
          console.log(`   ${i + 1}. ${g.subject_code || 'N/A'} - ${g.subject_name || 'N/A'}: ${g.grade || 'N/A'}`);
        });
      }
    }

    // STEP 5: Try storing the grades
    console.log('\n💾 STEP 5: Testing storage...');
    
    const studentNumber = gradesData.metadata?.student_number || gradesData.student_info?.student_number;
    console.log(`   Looking for student: ${studentNumber}`);

    // Check if student exists
    const existingStudent = await db.getStudentById(studentNumber);
    
    if (!existingStudent) {
      console.log(`   ❌ Student ${studentNumber} NOT FOUND in database`);
      console.log('\n   This is the problem! The student ID in the grades Excel does not match');
      console.log('   any student ID in the database.');
      console.log('\n   Student IDs in database look like:');
      for (const dept of Object.keys(studentsByDept)) {
        const collection = db.db.collection(`students_${dept}`);
        const sample = await collection.findOne({});
        console.log(`   Example: ${sample.student_id || sample.student_number}`);
        break;
      }
      console.log(`\n   Student ID in grades file: ${studentNumber}`);
      console.log('\n   💡 Make sure student IDs match exactly!');
    } else {
      console.log(`   ✅ Student found: ${existingStudent.full_name}`);
      console.log(`   Department: ${existingStudent.department}`);
      console.log(`   Course: ${existingStudent.course}`);
      
      // Try to store
      console.log('\n   Attempting to store grades...');
      const result = await gradesManager.storeStudentGrades(gradesData);
      
      if (result && result.success) {
        console.log('   ✅ GRADES STORED SUCCESSFULLY!');
        console.log(`   Stored in collection: grades_${existingStudent.department.toLowerCase()}`);
      } else {
        console.log(`   ❌ Storage failed: ${result?.reason || 'Unknown error'}`);
      }
    }

  } catch (error) {
    console.log(`   ❌ Error during extraction/storage:`);
    console.log(`   ${error.message}`);
    console.log('\n   Stack trace:');
    console.log(error.stack);
  }

  await db.close();
  
  console.log('\n' + '='.repeat(70));
  console.log('🎯 DIAGNOSIS COMPLETE');
  console.log('='.repeat(70));
}

// Run
debugGradesExtraction()
  .then(() => {
    console.log('\n✅ Debug complete!');
    process.exit(0);
  })
  .catch(error => {
    console.error(`\n❌ Fatal error: ${error.message}`);
    console.error(error.stack);
    process.exit(1);
  });