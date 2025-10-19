// run_system.js
const readline = require('readline');
const path = require('path');
const fs = require('fs').promises;
const QueryAssistant = require('./query_assistant');
const { StudentDatabase, StudentDataExtractor, CORScheduleManager, StudentGradesManager } = require('./main');
const CORExcelExtractor = require('./cor_excel_extractor');

class SchoolInformationSystem {
  constructor(connectionString = null) {
    this.db = new StudentDatabase(connectionString);
    
    // Paths relative to utils folder
    this.basePath = path.join(__dirname, 'uploaded_files');
    this.studentExcelFolder = path.join(this.basePath, 'student_list_excel');
    this.corExcelFolder = path.join(this.basePath, 'cor_excel');
    this.gradesExcelFolder = path.join(this.basePath, 'student_grades_excel');
    this.processedFolder = path.join(this.basePath, 'processed');
    
    // Extractors and managers
    this.corExtractor = new CORExcelExtractor();
    this.corManager = null; // Will be initialized after DB connection
    this.gradesManager = null;
    this.queryAssistant = null;
    
    // Create readline interface for user input
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    console.log(`📁 Student Excel folder: ${this.studentExcelFolder}`);
    console.log(`📁 COR Excel folder: ${this.corExcelFolder}`);
  }

  // Helper function to prompt user for input
  prompt(question) {
    return new Promise((resolve) => {
      this.rl.question(question, (answer) => {
        resolve(answer);
      });
    });
  }

  /**
   * AUTO-SCAN: Scan and process all files in uploaded_files on startup
   */
  async autoScanAndProcessAllFiles() {
  console.log('\n' + '='.repeat(60));
  console.log('🔄 AUTO-SCAN: Processing all uploaded files...');
  console.log('='.repeat(60));

  let totalProcessed = 0;

  // Process Student Excel Files FIRST (must be first!)
  try {
    await fs.access(this.studentExcelFolder);
    const studentFiles = await fs.readdir(this.studentExcelFolder);
    const studentExcelFiles = studentFiles.filter(file => 
      file.endsWith('.xlsx') || file.endsWith('.xls')
    );

    if (studentExcelFiles.length > 0) {
      console.log(`\n📊 Found ${studentExcelFiles.length} student Excel file(s)`);
      
      for (const file of studentExcelFiles) {
        const filePath = path.join(this.studentExcelFolder, file);
        console.log(`   Processing: ${file}`);
        
        try {
          const success = await StudentDataExtractor.processExcel(filePath, this.db);
          if (success) {
            totalProcessed++;
            console.log(`   ✅ ${file}`);
          }
        } catch (error) {
          console.error(`   ❌ Error: ${error.message}`);
        }
      }
    } else {
      console.log('\n📊 No student Excel files found');
    }
  } catch {
    console.log('\n📊 Student Excel folder not found, creating...');
    await fs.mkdir(this.studentExcelFolder, { recursive: true });
  }

  // Process COR Excel Files
  try {
    await fs.access(this.corExcelFolder);
    const corFiles = await fs.readdir(this.corExcelFolder);
    const corExcelFiles = corFiles.filter(file => 
      file.endsWith('.xlsx') || file.endsWith('.xls')
    );

    if (corExcelFiles.length > 0) {
      console.log(`\n📚 Found ${corExcelFiles.length} COR Excel file(s)`);
      
      for (const file of corExcelFiles) {
        const filePath = path.join(this.corExcelFolder, file);
        console.log(`   Processing: ${file}`);
        
        try {
          const corData = await this.corExtractor.processCORExcel(filePath);
          if (corData) {
            await this.corManager.storeCORSchedule(corData);
            totalProcessed++;
            console.log(`   ✅ ${file}`);
          }
        } catch (error) {
          console.error(`   ❌ Error: ${error.message}`);
        }
      }
    } else {
      console.log('\n📚 No COR Excel files found');
    }
  } catch {
    console.log('\n📚 COR Excel folder not found, creating...');
    await fs.mkdir(this.corExcelFolder, { recursive: true });
  }

  // Process Student Grades Excel Files (AFTER students are loaded!)
  try {
    await fs.access(this.gradesExcelFolder);
    const gradesFiles = await fs.readdir(this.gradesExcelFolder);
    const gradesExcelFiles = gradesFiles.filter(file => 
      file.endsWith('.xlsx') || file.endsWith('.xls')
    );

    if (gradesExcelFiles.length > 0) {
      console.log(`\n📊 Found ${gradesExcelFiles.length} Student Grades Excel file(s)`);
      
      const StudentGradesExtractor = require('./student_grades_extractor');
      const gradesExtractor = new StudentGradesExtractor();
      
      let gradesProcessed = 0;
      let gradesSkipped = 0;
      
      for (const file of gradesExcelFiles) {
        const filePath = path.join(this.gradesExcelFolder, file);
        console.log(`   Processing: ${file}`);
        
        try {
          const gradesData = await gradesExtractor.processStudentGradesExcel(filePath);
          
          if (gradesData) {
            const result = await this.gradesManager.storeStudentGrades(gradesData);
            
            if (result.success) {
              totalProcessed++;
              gradesProcessed++;
              console.log(`   ✅ ${file}`);
            } else if (result.reason === 'student_not_found') {
              gradesSkipped++;
              console.log(`   ⚠️  ${file} - Student ${gradesData.metadata.student_number} not in database`);
            } else {
              gradesSkipped++;
              console.log(`   ❌ ${file} - ${result.reason}`);
            }
          } else {
            gradesSkipped++;
            console.log(`   ❌ ${file} - Could not extract data`);
          }
        } catch (error) {
          gradesSkipped++;
          console.error(`   ❌ ${file} - Error: ${error.message}`);
        }
      }
      
      if (gradesSkipped > 0) {
        console.log(`\n   ℹ️  Summary: ${gradesProcessed} processed, ${gradesSkipped} skipped`);
        console.log(`   💡 Tip: Ensure student data is imported before their grades`);
      }
    } else {
      console.log('\n📊 No student grades Excel files found');
    }
  } catch {
    console.log('\n📊 Student grades Excel folder not found, creating...');
    await fs.mkdir(this.gradesExcelFolder, { recursive: true });
  }

  console.log('\n' + '='.repeat(60));
  console.log(`✅ Auto-scan complete: ${totalProcessed} files processed`);
  console.log('='.repeat(60));
}

  /**
   * AUTO-CLEANUP: Clear all data on exit
   */
  async autoCleanupOnExit() {
  console.log('\n' + '='.repeat(60));
  console.log('🧹 AUTO-CLEANUP: Clearing all data...');
  console.log('='.repeat(60));

  try {
    // Clear student data
    await this.db.clearAllData();
    
    // Clear COR schedules
    await this.clearAllCORSchedules();
    
    // Clear student grades (NEW)
    await this.gradesManager.clearAllGrades();
    
    console.log('✅ All data cleared from database');
  } catch (error) {
    console.error(`❌ Error during cleanup: ${error.message}`);
  }
}

  /**
 * Clear all COR schedules from all departments
 */
async clearAllCORSchedules() {
  try {
    const departments = ['ccs', 'chtm', 'cba', 'cte', 'unknown'];
    let totalCleared = 0;

    for (const dept of departments) {
      try {
        const collection = this.db.db.collection(`schedules_${dept}`);
        const result = await collection.deleteMany({ data_type: 'cor_schedule' });
        
        if (result.deletedCount > 0) {
          console.log(`   Cleared ${result.deletedCount} COR schedule(s) from schedules_${dept}`);
          totalCleared += result.deletedCount;
        }
      } catch (error) {
        // Collection might not exist, continue
        continue;
      }
    }

    if (totalCleared > 0) {
      console.log(`✅ Total COR schedules cleared: ${totalCleared}`);
    } else {
      console.log('ℹ️  No COR schedules to clear');
    }
  } catch (error) {
    console.error(`❌ Error clearing COR schedules: ${error.message}`);
  }
}

  async clearAllData() {
  try {
    const confirm = await this.prompt('⚠️  Clear ALL student data AND COR schedules from MongoDB? (yes/no): ');
    
    if (confirm.trim().toLowerCase() === 'yes') {
      // Clear student data
      await this.db.clearAllData();
      
      // Clear COR schedules
      await this.clearAllCORSchedules();
      
      console.log('✅ All data cleared from MongoDB');
    } else {
      console.log('❌ Operation cancelled');
    }
  } catch (error) {
    console.error(`❌ Error clearing data: ${error.message}`);
  }
}

  async scanAndProcessFiles() {
    try {
      // Check if directory exists
      try {
        await fs.access(this.studentExcelFolder);
      } catch {
        console.log(`📁 Creating folder: ${this.studentExcelFolder}`);
        await fs.mkdir(this.studentExcelFolder, { recursive: true });
        console.log(`ℹ️  Place your Excel files in: ${this.studentExcelFolder}`);
        return false;
      }

      // Find all Excel files
      const files = await fs.readdir(this.studentExcelFolder);
      const excelFiles = files.filter(file => 
        file.endsWith('.xlsx') || file.endsWith('.xls')
      );

      if (excelFiles.length === 0) {
        console.log(`⚠️  No Excel files found in: ${this.studentExcelFolder}`);
        console.log(`ℹ️  Place your Excel files there and run again`);
        return false;
      }

      console.log(`\n📊 Found ${excelFiles.length} Excel file(s)`);
      let totalProcessed = 0;

      for (const excelFile of excelFiles) {
        const filePath = path.join(this.studentExcelFolder, excelFile);
        console.log(`\n📄 Processing: ${excelFile}`);
        
        try {
          const success = await StudentDataExtractor.processExcel(filePath, this.db);
          
          if (success) {
            console.log(`✅ Successfully processed: ${excelFile}`);
            totalProcessed++;
          } else {
            console.log(`⚠️  No data extracted from: ${excelFile}`);
          }
        } catch (error) {
          console.error(`❌ Error processing ${excelFile}: ${error.message}`);
        }
      }

      return totalProcessed > 0;

    } catch (error) {
      console.error(`❌ Error scanning files: ${error.message}`);
      return false;
    }
  }

  async showStatistics() {
  const stats = await this.db.getStatistics();
  const corStats = await this.corManager.getCORStatistics();

  console.log('\n' + '='.repeat(60));
  console.log('📊 SYSTEM STATISTICS');
  console.log('='.repeat(60));
  
  console.log('\n👥 STUDENTS:');
  console.log(`   Total Students: ${stats.total_students}`);
  console.log(`   Pending Media: ${stats.pending_media}`);
  console.log(`   Average Completion: ${stats.average_completion.toFixed(1)}%`);

  if (Object.keys(stats.by_department).length > 0) {
    console.log('\n   By Department:');
    Object.entries(stats.by_department).forEach(([dept, count]) => {
      console.log(`      • ${dept}: ${count} students`);
    });
  }

  // Add COR statistics
  if (corStats && corStats.total_schedules > 0) {
    console.log('\n📚 COR SCHEDULES:');
    console.log(`   Total Schedules: ${corStats.total_schedules}`);
    console.log(`   Total Subjects: ${corStats.total_subjects}`);
    console.log(`   Total Units: ${corStats.total_units}`);

    if (Object.keys(corStats.by_department).length > 0) {
      console.log('\n   By Department:');
      Object.entries(corStats.by_department).forEach(([dept, count]) => {
        console.log(`      • ${dept}: ${count} schedule(s)`);
      });
    }
  } else {
    console.log('\n📚 COR SCHEDULES:');
    console.log('   No COR schedules loaded');
  }
}

  async showPendingMedia() {
    const pending = await this.db.getPendingMediaStudents();

    if (pending.length === 0) {
      console.log('\n✅ No students waiting for media!');
      return;
    }

    console.log('\n' + '='.repeat(60));
    console.log(`⏳ STUDENTS WAITING FOR MEDIA (${pending.length})`);
    console.log('='.repeat(60));

    pending.forEach((student, index) => {
      console.log(`\n${index + 1}. ${student.full_name || 'N/A'} (${student.student_id})`);
      console.log(`   Course: ${student.course} | Year: ${student.year} | Section: ${student.section}`);

      const waiting = [];
      if (student.waiting_for.image) waiting.push('📸 Image');
      if (student.waiting_for.audio) waiting.push('🎤 Audio');

      console.log(`   Waiting for: ${waiting.join(', ')}`);
    });
  }

  async searchStudents() {
    console.log('\n' + '='.repeat(60));
    console.log('🔍 STUDENT SEARCH');
    console.log('='.repeat(60));

    const query = (await this.prompt('\nEnter search query (name or ID): ')).trim();

    if (!query) {
      console.log('❌ Please enter a search query');
      return;
    }

    // Build filters conversationally
    const filters = {};
    
    console.log('\n💬 Let me help you narrow down the search...');
    
    // Ask for department
    console.log('\nWhich department? (or press Enter to search all)');
    console.log('  Options: CCS, CHTM, CBA, CTE');
    const department = (await this.prompt('Department: ')).trim().toUpperCase() || null;
    if (department) filters.department = department;
    
    // Ask for course
    const course = (await this.prompt('Which course? (e.g., BSCS, or press Enter to skip): ')).trim().toUpperCase() || null;
    if (course) filters.course = course;
    
    // Ask for year
    const year = (await this.prompt('Which year? (1-4, or press Enter to skip): ')).trim() || null;
    if (year) filters.year = year;
    
    // Ask for section
    const section = (await this.prompt('Which section? (A, B, C, or press Enter to skip): ')).trim().toUpperCase() || null;
    if (section) filters.section = section;

    // Show what we're searching for
    console.log('\n🔎 Searching for:', query);
    if (Object.keys(filters).length > 0) {
      console.log('📋 Filters applied:');
      if (filters.department) console.log(`   Department: ${filters.department}`);
      if (filters.course) console.log(`   Course: ${filters.course}`);
      if (filters.year) console.log(`   Year: ${filters.year}`);
      if (filters.section) console.log(`   Section: ${filters.section}`);
    } else {
      console.log('📋 No filters - searching all students');
    }

    // Search with filters
    const results = await this.db.searchStudents(query, Object.keys(filters).length > 0 ? filters : null);
    const displayResults = this.db.getStudentsDisplay(results);

    if (displayResults.length === 0) {
      console.log('\n❌ No students found with these criteria');
      
      // Offer to search without filters
      const searchAgain = await this.prompt('\n💡 Want to search without filters? (yes/no): ');
      if (searchAgain.trim().toLowerCase() === 'yes') {
        const allResults = await this.db.searchStudents(query, null);
        const allDisplayResults = this.db.getStudentsDisplay(allResults);
        
        if (allDisplayResults.length === 0) {
          console.log('\n❌ No students found at all with that search term');
          return;
        }
        
        console.log(`\n✅ Found ${allDisplayResults.length} student(s) matching "${query}" (all departments):`);
        console.log('='.repeat(60));

        allDisplayResults.forEach((student, index) => {
          console.log(`\n${index + 1}. ${student.full_name || 'N/A'} (ID: ${student.student_id})`);
          console.log(`   Course: ${student.course} | Year: ${student.year} | Section: ${student.section}`);
          console.log(`   Department: ${student.department}`);
          console.log(`   Completion: ${student.completion_percentage.toFixed(1)}%`);
          
          // Show media with default indicator
          const imageDisplay = student.image?.is_default ? '📸 default image' : `📸 ${student.image?.status || 'waiting'}`;
          const audioDisplay = student.audio?.is_default ? '🎤 no audio' : `🎤 ${student.audio?.status || 'waiting'}`;
          console.log(`   Media: ${imageDisplay} | ${audioDisplay}`);
          
          // Show image path
          if (student.image?.display_path) {
            console.log(`   Image: ${student.image.display_path}`);
          }
        });
      }
      return;
    }

    // Show results
    console.log(`\n✅ Found ${displayResults.length} student(s):`);
    console.log('='.repeat(60));

    displayResults.forEach((student, index) => {
      console.log(`\n${index + 1}. ${student.full_name || 'N/A'} (ID: ${student.student_id})`);
      console.log(`   Course: ${student.course} | Year: ${student.year} | Section: ${student.section}`);
      console.log(`   Department: ${student.department}`);
      console.log(`   Completion: ${student.completion_percentage.toFixed(1)}%`);

      // Show media with default indicator
      const imageDisplay = student.image?.is_default ? '📸 default image' : `📸 ${student.image?.status || 'waiting'}`;
      const audioDisplay = student.audio?.is_default ? '🎤 no audio' : `🎤 ${student.audio?.status || 'waiting'}`;
      console.log(`   Media: ${imageDisplay} | ${audioDisplay}`);
      
      // Show image path
      if (student.image?.display_path) {
        console.log(`   Image: ${student.image.display_path}`);
      }
    });
    
    // If multiple results, offer to refine
    if (displayResults.length > 5) {
      console.log(`\n💡 Showing ${displayResults.length} results. You can search again with more specific filters to narrow it down.`);
    }
  }

  async manualEntry() {
    console.log('\n' + '='.repeat(60));
    console.log('✏️  MANUAL STUDENT ENTRY');
    console.log('='.repeat(60));

    console.log('\nEnter student information:');

    const studentData = {
      student_id: (await this.prompt('Student ID: ')).trim(),
      surname: this.titleCase((await this.prompt('Surname: ')).trim()),
      first_name: this.titleCase((await this.prompt('First Name: ')).trim()),
      course: (await this.prompt('Course (e.g., BSCS): ')).trim().toUpperCase(),
      section: (await this.prompt('Section: ')).trim().toUpperCase(),
      year: (await this.prompt('Year (1-4): ')).trim(),
      contact_number: (await this.prompt('Contact Number: ')).trim(),
      guardian_name: this.titleCase((await this.prompt('Guardian Name: ')).trim()),
      guardian_contact: (await this.prompt('Guardian Contact: ')).trim(),
      descriptor: (await this.prompt('Descriptor (face embedding, optional): ')).trim() || null
    };

    // Create full name
    if (studentData.surname && studentData.first_name) {
      studentData.full_name = `${studentData.surname}, ${studentData.first_name}`;
    }

    // Detect department
    if (studentData.course) {
      studentData.department = StudentDataExtractor.detectDepartment(studentData.course);
    }

    // Create record
    const result = await this.db.createStudentRecord(studentData, 'manual_input');

    if (result) {
      console.log(`\n✅ Student ${result} created successfully!`);
      console.log('ℹ️  This student is now waiting for image and audio uploads');
    } else {
      console.log('\n❌ Failed to create student record');
    }
  }

  titleCase(str) {
    return str.split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }

  async viewCORSchedules() {
  console.log('\n' + '='.repeat(60));
  console.log('📚 COR SCHEDULES');
  console.log('='.repeat(60));

  // Get statistics
  const stats = await this.corManager.getCORStatistics();

  if (!stats || stats.total_schedules === 0) {
    console.log('\n⚠️  No COR schedules found in database');
    console.log('💡 Place COR Excel files in uploaded_files/cor_excel/ and restart');
    return;
  }

  console.log(`\n📊 COR Statistics:`);
  console.log(`   Total Schedules: ${stats.total_schedules}`);
  console.log(`   Total Subjects: ${stats.total_subjects}`);
  console.log(`   Total Units: ${stats.total_units}`);

  console.log(`\n📚 By Department:`);
  Object.entries(stats.by_department).forEach(([dept, count]) => {
    console.log(`   • ${dept}: ${count} schedule(s)`);
  });

  console.log(`\n📖 By Course:`);
  Object.entries(stats.by_course).forEach(([course, count]) => {
    console.log(`   • ${course}: ${count} schedule(s)`);
  });

  // Ask if they want to view specific schedules
  const viewDetails = await this.prompt('\nView detailed schedules? (yes/no): ');

  if (viewDetails.trim().toLowerCase() === 'yes') {
    console.log('\nFilter by department:');
    console.log('1. CCS - Computer Studies');
    console.log('2. CHTM - Hospitality & Tourism');
    console.log('3. CBA - Business Administration');
    console.log('4. CTE - Teacher Education');
    console.log('5. All Departments');

    const deptChoice = await this.prompt('\nSelect (1-5): ');
    
    const deptMap = {
      '1': 'CCS',
      '2': 'CHTM',
      '3': 'CBA',
      '4': 'CTE',
      '5': null
    };

    const department = deptMap[deptChoice];

    let schedules;
    if (department) {
      schedules = await this.corManager.getCORSchedules({ department });
    } else {
      schedules = await this.corManager.getAllCORSchedules();
    }

    if (schedules.length === 0) {
      console.log('\n⚠️  No schedules found');
      return;
    }

    console.log(`\n✅ Found ${schedules.length} schedule(s):`);
    console.log('='.repeat(60));

    schedules.forEach((schedule, index) => {
  console.log(`\n${index + 1}. ${schedule.course} - Year ${schedule.year} - Section ${schedule.section}`);  // ← CHANGED
  console.log(`   Department: ${schedule.department}`);
  console.log(`   Adviser: ${schedule.adviser || 'N/A'}`);
  console.log(`   Total Units: ${schedule.total_units}`);
  console.log(`   Subjects: ${schedule.subject_count}`);
  console.log(`   Subject Codes: ${schedule.subject_codes}`);
  console.log(`   Source: ${schedule.source_file}`);
  console.log(`   Created: ${new Date(schedule.created_at).toLocaleString()}`);
});

    // Option to view full schedule details
    const viewFull = await this.prompt('\nView full schedule details for a specific one? Enter number (or press Enter to skip): ');
    
    if (viewFull && parseInt(viewFull) > 0 && parseInt(viewFull) <= schedules.length) {
      const selectedSchedule = schedules[parseInt(viewFull) - 1];
      
      console.log('\n' + '='.repeat(60));
      console.log('📋 FULL SCHEDULE DETAILS');
      console.log('='.repeat(60));
      console.log(`\n${selectedSchedule.course} - Year ${selectedSchedule.year_level} - Section ${selectedSchedule.section}`);
      console.log(`Adviser: ${selectedSchedule.adviser || 'N/A'}\n`);

      selectedSchedule.subjects.forEach((subject, i) => {
        console.log(`${i + 1}. ${subject['Subject Code']} - ${subject['Description']}`);
        console.log(`   Type: ${subject['Type']} | Units: ${subject['Units']}`);
        console.log(`   Schedule: ${subject['Day']} ${subject['Time Start']}-${subject['Time End']}`);
        console.log(`   Room: ${subject['Room']}`);
        console.log('');
      });
    }
  }
}


  async fixCORDepartments() {
  console.log('\n' + '='.repeat(60));
  console.log('🔧 FIX COR DEPARTMENT ASSIGNMENTS');
  console.log('='.repeat(60));

  // Get all schedules from unknown
  const unknownCollection = this.db.db.collection('schedules_unknown');
  const unknownSchedules = await unknownCollection.find({ data_type: 'cor_schedule' }).toArray();

  if (unknownSchedules.length === 0) {
    console.log('\n✅ No schedules need fixing!');
    return;
  }

  console.log(`\n⚠️  Found ${unknownSchedules.length} schedule(s) in UNKNOWN department`);
  console.log('Let\'s fix them one by one:\n');

  for (const schedule of unknownSchedules) {
    console.log('='.repeat(60));
    console.log(`Source File: ${schedule.source_file}`);
    console.log(`Current Course: "${schedule.course}"`);
    console.log(`Current Year: "${schedule.year_level}"`);
    console.log(`Current Section: "${schedule.section}"`);
    console.log(`Subject Count: ${schedule.subject_count}`);
    
    // Show some subjects to help identify
    if (schedule.subjects && schedule.subjects.length > 0) {
      console.log('\nSample Subjects:');
      schedule.subjects.slice(0, 3).forEach(subj => {
        console.log(`  - ${subj['Subject Code']}: ${subj['Description']}`);
      });
    }

    const shouldFix = await this.prompt('\nFix this schedule? (yes/skip): ');
    
    if (shouldFix.trim().toLowerCase() === 'yes') {
      // Get correct info
      console.log('\nEnter correct information:');
      const correctCourse = (await this.prompt('Course (e.g., BSCS, BSIT): ')).trim().toUpperCase();
      const correctYear = (await this.prompt('Year Level (1-4): ')).trim();
      const correctSection = (await this.prompt('Section (A, B, C): ')).trim().toUpperCase();
      
      if (correctCourse && correctYear && correctSection) {
        // Detect department
        const correctDept = this.corExtractor.detectDepartmentFromCourse(correctCourse);
        
        // Update the schedule
        schedule.course = correctCourse;
        schedule.year_level = correctYear;
        schedule.section = correctSection;
        schedule.department = correctDept;
        schedule.schedule_id = `COR_${correctDept}_${correctCourse}_Y${correctYear}_${correctSection}_${Date.now()}`;
        schedule.updated_at = new Date();

        // Move to correct collection
        const correctCollection = this.db.db.collection(`schedules_${correctDept.toLowerCase()}`);
        await correctCollection.insertOne(schedule);
        
        // Delete from unknown
        await unknownCollection.deleteOne({ _id: schedule._id });
        
        console.log(`✅ Moved to schedules_${correctDept.toLowerCase()}`);
      } else {
        console.log('❌ Skipped - incomplete information');
      }
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('✅ Fix process complete!');
}

  async viewByDepartment() {
    console.log('\n' + '='.repeat(60));
    console.log('📚 VIEW STUDENTS BY DEPARTMENT');
    console.log('='.repeat(60));
    
    console.log('\nAvailable Departments:');
    console.log('1. CCS - Computer Studies');
    console.log('2. CHTM - Hospitality & Tourism Management');
    console.log('3. CBA - Business Administration');
    console.log('4. CTE - Teacher Education');
    console.log('5. UNKNOWN - Unclassified');
    
    const choice = await this.prompt('\nSelect department (1-5): ');
    
    const deptMap = {
      '1': 'CCS',
      '2': 'CHTM',
      '3': 'CBA',
      '4': 'CTE',
      '5': 'UNKNOWN'
    };
    
    const department = deptMap[choice];
    
    if (!department) {
      console.log('❌ Invalid choice');
      return;
    }
    
    console.log(`\n📊 Statistics for ${department}:`);
    const stats = await this.db.getDepartmentStatistics(department);
    
    console.log(`Total Students: ${stats.total_students}`);
    console.log(`Average Completion: ${stats.average_completion.toFixed(1)}%`);
    
    if (stats.by_course.length > 0) {
      console.log('\nBy Course > Year > Section:');
      stats.by_course.forEach(item => {
        console.log(`  ${item._id.course} - Year ${item._id.year} - Section ${item._id.section}: ${item.count} students`);
      });
    }
    
    const viewStudents = await this.prompt('\nView all students in this department? (yes/no): ');
    
    if (viewStudents.trim().toLowerCase() === 'yes') {
      const students = await this.db.getStudentsByDepartment(department);
      
      console.log(`\n✅ ${students.length} students in ${department}:`);
      console.log('='.repeat(60));
      
      students.forEach((student, index) => {
        console.log(`\n${index + 1}. ${student.full_name || 'N/A'} (${student.student_id})`);
        console.log(`   Course: ${student.course} | Year: ${student.year} | Section: ${student.section}`);
        console.log(`   Completion: ${student.completion_percentage.toFixed(1)}%`);
      });
    }
  }

  async debugCORExcel() {
  console.log('\n' + '='.repeat(60));
  console.log('🐛 DEBUG COR EXCEL FILE');
  console.log('='.repeat(60));

  const corFolder = path.join(__dirname, 'uploaded_files', 'cor_excel');
  const files = await fs.readdir(corFolder);
  const excelFiles = files.filter(file => file.endsWith('.xlsx') || file.endsWith('.xls'));

  if (excelFiles.length === 0) {
    console.log('⚠️  No Excel files found');
    return;
  }

  console.log('\nAvailable files:');
  excelFiles.forEach((file, i) => {
    console.log(`${i + 1}. ${file}`);
  });

  const choice = await this.prompt('\nSelect file number to debug: ');
  const fileIndex = parseInt(choice) - 1;

  if (fileIndex < 0 || fileIndex >= excelFiles.length) {
    console.log('❌ Invalid choice');
    return;
  }

  const filePath = path.join(corFolder, excelFiles[fileIndex]);
  
  // Read Excel
  const xlsx = require('xlsx');
  const workbook = xlsx.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const data = xlsx.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

  console.log(`\n📄 File: ${excelFiles[fileIndex]}`);
  console.log(`📏 Dimensions: ${data.length} rows x ${data[0]?.length || 0} cols`);
  console.log('\n📋 First 10 rows:\n');

  for (let i = 0; i < Math.min(10, data.length); i++) {
    console.log(`Row ${i}:`);
    for (let j = 0; j < Math.min(data[i].length, 8); j++) {
      const cell = data[i][j];
      if (cell) console.log(`  [${j}]: ${cell}`);
    }
    console.log('');
  }
}
  
  async fixExistingCORDepartments() {
  console.log('\n' + '='.repeat(60));
  console.log('🔧 FIXING EXISTING COR DEPARTMENTS');
  console.log('='.repeat(60));

  const CORExcelExtractor = require('./cor_excel_extractor');
  const extractor = new CORExcelExtractor();

  // Get all schedules from unknown collection
  const unknownCollection = this.db.db.collection('schedules_unknown');
  const unknownSchedules = await unknownCollection.find({ data_type: 'cor_schedule' }).toArray();

  if (unknownSchedules.length === 0) {
    console.log('\n✅ No schedules need fixing!');
    return;
  }

  console.log(`\n⚠️  Found ${unknownSchedules.length} schedule(s) in UNKNOWN department`);
  console.log('Fixing automatically...\n');

  let fixedCount = 0;

  for (const schedule of unknownSchedules) {
    console.log(`📄 ${schedule.source_file}`);
    console.log(`   Current: ${schedule.course} (Department: ${schedule.department})`);

    // Detect department from course name
    const correctDept = extractor.detectDepartmentFromCourse(schedule.course);

    if (correctDept && correctDept !== 'UNKNOWN') {
      // Convert full course name to code if needed
      const courseCode = extractor.cleanProgramInfoValue(schedule.course, 'Program') || schedule.course;

      // Update the schedule
      schedule.course = courseCode;
      schedule.department = correctDept;
      schedule.schedule_id = `COR_${correctDept}_${courseCode}_Y${schedule.year_level}_${schedule.section}_${Date.now()}`;
      schedule.updated_at = new Date();

      // Insert into correct collection
      const correctCollection = this.db.db.collection(`schedules_${correctDept.toLowerCase()}`);
      await correctCollection.insertOne(schedule);

      // Delete from unknown
      await unknownCollection.deleteOne({ _id: schedule._id });

      console.log(`   ✅ Fixed: ${courseCode} → ${correctDept} (moved to schedules_${correctDept.toLowerCase()})`);
      fixedCount++;
    } else {
      console.log(`   ⚠️  Still unknown - course "${schedule.course}" not recognized`);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log(`✅ Fixed ${fixedCount} schedule(s)!`);
}


  async mainMenu() {
    while (true) {
      console.log('\n' + '='.repeat(60));
      console.log('🎓 SCHOOL INFORMATION SYSTEM - MONGODB');
      console.log('='.repeat(60));
      console.log('\n1. Process Excel Files (Manual)');
      console.log('2. Manual Student Entry');
      console.log('3. Search Students');
      console.log('4. Show Pending Media');
      console.log('5. Show Statistics');
      console.log('6. View by Department');
      console.log('7. View COR Schedules');
      console.log('8. Fix COR Departments (Auto)'); 
      console.log('9. Clear All Data (Manual)');
      console.log('10. Exit'); 

      const choice = (await this.prompt('\nSelect option (1-9): ')).trim();

      try {
        if (choice === '1') {
          await this.scanAndProcessFiles();
        } else if (choice === '2') {
          await this.manualEntry();
        } else if (choice === '3') {
          await this.searchStudents();
        } else if (choice === '4') {
          await this.showPendingMedia();
        } else if (choice === '5') {
          await this.showStatistics();
        } else if (choice === '6') {
          await this.viewByDepartment();
        } else if (choice === '7') {
          await this.viewCORSchedules();  
        }
        else if (choice === '8') {
          await this.fixExistingCORDepartments();
        }
        else if (choice === '9') {
          await this.clearAllData();
        }
        else if (choice === '10') {
          await this.runQueryAssistant();  // ← NEW
        }
        else if (choice === '11') {
          console.log('\n👋 Exiting...');
          break;
        } else {
          console.log('\n❌ Invalid option. Please select 1-8');
        }

        if (choice !== '8') {
          await this.prompt('\nPress Enter to continue...');
        }

      } catch (error) {
        console.error(`❌ Error: ${error.message}`);
        await this.prompt('\nPress Enter to continue...');
      }
    }
  }

  async runQueryAssistant() {
  console.log('\n' + '='.repeat(60));
  console.log('🤖 QUERY ASSISTANT');
  console.log('='.repeat(60));
  console.log('\n💡 Ask me anything about your database!');
  console.log('Type "help" for examples, or "exit" to return to menu\n');

  while (true) {
    const query = await this.prompt('🔍 Your question: ');

    if (!query.trim()) {
      console.log('Please enter a question');
      continue;
    }

    if (query.toLowerCase() === 'exit') {
      console.log('👋 Returning to main menu...');
      break;
    }

    if (query.toLowerCase() === 'help') {
      const help = this.queryAssistant.showQueryHelp();
      console.log('\n' + help.message);
      continue;
    }

    // Process the query
    const result = await this.queryAssistant.processQuery(query);

    if (result.success) {
      if (result.formatted) {
        console.log('\n' + result.formatted);
      } else if (result.message) {
        console.log('\n✅', result.message);
      }

      // Show data if available
      if (result.data) {
        if (Array.isArray(result.data)) {
          // Show first few items
          console.log('\nShowing first results:');
          result.data.slice(0, 5).forEach((item, i) => {
            if (item.full_name) {
              console.log(`  ${i + 1}. ${item.full_name} (${item.student_id}) - ${item.course}`);
            }
          });
          if (result.data.length > 5) {
            console.log(`  ... and ${result.data.length - 5} more`);
          }
        } else if (typeof result.data === 'object') {
          // Show object data
          console.log('\nDetails:');
          Object.entries(result.data).forEach(([key, value]) => {
            if (typeof value === 'object') {
              console.log(`  ${key}:`);
              Object.entries(value).forEach(([k, v]) => {
                console.log(`    • ${k}: ${v}`);
              });
            } else {
              console.log(`  • ${key}: ${value}`);
            }
          });
        }
      }
    } else {
      console.log('\n❌', result.message || result.error || 'Could not process query');
      console.log('💡 Type "help" for examples');
    }

    console.log('');  // Empty line for spacing
  }
}

  async run() {
    console.log('🎓 Starting School Information System...');
    console.log('='.repeat(60));

    try {
      // Connect to database
      await this.db.connect();
      
      // Initialize COR manager after DB connection
      this.corManager = new CORScheduleManager(this.db);
      this.gradesManager = new StudentGradesManager(this.db);  
      this.queryAssistant = new QueryAssistant(this.db, this.corManager, this.gradesManager);

      // AUTO-SCAN: Process all files on startup
      await this.autoScanAndProcessAllFiles();

      // Show initial stats
      await this.showStatistics();

      // Start main menu
      await this.mainMenu();

    } catch (error) {
      console.error(`\n❌ System error: ${error.message}`);
    } finally {
      // AUTO-CLEANUP: Clear data before exit
      await this.autoCleanupOnExit();
      
      await this.db.close();
      this.rl.close();
      console.log('👋 Disconnected from MongoDB');
    }
  }
}

async function main() {
  try {
    // You can change connection string here
    // For local MongoDB:
    const system = new SchoolInformationSystem();

    // For MongoDB Atlas:
    // const system = new SchoolInformationSystem('mongodb+srv://user:pass@cluster.mongodb.net/school_system');

    await system.run();

  } catch (error) {
    console.error(`❌ Failed to start system: ${error.message}`);
    process.exit(1);
  }
}

// Handle Ctrl+C gracefully
process.on('SIGINT', async () => {
  console.log('\n\n⚠️  System shutdown requested');
  process.exit(0);
});

// Run if executed directly
if (require.main === module) {
  main();
}

module.exports = SchoolInformationSystem;