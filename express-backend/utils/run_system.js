// run_system.js
const readline = require('readline');
const path = require('path');
const fs = require('fs').promises;
const QueryAssistant = require('./query_assistant');
const { 
  StudentDatabase, 
  StudentDataExtractor, 
  CORScheduleManager, 
  StudentGradesManager,
  TeachingFacultyManager,
  TeachingFacultyScheduleManager,
  NonTeachingFacultyManager,
  CurriculumManager,
  NonTeachingScheduleManager,
  AdminManager,
  GeneralInfoManager,
  TeachingFacultyResumeManager
} = require('./main');
const CORExcelExtractor = require('./cor_excel_extractor');

class SchoolInformationSystem {
  constructor(connectionString = null) {
    // Initialize database
    this.db = new StudentDatabase(connectionString);
    
    // Define base path
    this.basePath = path.join(__dirname, 'uploaded_files');
    
    // Define ALL folder paths
    this.studentExcelFolder = path.join(this.basePath, 'student_list_excel');
    this.corExcelFolder = path.join(this.basePath, 'cor_excel');
    this.gradesExcelFolder = path.join(this.basePath, 'student_grades_excel');
    this.teachingFacultyExcelFolder = path.join(this.basePath, 'teaching_faculty_excel');
    this.teachingFacultySchedExcelFolder = path.join(this.basePath, 'teaching_faculty_sched_excel');
    this.nonTeachingFacultyExcelFolder = path.join(this.basePath, 'non_teaching_faculty_excel');
    this.nonTeachingScheduleExcelFolder = path.join(this.basePath, 'non_teaching_schedules_excel');
    this.adminExcelFolder = path.join(this.basePath, 'admin_excel'); 
    this.generalInfoFolder = path.join(this.basePath, 'general_info');
    this.teachingFacultyResumesFolder = path.join(this.basePath, 'teaching_faculty_resumes_pdf'); 
    this.curriculumExcelFolder = path.join(this.basePath, 'curriculum_excel');
    this.processedFolder = path.join(this.basePath, 'processed');
    
    // Initialize managers (will be set after DB connection)
    this.corExtractor = new CORExcelExtractor();
    this.corManager = null;
    this.gradesManager = null;
    this.teachingFacultyManager = null;
    this.teachingFacultyScheduleManager = null;
    this.nonTeachingFacultyManager = null;
    this.nonTeachingScheduleManager = null;
    this.adminManager = null;
    this.generalInfoManager = null;
    this.teachingFacultyResumeManager = null;
    this.curriculumManager = null;
    this.queryAssistant = null;
    
    // Create readline interface
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    // Log folder configuration
    console.log('\n📁 System Folder Configuration:');
    console.log(`   Base Path: ${this.basePath}`);
    console.log(`   Student Excel: ${this.studentExcelFolder}`);
    console.log(`   COR Excel: ${this.corExcelFolder}`);
    console.log(`   Grades Excel: ${this.gradesExcelFolder}`);
    console.log(`   Teaching Faculty Excel: ${this.teachingFacultyExcelFolder}`);
    console.log(`   Teaching Faculty Schedule: ${this.teachingFacultySchedExcelFolder}`);
    console.log(`   Non-Teaching Faculty: ${this.nonTeachingFacultyExcelFolder}`);
    console.log(`   Non-Teaching Schedules: ${this.nonTeachingScheduleExcelFolder}`);
    console.log(`   Admin Excel: ${this.adminExcelFolder}`); 
    console.log(`   General Info PDFs: ${this.generalInfoFolder}`);
    console.log(`   Teaching Faculty Resumes: ${this.teachingFacultyResumesFolder}`); 
    console.log(`   Curriculum Excel: ${this.curriculumExcelFolder}`);
    console.log(`   Processed Files: ${this.processedFolder}`);
  }

  /**
   * Prompt helper
   */
  prompt(question) {
    return new Promise((resolve) => {
      this.rl.question(question, resolve);
    });
  }

  /**
   * AUTO-SCAN: Automatically scan and process all files on startup
   */
  async autoScanAndProcessAllFiles() {
    console.log('\n' + '='.repeat(60));
    console.log('🔄 AUTO-SCAN: Processing all files...');
    console.log('='.repeat(60));

    let totalProcessed = 0;

    // ============================================================
    // STEP 1: Process Student Excel Files
    // ============================================================
    try {
      await fs.access(this.studentExcelFolder);
      const studentFiles = await fs.readdir(this.studentExcelFolder);
      const studentExcelFiles = studentFiles.filter(file => 
        file.endsWith('.xlsx') || file.endsWith('.xls')
      );

      if (studentExcelFiles.length > 0) {
        console.log(`\n👥 Found ${studentExcelFiles.length} student Excel file(s)`);
        
        for (const file of studentExcelFiles) {
          const filePath = path.join(this.studentExcelFolder, file);
          console.log(`   Processing: ${file}`);
          
          try {
            const success = await StudentDataExtractor.processExcel(filePath, this.db);
            
            if (success) {
              totalProcessed++;
              console.log(`   ✅ ${file}`);
            } else {
              console.log(`   ❌ ${file} - No data extracted`);
            }
          } catch (error) {
            console.error(`   ❌ ${file} - Error: ${error.message}`);
          }
        }
      } else {
        console.log('\n👥 No student Excel files found');
      }
    } catch {
      console.log('\n👥 Student Excel folder not found, creating...');
      await fs.mkdir(this.studentExcelFolder, { recursive: true });
    }

    // ============================================================
    // STEP 2: Process COR Excel Files
    // ============================================================
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
            const scheduleData = await this.corExtractor.processCORExcel(filePath);
            
            if (scheduleData) {
              const result = await this.corManager.storeCORSchedule(scheduleData);
              
              if (result) {
                totalProcessed++;
                console.log(`   ✅ ${file}`);
              } else {
                console.log(`   ❌ ${file} - Failed to store`);
              }
            } else {
              console.log(`   ❌ ${file} - Could not extract data`);
            }
          } catch (error) {
            console.error(`   ❌ ${file} - Error: ${error.message}`);
          }
        }
      } else {
        console.log('\n📚 No COR Excel files found');
      }
    } catch {
      console.log('\n📚 COR Excel folder not found, creating...');
      await fs.mkdir(this.corExcelFolder, { recursive: true });
    }

    // ============================================================
    // STEP 3: Process Student Grades Excel Files
    // ============================================================
    try {
      await fs.access(this.gradesExcelFolder);
      const gradesFiles = await fs.readdir(this.gradesExcelFolder);
      const gradesExcelFiles = gradesFiles.filter(file => 
        file.endsWith('.xlsx') || file.endsWith('.xls')
      );

      if (gradesExcelFiles.length > 0) {
        console.log(`\n📝 Found ${gradesExcelFiles.length} Grades Excel file(s)`);
        
        const StudentGradesExtractor = require('./student_grades_extractor');
        const gradesExtractor = new StudentGradesExtractor();
        
        let gradesProcessed = 0;
        let gradesSkipped = 0;
        
        for (const file of gradesExcelFiles) {
          const filePath = path.join(this.gradesExcelFolder, file);
          console.log(`   Processing: ${file}`);
          
          try {
            const gradesData = await gradesExtractor.extractStudentGradesExcelInfo(filePath);
            
            if (gradesData && gradesData.student_info) {
              const result = await this.gradesManager.storeStudentGrades(gradesData);
              
              if (result && result.success) {
                totalProcessed++;
                gradesProcessed++;
                console.log(`   ✅ ${file}`);
              } else {
                gradesSkipped++;
                console.log(`   ❌ ${file} - Failed to store`);
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
        }
      } else {
        console.log('\n📝 No grades Excel files found');
      }
    } catch {
      console.log('\n📝 Grades Excel folder not found, creating...');
      await fs.mkdir(this.gradesExcelFolder, { recursive: true });
    }

    // ============================================================
    // STEP 4: Process Teaching Faculty Excel Files
    // ============================================================
    try {
      await fs.access(this.teachingFacultyExcelFolder);
      const facultyFiles = await fs.readdir(this.teachingFacultyExcelFolder);
      const facultyExcelFiles = facultyFiles.filter(file => 
        file.endsWith('.xlsx') || file.endsWith('.xls')
      );

      if (facultyExcelFiles.length > 0) {
        console.log(`\n👨‍🏫 Found ${facultyExcelFiles.length} Teaching Faculty Excel file(s)`);
        
        const TeachingFacultyExtractor = require('./teaching_faculty_extractor');
        const facultyExtractor = new TeachingFacultyExtractor();
        
        let facultyProcessed = 0;
        let facultySkipped = 0;
        
        for (const file of facultyExcelFiles) {
          const filePath = path.join(this.teachingFacultyExcelFolder, file);
          console.log(`   Processing: ${file}`);
          
          try {
            const facultyData = await facultyExtractor.processTeachingFacultyExcel(filePath);
            
            if (facultyData) {
              const result = await this.teachingFacultyManager.storeTeachingFaculty(facultyData);
              
              if (result) {
                totalProcessed++;
                facultyProcessed++;
                console.log(`   ✅ ${file}`);
              } else {
                facultySkipped++;
                console.log(`   ❌ ${file} - Failed to store`);
              }
            } else {
              facultySkipped++;
              console.log(`   ❌ ${file} - Could not extract data`);
            }
          } catch (error) {
            facultySkipped++;
            console.error(`   ❌ ${file} - Error: ${error.message}`);
          }
        }
        
        if (facultySkipped > 0) {
          console.log(`\n   ℹ️  Summary: ${facultyProcessed} processed, ${facultySkipped} skipped`);
        }
      } else {
        console.log('\n👨‍🏫 No teaching faculty Excel files found');
      }
    } catch {
      console.log('\n👨‍🏫 Teaching faculty Excel folder not found, creating...');
      await fs.mkdir(this.teachingFacultyExcelFolder, { recursive: true });
    }

    // ============================================================
    // STEP 5: Process Teaching Faculty Schedule Excel Files
    // ============================================================
    try {
      await fs.access(this.teachingFacultySchedExcelFolder);
      const schedFiles = await fs.readdir(this.teachingFacultySchedExcelFolder);
      const schedExcelFiles = schedFiles.filter(file => 
        file.endsWith('.xlsx') || file.endsWith('.xls')
      );

      if (schedExcelFiles.length > 0) {
        console.log(`\n📅 Found ${schedExcelFiles.length} Faculty Schedule Excel file(s)`);
        
        const FacultyScheduleExtractor = require('./teaching_faculty_schedule_extractor');
        const schedExtractor = new FacultyScheduleExtractor();
        
        let schedProcessed = 0;
        let schedSkipped = 0;
        
        for (const file of schedExcelFiles) {
          const filePath = path.join(this.teachingFacultySchedExcelFolder, file);
          console.log(`   Processing: ${file}`);
          
          try {
            const schedData = await schedExtractor.processTeachingFacultyScheduleExcel(filePath);
            
            if (schedData) {
              const result = await this.teachingFacultyScheduleManager.storeTeachingFacultySchedule(schedData);
              
              if (result) {
                totalProcessed++;
                schedProcessed++;
                console.log(`   ✅ ${file}`);
              } else {
                schedSkipped++;
                console.log(`   ❌ ${file} - Failed to store`);
              }
            } else {
              schedSkipped++;
              console.log(`   ❌ ${file} - Could not extract data`);
            }
          } catch (error) {
            schedSkipped++;
            console.error(`   ❌ ${file} - Error: ${error.message}`);
          }
        }
        
        if (schedSkipped > 0) {
          console.log(`\n   ℹ️  Summary: ${schedProcessed} processed, ${schedSkipped} skipped`);
        }
      } else {
        console.log('\n📅 No faculty schedule Excel files found');
      }
    } catch {
      console.log('\n📅 Faculty schedule Excel folder not found, creating...');
      await fs.mkdir(this.teachingFacultySchedExcelFolder, { recursive: true });
    }

    // ============================================================
    // STEP 6: Process Non-Teaching Faculty Excel Files
    // ============================================================
    try {
      await fs.access(this.nonTeachingFacultyExcelFolder);
      const nonTeachingFiles = await fs.readdir(this.nonTeachingFacultyExcelFolder);
      const nonTeachingExcelFiles = nonTeachingFiles.filter(file => 
        file.endsWith('.xlsx') || file.endsWith('.xls')
      );

      if (nonTeachingExcelFiles.length > 0) {
        console.log(`\n👨‍💼 Found ${nonTeachingExcelFiles.length} Non-Teaching Faculty Excel file(s)`);
        
        const NonTeachingFacultyExtractor = require('./non_teaching_faculty_extractor');
        const nonTeachingExtractor = new NonTeachingFacultyExtractor();
        
        let nonTeachingProcessed = 0;
        let nonTeachingSkipped = 0;
        
        for (const file of nonTeachingExcelFiles) {
          const filePath = path.join(this.nonTeachingFacultyExcelFolder, file);
          console.log(`   Processing: ${file}`);
          
          try {
            const facultyData = await nonTeachingExtractor.processNonTeachingFacultyExcel(filePath);
            
            if (facultyData) {
              const result = await this.nonTeachingFacultyManager.storeNonTeachingFaculty(facultyData);
              
              if (result) {
                totalProcessed++;
                nonTeachingProcessed++;
                console.log(`   ✅ ${file}`);
              } else {
                nonTeachingSkipped++;
                console.log(`   ❌ ${file} - Failed to store`);
              }
            } else {
              nonTeachingSkipped++;
              console.log(`   ❌ ${file} - Could not extract data`);
            }
          } catch (error) {
            nonTeachingSkipped++;
            console.error(`   ❌ ${file} - Error: ${error.message}`);
          }
        }
        
        if (nonTeachingSkipped > 0) {
          console.log(`\n   ℹ️  Summary: ${nonTeachingProcessed} processed, ${nonTeachingSkipped} skipped`);
        }
      } else {
        console.log('\n👨‍💼 No non-teaching faculty Excel files found');
      }
    } catch {
      console.log('\n👨‍💼 Non-teaching faculty Excel folder not found, creating...');
      await fs.mkdir(this.nonTeachingFacultyExcelFolder, { recursive: true });
    }

    // ============================================================
    // STEP 7: Process Curriculum Excel Files
    // ============================================================
    try {
      await fs.access(this.curriculumExcelFolder);
      const curriculumFiles = await fs.readdir(this.curriculumExcelFolder);
      const curriculumExcelFiles = curriculumFiles.filter(file => 
        file.endsWith('.xlsx') || file.endsWith('.xls')
      );

      if (curriculumExcelFiles.length > 0) {
        console.log(`\n📚 Found ${curriculumExcelFiles.length} Curriculum Excel file(s)`);
        
        const CurriculumExtractor = require('./curriculum_extractor');
        const curriculumExtractor = new CurriculumExtractor();
        
        let curriculumProcessed = 0;
        let curriculumSkipped = 0;
        
        for (const file of curriculumExcelFiles) {
          const filePath = path.join(this.curriculumExcelFolder, file);
          console.log(`   Processing: ${file}`);
          
          try {
            const curriculumData = await curriculumExtractor.processCurriculumExcel(filePath);
            
            if (curriculumData) {
              const result = await this.curriculumManager.storeCurriculum(curriculumData);
              
              if (result) {
                totalProcessed++;
                curriculumProcessed++;
                console.log(`   ✅ ${file}`);
              } else {
                curriculumSkipped++;
                console.log(`   ❌ ${file} - Failed to store`);
              }
            } else {
              curriculumSkipped++;
              console.log(`   ❌ ${file} - Could not extract data`);
            }
          } catch (error) {
            curriculumSkipped++;
            console.error(`   ❌ ${file} - Error: ${error.message}`);
          }
        }
        
        if (curriculumSkipped > 0) {
          console.log(`\n   ℹ️  Summary: ${curriculumProcessed} processed, ${curriculumSkipped} skipped`);
        }
      } else {
        console.log('\n📚 No curriculum Excel files found');
      }
    } catch (err) {
      console.log('\n📚 Curriculum Excel folder not found, creating...');
      await fs.mkdir(this.curriculumExcelFolder, { recursive: true });
    }

    // ============================================================
    // STEP 8: Process Non-Teaching Faculty Schedule Excel Files
    // ============================================================
    try {
      await fs.access(this.nonTeachingScheduleExcelFolder);
      const scheduleFiles = await fs.readdir(this.nonTeachingScheduleExcelFolder);
      const scheduleExcelFiles = scheduleFiles.filter(file => 
        file.endsWith('.xlsx') || file.endsWith('.xls')
      );

      if (scheduleExcelFiles.length > 0) {
        console.log(`\n📅 Found ${scheduleExcelFiles.length} Non-Teaching Schedule Excel file(s)`);
        
        const NonTeachingScheduleExtractor = require('./non_teaching_schedule_extractor');
        const scheduleExtractor = new NonTeachingScheduleExtractor();
        
        let scheduleProcessed = 0;
        let scheduleSkipped = 0;
        
        for (const file of scheduleExcelFiles) {
          const filePath = path.join(this.nonTeachingScheduleExcelFolder, file);
          console.log(`   Processing: ${file}`);
          
          try {
            const scheduleData = await scheduleExtractor.processNonTeachingScheduleExcel(filePath);
            
            if (scheduleData) {
              const result = await this.nonTeachingScheduleManager.storeNonTeachingSchedule(scheduleData);
              
              if (result) {
                totalProcessed++;
                scheduleProcessed++;
                console.log(`   ✅ ${file}`);
              } else {
                scheduleSkipped++;
                console.log(`   ❌ ${file} - Failed to store`);
              }
            } else {
              scheduleSkipped++;
              console.log(`   ❌ ${file} - Could not extract data`);
            }
          } catch (error) {
            scheduleSkipped++;
            console.error(`   ❌ ${file} - Error: ${error.message}`);
          }
        }
        
        if (scheduleSkipped > 0) {
          console.log(`\n   ℹ️  Summary: ${scheduleProcessed} processed, ${scheduleSkipped} skipped`);
        }
      } else {
        console.log('\n📅 No non-teaching schedule Excel files found');
      }
    } catch (err) {
      console.log('\n📅 Non-teaching schedule Excel folder not found, creating...');
      await fs.mkdir(this.nonTeachingScheduleExcelFolder, { recursive: true });
    }

    // ============================================================
    // STEP 9: Process Admin Excel Files
    // ============================================================
    try {
      await fs.access(this.adminExcelFolder);
      const adminFiles = await fs.readdir(this.adminExcelFolder);
      const adminExcelFiles = adminFiles.filter(file => 
        file.endsWith('.xlsx') || file.endsWith('.xls')
      );

      if (adminExcelFiles.length > 0) {
        console.log(`\n👔 Found ${adminExcelFiles.length} Admin Excel file(s)`);
        
        const AdminExtractor = require('./admin_extractor');
        const adminExtractor = new AdminExtractor();
        
        let adminProcessed = 0;
        let adminSkipped = 0;
        
        for (const file of adminExcelFiles) {
          const filePath = path.join(this.adminExcelFolder, file);
          console.log(`   Processing: ${file}`);
          
          try {
            const adminData = await adminExtractor.processAdminExcel(filePath);
            
            if (adminData) {
              const result = await this.adminManager.storeAdmin(adminData);
              
              if (result) {
                totalProcessed++;
                adminProcessed++;
                console.log(`   ✅ ${file}`);
              } else {
                adminSkipped++;
                console.log(`   ❌ ${file} - Failed to store`);
              }
            } else {
              adminSkipped++;
              console.log(`   ❌ ${file} - Could not extract data`);
            }
          } catch (error) {
            adminSkipped++;
            console.error(`   ❌ ${file} - Error: ${error.message}`);
          }
        }
        
        if (adminSkipped > 0) {
          console.log(`\n   ℹ️  Summary: ${adminProcessed} processed, ${adminSkipped} skipped`);
        }
      } else {
        console.log('\n👔 No admin Excel files found');
      }
    } catch (err) {
      console.log('\n👔 Admin Excel folder not found, creating...');
      await fs.mkdir(this.adminExcelFolder, { recursive: true });
    }

    // ============================================================
    // STEP 10: Process General Info PDF Files
    // ============================================================
    try {
      await fs.access(this.generalInfoFolder);
      const generalInfoFiles = await fs.readdir(this.generalInfoFolder);
      const pdfFiles = generalInfoFiles.filter(file => 
        file.toLowerCase().endsWith('.pdf')
      );

      if (pdfFiles.length > 0) {
        console.log(`\n📄 Found ${pdfFiles.length} General Info PDF file(s)`);
        
        const GeneralInfoExtractor = require('./general_info_extractor');
        const generalExtractor = new GeneralInfoExtractor();
        
        let generalProcessed = 0;
        let generalSkipped = 0;
        
        for (const file of pdfFiles) {
          const filePath = path.join(this.generalInfoFolder, file);
          console.log(`   Processing: ${file}`);
          
          try {
            const generalData = await generalExtractor.processGeneralInfoPDF(filePath);
            
            if (generalData) {
              const result = await this.generalInfoManager.storeGeneralInfo(generalData);
              
              if (result) {
                totalProcessed++;
                generalProcessed++;
                console.log(`   ✅ ${file}`);
              } else {
                generalSkipped++;
                console.log(`   ❌ ${file} - Failed to store`);
              }
            } else {
              generalSkipped++;
              console.log(`   ❌ ${file} - Could not extract data`);
            }
          } catch (error) {
            generalSkipped++;
            console.error(`   ❌ ${file} - Error: ${error.message}`);
          }
        }
        
        if (generalSkipped > 0) {
          console.log(`\n   ℹ️  Summary: ${generalProcessed} processed, ${generalSkipped} skipped`);
        }
      } else {
        console.log('\n📄 No general info PDF files found');
      }
    } catch (err) {
      console.log('\n📄 General Info folder not found, creating...');
      await fs.mkdir(this.generalInfoFolder, { recursive: true });
    }

    // ============================================================
    // STEP 11: Process Teaching Faculty Resume PDF Files
    // ============================================================
    try {
  // Check if folder exists, create if not
  try {
    await fs.access(this.teachingFacultyResumesFolder);
  } catch (err) {
    console.log('\n👨‍🏫 Teaching Faculty Resumes folder not found, creating...');
    await fs.mkdir(this.teachingFacultyResumesFolder, { recursive: true });
  }

  const resumeFiles = await fs.readdir(this.teachingFacultyResumesFolder);
  const pdfFiles = resumeFiles.filter(file => 
    file.toLowerCase().endsWith('.pdf')
  );

  if (pdfFiles.length > 0) {
    console.log(`\n👨‍🏫 Found ${pdfFiles.length} Teaching Faculty Resume PDF file(s)`);
    
    const TeachingFacultyResumeExtractor = require('./teaching_faculty_resume_pdf_extractor');
    const resumeExtractor = new TeachingFacultyResumeExtractor();
    
    let resumeProcessed = 0;
    let resumeSkipped = 0;
    
    for (const file of pdfFiles) {
      const filePath = path.join(this.teachingFacultyResumesFolder, file);
      console.log(`   Processing: ${file}`);
      
      try {
        const resumeData = await resumeExtractor.processTeachingFacultyResumePDF(filePath);
        
        if (resumeData) {
          const result = await this.teachingFacultyResumeManager.storeTeachingFacultyResume(resumeData);
          
          if (result) {
            totalProcessed++;
            resumeProcessed++;
            console.log(`   ✅ ${file}`);
          } else {
            resumeSkipped++;
            console.log(`   ❌ ${file} - Failed to store`);
          }
        } else {
          resumeSkipped++;
          console.log(`   ❌ ${file} - Could not extract data`);
        }
      } catch (error) {
        resumeSkipped++;
        console.error(`   ❌ ${file} - Error: ${error.message}`);
      }
    }
    
    if (resumeSkipped > 0) {
      console.log(`\n   ℹ️  Summary: ${resumeProcessed} processed, ${resumeSkipped} skipped`);
    }
  } else {
    console.log('\n👨‍🏫 No teaching faculty resume PDF files found');
  }
} catch (error) {
  console.error(`\n❌ Error processing teaching faculty resumes: ${error.message}`);
}

    // ============================================================
    // SUMMARY
    // ============================================================
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
    
    // Clear student grades
    await this.gradesManager.clearAllGrades();
    
    // Clear teaching faculty
    await this.teachingFacultyManager.clearAllTeachingFaculty();
    
    // Clear teaching faculty schedules
    await this.teachingFacultyScheduleManager.clearAllTeachingFacultySchedules();
    
    // Clear non-teaching faculty
    await this.nonTeachingFacultyManager.clearAllNonTeachingFaculty();
    
    // Clear non-teaching schedules
    await this.nonTeachingScheduleManager.clearAllNonTeachingSchedules();
    
    // Clear admin resumes
    await this.adminManager.clearAllAdmins();

    // Clear general info
    await this.generalInfoManager.clearAllGeneralInfo();

    // Clear teaching resumes
    await this.teachingFacultyResumeManager.clearAllFacultyResumes();

    // Clear curricula
    await this.curriculumManager.clearAllCurricula();
    
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

  async debugCurriculumFile() {
  console.log('\n' + '='.repeat(60));
  console.log('🔍 DEBUG CURRICULUM FILE');
  console.log('='.repeat(60));

  try {
    const files = await fs.readdir(this.curriculumExcelFolder);
    const excelFiles = files.filter(file => file.endsWith('.xlsx') || file.endsWith('.xls'));

    if (excelFiles.length === 0) {
      console.log('⚠️  No curriculum files found');
      return;
    }

    console.log('\nAvailable curriculum files:');
    excelFiles.forEach((file, index) => {
      console.log(`${index + 1}. ${file}`);
    });

    const choice = await this.prompt('\nSelect file number to debug: ');
    const fileIndex = parseInt(choice) - 1;

    if (fileIndex < 0 || fileIndex >= excelFiles.length) {
      console.log('❌ Invalid choice');
      return;
    }

    const filePath = path.join(this.curriculumExcelFolder, excelFiles[fileIndex]);
    
    const CurriculumExtractor = require('./curriculum_extractor');
    const extractor = new CurriculumExtractor();
    
    await extractor.debugCurriculumFile(filePath);

  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
  }
}


  async clearAllData() {
  try {
    const confirm = await this.prompt('⚠️  Clear ALL data (students, COR schedules, curricula, faculty schedules) from MongoDB? (yes/no): ');
    
    if (confirm.trim().toLowerCase() === 'yes') {
      console.log('\n🗑️  Clearing all data...\n');
      
      // Check if manager exists
      if (!this.nonTeachingScheduleManager) {
        console.log('⚠️  Non-teaching schedule manager not initialized!');
        return;
      }
      
      // Clear student data
      console.log('📋 Clearing student data...');
      await this.db.clearAllData();
      
      // Clear COR schedules
      console.log('📅 Clearing COR schedules...');
      await this.clearAllCORSchedules();
      
      // Clear student grades
      if (this.studentGradesManager) {
        console.log('📊 Clearing student grades...');
        await this.studentGradesManager.clearAllGrades();
      }
      
      // Clear teaching faculty
      if (this.teachingFacultyManager) {
        console.log('👨‍🏫 Clearing teaching faculty...');
        await this.teachingFacultyManager.clearAllTeachingFaculty();
      }
      
      // Clear teaching faculty schedules
      if (this.teachingFacultyScheduleManager) {
        console.log('📅 Clearing teaching faculty schedules...');
        await this.teachingFacultyScheduleManager.clearAllTeachingFacultySchedules();
      }
      
      // Clear non-teaching faculty
      if (this.nonTeachingFacultyManager) {
        console.log('👨‍💼 Clearing non-teaching faculty...');
        await this.nonTeachingFacultyManager.clearAllNonTeachingFaculty();
      }
      
      // Clear non-teaching schedules
      console.log('📅 Clearing non-teaching schedules...');
      await this.nonTeachingScheduleManager.clearAllNonTeachingSchedules();

      // Clear admins
      console.log('👔 Clearing administrators...');
      await this.adminManager.clearAllAdmins();

      // Clear general info
      console.log('📄 Clearing general information...');
      await this.generalInfoManager.clearAllGeneralInfo();

      // Clear teaching faculty resumes
      console.log('👨‍🏫 Clearing teaching faculty resumes...');
      await this.teachingFacultyResumeManager.clearAllFacultyResumes();
      
      // Clear curricula
      if (this.curriculumManager) {
        console.log('📚 Clearing curricula...');
        await this.curriculumManager.clearAllCurricula();
      }
      
      console.log('\n✅ All data cleared from MongoDB');
    } else {
      console.log('❌ Operation cancelled');
    }
  } catch (error) {
    console.error(`❌ Error clearing data: ${error.message}`);
    console.error(error.stack);
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
  const facultyStats = await this.teachingFacultyManager.getTeachingFacultyStatistics();
  const facultySchedStats = await this.teachingFacultyScheduleManager.getTeachingFacultyScheduleStatistics();
  const nonTeachingStats = await this.nonTeachingFacultyManager.getNonTeachingFacultyStatistics();
  const curriculumStats = await this.curriculumManager.getCurriculumStatistics(); 

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

  // COR statistics
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

  // Teaching faculty statistics
  if (facultyStats && facultyStats.total_faculty > 0) {
  console.log('\n👨‍🏫 TEACHING FACULTY:');
  console.log(`   Total Faculty: ${facultyStats.total_faculty}`);
  
  // ← ADD THIS: Show pending media count
  const pendingTeaching = await this.teachingFacultyManager.getTeachingPendingMedia();
  console.log(`   Pending Media: ${pendingTeaching.length}`);

  if (Object.keys(facultyStats.by_department).length > 0) {
    console.log('\n   By Department:');
    Object.entries(facultyStats.by_department).forEach(([dept, count]) => {
      console.log(`      • ${dept}: ${count} faculty`);
    });
  }

  if (Object.keys(facultyStats.by_position).length > 0) {
    console.log('\n   By Position:');
    Object.entries(facultyStats.by_position).forEach(([position, count]) => {
      console.log(`      • ${position}: ${count}`);
    });
  }
} else {
  console.log('\n👨‍🏫 TEACHING FACULTY:');
  console.log('   No teaching faculty loaded');
}

  // Teaching faculty schedule statistics
  if (facultySchedStats && facultySchedStats.total_schedules > 0) {
    console.log('\n📅 FACULTY SCHEDULES:');
    console.log(`   Total Schedules: ${facultySchedStats.total_schedules}`);
    console.log(`   Total Classes: ${facultySchedStats.total_classes}`);

    if (Object.keys(facultySchedStats.by_department).length > 0) {
      console.log('\n   By Department:');
      Object.entries(facultySchedStats.by_department).forEach(([dept, count]) => {
        console.log(`      • ${dept}: ${count} schedule(s)`);
      });
    }
  } else {
    console.log('\n📅 FACULTY SCHEDULES:');
    console.log('   No faculty schedules loaded');
  }

  // Non-teaching faculty statistics
  if (nonTeachingStats && nonTeachingStats.total_faculty > 0) {
  console.log('\n👨‍💼 NON-TEACHING FACULTY:');
  console.log(`   Total Non-Teaching Faculty: ${nonTeachingStats.total_faculty}`);
  
  // Show pending media count
  const pendingNonTeaching = await this.nonTeachingFacultyManager.getNonTeachingPendingMedia();
  console.log(`   Pending Media: ${pendingNonTeaching.length}`);

  if (Object.keys(nonTeachingStats.by_department).length > 0) {
    console.log('\n   By Department:');
    Object.entries(nonTeachingStats.by_department).forEach(([dept, count]) => {
      console.log(`      • ${dept}: ${count} staff`);
    });
  }

  if (Object.keys(nonTeachingStats.by_position).length > 0) {
    console.log('\n   By Position:');
    Object.entries(nonTeachingStats.by_position).forEach(([position, count]) => {
      console.log(`      • ${position}: ${count}`);
    });
  }
} else {
  console.log('\n👨‍💼 NON-TEACHING FACULTY:');
  console.log('   No non-teaching faculty loaded');
}

  // Curriculum statistics (add at the end)
  if (curriculumStats && curriculumStats.total_curricula > 0) {
    console.log('\n📚 CURRICULA:');
    console.log(`   Total Curricula: ${curriculumStats.total_curricula}`);
    console.log(`   Total Subjects (All Curricula): ${curriculumStats.total_subjects_all}`);

    if (Object.keys(curriculumStats.by_department).length > 0) {
      console.log('\n   By Department:');
      Object.entries(curriculumStats.by_department).forEach(([dept, count]) => {
        console.log(`      • ${dept}: ${count} curriculum(s)`);
      });
    }

    if (Object.keys(curriculumStats.by_course).length > 0) {
      console.log('\n   By Course:');
      Object.entries(curriculumStats.by_course).forEach(([course, count]) => {
        console.log(`      • ${course}: ${count} curriculum(s)`);
      });
    }

    if (Object.keys(curriculumStats.by_year).length > 0) {
      console.log('\n   By Effective Year:');
      Object.entries(curriculumStats.by_year).forEach(([year, count]) => {
        console.log(`      • ${year}: ${count} curriculum(s)`);
      });
    }
  } else {
    console.log('\n📚 CURRICULA:');
    console.log('   No curricula loaded');
  }

}

async viewCurricula() {
  console.log('\n' + '='.repeat(60));
  console.log('📚 CURRICULA');
  console.log('='.repeat(60));

  // Get statistics
  const stats = await this.curriculumManager.getCurriculumStatistics();

  if (!stats || stats.total_curricula === 0) {
    console.log('\n⚠️  No curricula found in database');
    console.log('💡 Place curriculum Excel files in uploaded_files/curriculum_excel/ and restart');
    return;
  }

  console.log(`\n📊 Curriculum Statistics:`);
  console.log(`   Total Curricula: ${stats.total_curricula}`);
  console.log(`   Total Subjects: ${stats.total_subjects_all}`);

  console.log(`\n📚 By Department:`);
  Object.entries(stats.by_department).forEach(([dept, count]) => {
    console.log(`   • ${dept}: ${count} curriculum(s)`);
  });

  console.log(`\n📖 By Course:`);
  Object.entries(stats.by_course).forEach(([course, count]) => {
    console.log(`   • ${course}: ${count} curriculum(s)`);
  });

  console.log(`\n📅 By Effective Year:`);
  Object.entries(stats.by_year).forEach(([year, count]) => {
    console.log(`   • ${year}: ${count} curriculum(s)`);
  });

  // Ask if they want to view specific curricula
  const viewDetails = await this.prompt('\nView detailed curricula? (yes/no): ');

  if (viewDetails.trim().toLowerCase() === 'yes') {
    console.log('\nFilter by:');
    console.log('1. Department');
    console.log('2. Course');
    console.log('3. View All');

    const filterChoice = await this.prompt('\nSelect (1-3): ');
    
    let curricula;

    if (filterChoice === '1') {
      // Filter by department
      console.log('\nSelect Department:');
      console.log('1. CAS - Arts & Sciences');
      console.log('2. CCS - Computer Studies');
      console.log('3. CHTM - Hospitality & Tourism');
      console.log('4. CBA - Business Administration');
      console.log('5. CTE - Teacher Education');
      console.log('6. COE - Engineering');
      console.log('7. CON - Nursing');

      const deptChoice = await this.prompt('\nSelect (1-7): ');
      
      const deptMap = {
        '1': 'CAS', '2': 'CCS', '3': 'CHTM', '4': 'CBA',
        '5': 'CTE', '6': 'COE', '7': 'CON'
      };

      const department = deptMap[deptChoice];
      if (department) {
        curricula = await this.curriculumManager.getCurriculaByDepartment(department);
      }
    } else if (filterChoice === '2') {
      // Filter by course
      const course = await this.prompt('\nEnter course code (e.g., BSCS): ');
      if (course) {
        curricula = await this.curriculumManager.getCurriculaByCourse(course.trim());
      }
    } else {
      // View all
      curricula = await this.curriculumManager.getAllCurricula();
    }

    if (!curricula || curricula.length === 0) {
      console.log('\n⚠️  No curricula found');
      return;
    }

    console.log(`\n✅ Found ${curricula.length} curriculum(s):`);
    console.log('='.repeat(60));

    curricula.forEach((curr, index) => {
      console.log(`\n${index + 1}. ${curr.program || curr.course}`);
      console.log(`   Course: ${curr.course}`);
      console.log(`   Department: ${curr.department}`);
      console.log(`   Effective Year: ${curr.effective_year || 'N/A'}`);
      console.log(`   Revision: ${curr.revision || 'N/A'}`);
      console.log(`   Total Subjects: ${curr.total_subjects}`);
      console.log(`   Source: ${curr.source_file}`);
    });

    // Option to view full curriculum
    const viewFull = await this.prompt('\nView full curriculum details? Enter number (or press Enter to skip): ');
    
    if (viewFull && parseInt(viewFull) > 0 && parseInt(viewFull) <= curricula.length) {
      const selectedCurriculum = curricula[parseInt(viewFull) - 1];
      
      console.log('\n' + '='.repeat(60));
      console.log('📋 FULL CURRICULUM DETAILS');
      console.log('='.repeat(60));
      console.log('\n' + selectedCurriculum.formatted_text);
    }
  }
}

async viewNonTeachingFaculty() {
  console.log('\n' + '='.repeat(60));
  console.log('👨‍💼 NON-TEACHING FACULTY');
  console.log('='.repeat(60));

  // Get statistics
  const stats = await this.nonTeachingFacultyManager.getNonTeachingFacultyStatistics();

  if (!stats || stats.total_faculty === 0) {
    console.log('\n⚠️  No non-teaching faculty found in database');
    console.log('💡 Place non-teaching faculty Excel files in uploaded_files/non_teaching_faculty_excel/ and restart');
    return;
  }

  console.log(`\n📊 Non-Teaching Faculty Statistics:`);
  console.log(`   Total Staff: ${stats.total_faculty}`);

  console.log(`\n📚 By Department:`);
  Object.entries(stats.by_department).forEach(([dept, count]) => {
    // Make department names more readable
    const deptDisplay = dept.replace(/_/g, ' ').split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
    console.log(`   • ${deptDisplay}: ${count} staff`);
  });

  console.log(`\n📖 By Position:`);
  Object.entries(stats.by_position).forEach(([position, count]) => {
    console.log(`   • ${position}: ${count}`);
  });

  // Ask if they want to view specific faculty
  const viewDetails = await this.prompt('\nView detailed non-teaching faculty list? (yes/no): ');

  if (viewDetails.trim().toLowerCase() === 'yes') {
    console.log('\nFilter by department:');
    console.log('1. REGISTRAR - Registrar Office');
    console.log('2. ACCOUNTING - Accounting & Finance');
    console.log('3. GUIDANCE - Guidance Office');
    console.log('4. LIBRARY - Library Services');
    console.log('5. HEALTH_SERVICES - Health Services');
    console.log('6. MAINTENANCE_CUSTODIAL - Maintenance & Custodial');
    console.log('7. SECURITY - Security Services');
    console.log('8. SYSTEM_ADMIN - IT & System Administration');
    console.log('9. ADMIN_SUPPORT - Administrative Support');
    console.log('10. All Departments');

    const deptChoice = await this.prompt('\nSelect (1-10): ');
    
    const deptMap = {
      '1': 'REGISTRAR',
      '2': 'ACCOUNTING',
      '3': 'GUIDANCE',
      '4': 'LIBRARY',
      '5': 'HEALTH_SERVICES',
      '6': 'MAINTENANCE_CUSTODIAL',
      '7': 'SECURITY',
      '8': 'SYSTEM_ADMIN',
      '9': 'ADMIN_SUPPORT',
      '10': null
    };

    const department = deptMap[deptChoice];

    let faculty;
    if (department) {
      faculty = await this.nonTeachingFacultyManager.getNonTeachingFacultyByDepartment(department);
    } else {
      faculty = await this.nonTeachingFacultyManager.getAllNonTeachingFaculty();
    }

    if (faculty.length === 0) {
      console.log('\n⚠️  No faculty found');
      return;
    }

    console.log(`\n✅ Found ${faculty.length} non-teaching staff member(s):`);
    console.log('='.repeat(60));

    faculty.forEach((fac, index) => {
  const deptDisplay = fac.department.replace(/_/g, ' ').split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
  
  console.log(`\n${index + 1}. ${fac.full_name}`);
  console.log(`   Department: ${deptDisplay}`);
  console.log(`   Position: ${fac.position || 'N/A'}`);
  console.log(`   Email: ${fac.email || 'N/A'}`);
  console.log(`   Phone: ${fac.phone || 'N/A'}`);
  console.log(`   Employment Status: ${fac.employment_status || 'N/A'}`);
  console.log(`   Completion: ${fac.completion_percentage?.toFixed(1) || '0'}%`);  // ← ADD THIS
  
  // Show media status
  const imageStatus = fac.image?.status === 'complete' ? '📸 Complete' : '📸 Waiting';
  const audioStatus = fac.audio?.status === 'complete' ? '🎤 Complete' : '🎤 Waiting';
  const descriptorStatus = fac.descriptor ? '🔑 Complete' : '🔑 Waiting';
  console.log(`   Media: ${imageStatus} | ${audioStatus} | ${descriptorStatus}`);
  
  console.log(`   Source: ${fac.source_file}`);
});

    // Option to view full details
    const viewFull = await this.prompt('\nView full details for a specific staff? Enter number (or press Enter to skip): ');
    
    if (viewFull && parseInt(viewFull) > 0 && parseInt(viewFull) <= faculty.length) {
      const selectedFaculty = faculty[parseInt(viewFull) - 1];
      
      console.log('\n' + '='.repeat(60));
      console.log('📋 FULL STAFF DETAILS');
      console.log('='.repeat(60));
      console.log('\n' + selectedFaculty.formatted_text);
    }
  }
}

async viewTeachingFacultySchedules() {
  console.log('\n' + '='.repeat(60));
  console.log('📅 TEACHING FACULTY SCHEDULES');
  console.log('='.repeat(60));

  // Get statistics
  const stats = await this.teachingFacultyScheduleManager.getTeachingFacultyScheduleStatistics();

  if (!stats || stats.total_schedules === 0) {
    console.log('\n⚠️  No teaching faculty schedules found in database');
    console.log('💡 Place faculty schedule Excel files in uploaded_files/teaching_faculty_sched_excel/ and restart');
    return;
  }

  console.log(`\n📊 Schedule Statistics:`);
  console.log(`   Total Schedules: ${stats.total_schedules}`);
  console.log(`   Total Classes: ${stats.total_classes}`);

  console.log(`\n📚 By Department:`);
  Object.entries(stats.by_department).forEach(([dept, count]) => {
    console.log(`   • ${dept}: ${count} schedule(s)`);
  });

  // Ask if they want to view specific schedules
  const viewDetails = await this.prompt('\nView detailed schedules? (yes/no): ');

  if (viewDetails.trim().toLowerCase() === 'yes') {
    console.log('\nFilter by department:');
    console.log('1. CAS - Arts & Sciences');
    console.log('2. CCS - Computer Studies');
    console.log('3. CHTM - Hospitality & Tourism');
    console.log('4. CBA - Business Administration');
    console.log('5. CTE - Teacher Education');
    console.log('6. COE - Engineering');
    console.log('7. CON - Nursing');
    console.log('8. ADMIN - Administration');
    console.log('9. All Departments');

    const deptChoice = await this.prompt('\nSelect (1-9): ');
    
    const deptMap = {
      '1': 'CAS',
      '2': 'CCS',
      '3': 'CHTM',
      '4': 'CBA',
      '5': 'CTE',
      '6': 'COE',
      '7': 'CON',
      '8': 'ADMIN',
      '9': null
    };

    const department = deptMap[deptChoice];

    let schedules;
    if (department) {
      schedules = await this.teachingFacultyScheduleManager.getTeachingFacultySchedulesByDepartment(department);
    } else {
      schedules = await this.teachingFacultyScheduleManager.getAllTeachingFacultySchedules();
    }

    if (schedules.length === 0) {
      console.log('\n⚠️  No schedules found');
      return;
    }

    console.log(`\n✅ Found ${schedules.length} schedule(s):`);
    console.log('='.repeat(60));

    schedules.forEach((sched, index) => {
      console.log(`\n${index + 1}. ${sched.adviser_name}`);
      console.log(`   Department: ${sched.department}`);
      console.log(`   Total Classes: ${sched.total_subjects}`);
      console.log(`   Days Teaching: ${sched.days_teaching}`);
      console.log(`   Source: ${sched.source_file}`);
    });

    // Option to view full schedule
    const viewFull = await this.prompt('\nView full schedule for a specific faculty? Enter number (or press Enter to skip): ');
    
    if (viewFull && parseInt(viewFull) > 0 && parseInt(viewFull) <= schedules.length) {
      const selectedSchedule = schedules[parseInt(viewFull) - 1];
      
      console.log('\n' + '='.repeat(60));
      console.log('📋 FULL FACULTY SCHEDULE');
      console.log('='.repeat(60));
      console.log('\n' + selectedSchedule.formatted_text);
    }
  }
}

  async viewTeachingFaculty() {
  console.log('\n' + '='.repeat(60));
  console.log('👨‍🏫 TEACHING FACULTY');
  console.log('='.repeat(60));

  // Get statistics
  const stats = await this.teachingFacultyManager.getTeachingFacultyStatistics();

  if (!stats || stats.total_faculty === 0) {
    console.log('\n⚠️  No teaching faculty found in database');
    console.log('💡 Place teaching faculty Excel files in uploaded_files/teaching_faculty_excel/ and restart');
    return;
  }

  console.log(`\n📊 Faculty Statistics:`);
  console.log(`   Total Faculty: ${stats.total_faculty}`);

  console.log(`\n📚 By Department:`);
  Object.entries(stats.by_department).forEach(([dept, count]) => {
    console.log(`   • ${dept}: ${count} faculty`);
  });

  console.log(`\n📖 By Position:`);
  Object.entries(stats.by_position).forEach(([position, count]) => {
    console.log(`   • ${position}: ${count}`);
  });

  // Ask if they want to view specific faculty
  const viewDetails = await this.prompt('\nView detailed faculty list? (yes/no): ');

  if (viewDetails.trim().toLowerCase() === 'yes') {
    console.log('\nFilter by department:');
    console.log('1. CAS - Arts & Sciences');
    console.log('2. CCS - Computer Studies');
    console.log('3. CHTM - Hospitality & Tourism');
    console.log('4. CBA - Business Administration');
    console.log('5. CTE - Teacher Education');
    console.log('6. COE - Engineering');
    console.log('7. CON - Nursing');
    console.log('8. ADMIN - Administration');
    console.log('9. All Departments');

    const deptChoice = await this.prompt('\nSelect (1-9): ');
    
    const deptMap = {
      '1': 'CAS',
      '2': 'CCS',
      '3': 'CHTM',
      '4': 'CBA',
      '5': 'CTE',
      '6': 'COE',
      '7': 'CON',
      '8': 'ADMIN',
      '9': null
    };

    const department = deptMap[deptChoice];

    let faculty;
    if (department) {
      faculty = await this.teachingFacultyManager.getTeachingFacultyByDepartment(department);
    } else {
      faculty = await this.teachingFacultyManager.getAllTeachingFaculty();
    }

    if (faculty.length === 0) {
      console.log('\n⚠️  No faculty found');
      return;
    }

    console.log(`\n✅ Found ${faculty.length} faculty member(s):`);
    console.log('='.repeat(60));

    faculty.forEach((fac, index) => {
  console.log(`\n${index + 1}. ${fac.full_name}`);
  console.log(`   Department: ${fac.department}`);
  console.log(`   Position: ${fac.position || 'N/A'}`);
  console.log(`   Email: ${fac.email || 'N/A'}`);
  console.log(`   Phone: ${fac.phone || 'N/A'}`);
  console.log(`   Employment Status: ${fac.employment_status || 'N/A'}`);
  console.log(`   Completion: ${fac.completion_percentage?.toFixed(1) || '0'}%`);  // ← ADD THIS
  
  // Show media status
  const imageStatus = fac.image?.status === 'complete' ? '📸 Complete' : '📸 Waiting';
  const audioStatus = fac.audio?.status === 'complete' ? '🎤 Complete' : '🎤 Waiting';
  const descriptorStatus = fac.descriptor ? '🔑 Complete' : '🔑 Waiting';
  console.log(`   Media: ${imageStatus} | ${audioStatus} | ${descriptorStatus}`);
  
  console.log(`   Source: ${fac.source_file}`);
});

    // Option to view full details
    const viewFull = await this.prompt('\nView full details for a specific faculty? Enter number (or press Enter to skip): ');
    
    if (viewFull && parseInt(viewFull) > 0 && parseInt(viewFull) <= faculty.length) {
      const selectedFaculty = faculty[parseInt(viewFull) - 1];
      
      console.log('\n' + '='.repeat(60));
      console.log('📋 FULL FACULTY DETAILS');
      console.log('='.repeat(60));
      console.log('\n' + selectedFaculty.formatted_text);
    }
  }
}

  async showPendingMedia() {
  // Get student pending media
  const pendingStudents = await this.db.getPendingMediaStudents();
  
  // Get teaching faculty pending media
  const pendingTeaching = await this.teachingFacultyManager.getTeachingPendingMedia();
  
  // Get non-teaching faculty pending media
  const pendingNonTeaching = await this.nonTeachingFacultyManager.getNonTeachingPendingMedia();

  const totalPending = pendingStudents.length + pendingTeaching.length + pendingNonTeaching.length;

  if (totalPending === 0) {
    console.log('\n✅ No one waiting for media!');
    return;
  }

  console.log('\n' + '='.repeat(60));
  console.log(`⏳ PENDING MEDIA (${totalPending} total)`);
  console.log('='.repeat(60));

  // Show Students
  if (pendingStudents.length > 0) {
    console.log(`\n👥 STUDENTS (${pendingStudents.length}):`);
    pendingStudents.slice(0, 10).forEach((student, index) => {
      console.log(`\n${index + 1}. ${student.full_name || 'N/A'} (${student.student_id})`);
      console.log(`   Course: ${student.course} | Year: ${student.year} | Section: ${student.section}`);

      const waiting = [];
      if (student.waiting_for.image) waiting.push('📸 Image');
      if (student.waiting_for.audio) waiting.push('🎤 Audio');

      console.log(`   Waiting for: ${waiting.join(', ')}`);
    });

    if (pendingStudents.length > 10) {
      console.log(`\n   ... and ${pendingStudents.length - 10} more students`);
    }
  }

  // ← ADD THIS: Show Teaching Faculty
  if (pendingTeaching.length > 0) {
    console.log(`\n\n👨‍🏫 TEACHING FACULTY (${pendingTeaching.length}):`);
    pendingTeaching.slice(0, 10).forEach((faculty, index) => {
      console.log(`\n${index + 1}. ${faculty.full_name || 'N/A'} (${faculty.faculty_id})`);
      console.log(`   Position: ${faculty.position} | Department: ${faculty.department}`);

      const waiting = [];
      if (faculty.waiting_for.image) waiting.push('📸 Image');
      if (faculty.waiting_for.audio) waiting.push('🎤 Audio');
      if (faculty.waiting_for.descriptor) waiting.push('🔑 Descriptor');

      console.log(`   Waiting for: ${waiting.join(', ')}`);
    });

    if (pendingTeaching.length > 10) {
      console.log(`\n   ... and ${pendingTeaching.length - 10} more teaching faculty`);
    }
  }

  // Show Non-Teaching Faculty
  if (pendingNonTeaching.length > 0) {
    console.log(`\n\n👨‍💼 NON-TEACHING FACULTY (${pendingNonTeaching.length}):`);
    pendingNonTeaching.slice(0, 10).forEach((faculty, index) => {
      const deptDisplay = faculty.department.replace(/_/g, ' ').split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');

      console.log(`\n${index + 1}. ${faculty.full_name || 'N/A'} (${faculty.faculty_id})`);
      console.log(`   Position: ${faculty.position} | Department: ${deptDisplay}`);

      const waiting = [];
      if (faculty.waiting_for.image) waiting.push('📸 Image');
      if (faculty.waiting_for.audio) waiting.push('🎤 Audio');
      if (faculty.waiting_for.descriptor) waiting.push('🔑 Descriptor');

      console.log(`   Waiting for: ${waiting.join(', ')}`);
    });

    if (pendingNonTeaching.length > 10) {
      console.log(`\n   ... and ${pendingNonTeaching.length - 10} more non-teaching faculty`);
    }
  }
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
      console.log(`\n${selectedSchedule.course} - Year ${selectedSchedule.year} - Section ${selectedSchedule.section}`);
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
    console.log(`Current Year: "${schedule.year}"`);
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
        schedule.year = correctYear;
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
      schedule.schedule_id = `COR_${correctDept}_${courseCode}_Y${schedule.year}_${schedule.section}_${Date.now()}`;
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

async viewNonTeachingSchedules() {
  console.log('\n' + '='.repeat(60));
  console.log('📅 NON-TEACHING FACULTY SCHEDULES');
  console.log('='.repeat(60));

  try {
    const allSchedules = await this.nonTeachingScheduleManager.getAllNonTeachingSchedules();

    if (allSchedules.length === 0) {
      console.log('\nNo non-teaching faculty schedules found in the database.');
      return;
    }

    console.log(`\nTotal: ${allSchedules.length} non-teaching schedule(s)\n`);

    const byDepartment = {};
    allSchedules.forEach(schedule => {
      const dept = schedule.department || 'UNKNOWN';
      if (!byDepartment[dept]) byDepartment[dept] = [];
      byDepartment[dept].push(schedule);
    });

    for (const [dept, schedules] of Object.entries(byDepartment).sort()) {
      console.log(`\n📂 ${dept} (${schedules.length} schedule(s)):`);
      console.log('-'.repeat(60));

      schedules.forEach((schedule, index) => {
        console.log(`\n  ${index + 1}. ${schedule.staff_name}`);
        console.log(`     Position: ${schedule.position || 'N/A'}`);
        console.log(`     Department: ${schedule.department}`);
        console.log(`     Total Shifts: ${schedule.total_shifts}`);
        console.log(`     Days Working: ${schedule.days_working}`);
        console.log(`     Schedule ID: ${schedule.schedule_id}`);
        
        if (schedule.schedule_by_day) {
          const days = Object.keys(schedule.schedule_by_day);
          if (days.length > 0) {
            console.log(`     Working Days: ${days.join(', ')}`);
          }
        }
      });
    }

    const stats = await this.nonTeachingScheduleManager.getNonTeachingScheduleStatistics();
    if (stats) {
      console.log('\n' + '='.repeat(60));
      console.log('📊 STATISTICS:');
      console.log(`   Total Schedules: ${stats.total_schedules}`);
      console.log(`   Total Staff: ${stats.total_staff}`);
      console.log(`   Total Shifts: ${stats.total_shifts_all}`);
      
      if (Object.keys(stats.by_day).length > 0) {
        console.log('\n   Staff per day:');
        Object.entries(stats.by_day).sort().forEach(([day, count]) => {
          console.log(`     ${day}: ${count} staff`);
        });
      }
    }
  } catch (error) {
    console.error(`❌ Error viewing non-teaching schedules: ${error.message}`);
  }
}

async debugCollections() {
  console.log('\n🔍 DEBUG: Listing ALL collections in database\n');
  try {
    const database = this.db.db || this.db.client.db();
    const collections = await database.listCollections().toArray();
    
    console.log(`Total collections: ${collections.length}\n`);
    
    collections.forEach((col, index) => {
      console.log(`${index + 1}. ${col.name}`);
    });
    
    console.log('\n📅 Non-teaching schedule collections:');
    const scheduleCollections = collections.filter(c => c.name.startsWith('non_teaching_schedule_'));
    
    if (scheduleCollections.length === 0) {
      console.log('   ❌ NONE FOUND!');
    } else {
      scheduleCollections.forEach(col => {
        console.log(`   ✅ ${col.name}`);
      });
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

  async viewAdministrators() {
  console.log('\n' + '='.repeat(60));
  console.log('👔 ADMINISTRATIVE STAFF');
  console.log('='.repeat(60));

  try {
    const allAdmins = await this.adminManager.getAllAdmins();

    if (allAdmins.length === 0) {
      console.log('\nNo administrators found in the database.');
      return;
    }

    console.log(`\nTotal: ${allAdmins.length} administrator(s)\n`);

    // Group by admin type
    const byType = {};
    allAdmins.forEach(admin => {
      const type = admin.admin_type || 'Unknown';
      if (!byType[type]) {
        byType[type] = [];
      }
      byType[type].push(admin);
    });

    // Display grouped by type
    for (const [type, admins] of Object.entries(byType).sort()) {
      console.log(`\n📂 ${type} (${admins.length} person(s)):`);
      console.log('-'.repeat(60));

      admins.forEach((admin, index) => {
        console.log(`\n  ${index + 1}. ${admin.full_name}`);
        console.log(`     Position: ${admin.position || 'N/A'}`);
        console.log(`     Department: ${admin.department}`);
        console.log(`     Employment Status: ${admin.employment_status || 'N/A'}`);
        console.log(`     Email: ${admin.email || 'N/A'}`);
        console.log(`     Phone: ${admin.phone || 'N/A'}`);
        console.log(`     Admin ID: ${admin.admin_id}`);
      });
    }

    // Show statistics
    const stats = await this.adminManager.getAdminStatistics();
    if (stats) {
      console.log('\n' + '='.repeat(60));
      console.log('📊 STATISTICS:');
      console.log(`   Total Administrators: ${stats.total_admins}`);
      
      if (Object.keys(stats.by_type).length > 0) {
        console.log('\n   By Type:');
        Object.entries(stats.by_type).sort().forEach(([type, count]) => {
          console.log(`     ${type}: ${count}`);
        });
      }
      
      if (Object.keys(stats.by_employment_status).length > 0) {
        console.log('\n   By Employment Status:');
        Object.entries(stats.by_employment_status).sort().forEach(([status, count]) => {
          console.log(`     ${status}: ${count}`);
        });
      }
    }

  } catch (error) {
    console.error(`❌ Error viewing administrators: ${error.message}`);
  }
}

async viewGeneralInformation() {
  console.log('\n' + '='.repeat(60));
  console.log('📄 GENERAL INFORMATION');
  console.log('='.repeat(60));

  try {
    const allInfo = await this.generalInfoManager.getAllGeneralInfo();

    if (allInfo.length === 0) {
      console.log('\nNo general information found in the database.');
      return;
    }

    console.log(`\nTotal: ${allInfo.length} document(s)\n`);

    // Display each document
    for (const info of allInfo) {
      console.log('='.repeat(60));
      console.log(`📋 ${info.info_type.toUpperCase().replace(/_/g, ' ')}`);
      console.log('='.repeat(60));
      
      if (info.info_type === 'mission_vision') {
        if (info.content.vision) {
          console.log('\n🎯 VISION:');
          console.log(this.wrapText(info.content.vision, 70));
        }
        if (info.content.mission) {
          console.log('\n🎯 MISSION:');
          console.log(this.wrapText(info.content.mission, 70));
        }
        
      } else if (info.info_type === 'objectives') {
        console.log('\n🎯 OBJECTIVES:');
        info.content.objectives.forEach((obj, index) => {
          console.log(`\n${index + 1}. ${this.wrapText(obj, 67)}`);
        });
        
      } else if (info.info_type === 'history') {
        console.log('\n📖 HISTORY:');
        console.log(this.wrapText(info.content.history, 70));
        
      } else if (info.info_type === 'core_values') {
        console.log('\n💎 CORE VALUES:');
        info.content.core_values.forEach((value, index) => {
          console.log(`${index + 1}. ${value}`);
        });
        
      } else if (info.info_type === 'hymn') {
        console.log('\n🎵 HYMN:');
        console.log(info.content.hymn);
      }
      
      console.log(`\n📁 Source: ${info.source_file}`);
      console.log(`📊 Characters: ${info.character_count}`);
      console.log('');
    }

    // Show statistics
    const stats = await this.generalInfoManager.getGeneralInfoStatistics();
    if (stats) {
      console.log('='.repeat(60));
      console.log('📊 STATISTICS:');
      console.log(`   Total Documents: ${stats.total_documents}`);
      console.log(`   Total Characters: ${stats.total_characters}`);
      
      if (Object.keys(stats.by_type).length > 0) {
        console.log('\n   By Type:');
        Object.entries(stats.by_type).sort().forEach(([type, count]) => {
          console.log(`     ${type.replace(/_/g, ' ')}: ${count}`);
        });
      }
    }

  } catch (error) {
    console.error(`❌ Error viewing general information: ${error.message}`);
  }
}

// Helper function for text wrapping
wrapText(text, maxWidth) {
  const words = text.split(' ');
  const lines = [];
  let currentLine = '';
  
  for (const word of words) {
    if ((currentLine + word).length <= maxWidth) {
      currentLine += (currentLine ? ' ' : '') + word;
    } else {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
    }
  }
  
  if (currentLine) lines.push(currentLine);
  
  return lines.join('\n   ');
}

  async viewTeachingFacultyResumes() {
  console.log('\n' + '='.repeat(60));
  console.log('👨‍🏫 TEACHING FACULTY RESUMES');
  console.log('='.repeat(60));

  try {
    const allFaculty = await this.teachingFacultyResumeManager.getAllTeachingFacultyResumes();

    if (allFaculty.length === 0) {
      console.log('\nNo teaching faculty resumes found in the database.');
      return;
    }

    console.log(`\nTotal: ${allFaculty.length} faculty member(s)\n`);

    // Group by department
    const byDept = {};
    allFaculty.forEach(faculty => {
      const dept = faculty.department || 'UNKNOWN';
      if (!byDept[dept]) {
        byDept[dept] = [];
      }
      byDept[dept].push(faculty);
    });

    // Display grouped by department
    for (const [dept, faculty] of Object.entries(byDept).sort()) {
      console.log(`\n📂 ${dept} (${faculty.length} person(s)):`);
      console.log('-'.repeat(60));

      faculty.forEach((f, index) => {
        console.log(`\n  ${index + 1}. ${f.full_name}`);
        console.log(`     Position: ${f.position || 'N/A'}`);
        console.log(`     Department: ${f.department}`);
        console.log(`     Email: ${f.email || 'N/A'}`);
        console.log(`     Phone: ${f.phone || 'N/A'}`);
        console.log(`     📸 Has Photo: ${f.has_photo ? 'Yes' : 'No'}`);
        console.log(`     Faculty ID: ${f.faculty_id}`);
      });
    }

    // Show statistics
    const stats = await this.teachingFacultyResumeManager.getStatistics();
    if (stats) {
      console.log('\n' + '='.repeat(60));
      console.log('📊 STATISTICS:');
      console.log(`   Total Faculty: ${stats.total_faculty}`);
      console.log(`   With Photos: ${stats.with_photos}`);
      console.log(`   Without Photos: ${stats.without_photos}`);
      
      if (Object.keys(stats.by_department).length > 0) {
        console.log('\n   By Department:');
        Object.entries(stats.by_department).sort().forEach(([dept, count]) => {
          console.log(`     ${dept}: ${count}`);
        });
      }
      
      if (Object.keys(stats.by_position).length > 0) {
        console.log('\n   By Position:');
        Object.entries(stats.by_position).sort().forEach(([pos, count]) => {
          console.log(`     ${pos}: ${count}`);
        });
      }
    }

  } catch (error) {
    console.error(`❌ Error viewing faculty resumes: ${error.message}`);
  }
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
    console.log('9. View Teaching Faculty');
    console.log('10. View Teaching Faculty Schedules');
    console.log('11. View Non-Teaching Faculty');
    console.log('12. View Curricula');
    console.log('13. Debug Curriculum File');
    console.log('14. View Non-Teaching Schedules');
    console.log('15. View Administrators');
    console.log('16. View General Information');
    console.log('17. View Teaching Faculty Resumes'); 
    console.log('18. Clear All Data (Manual)');
    console.log('19. Cleanup Orphaned Collections');
    console.log('20. Query Assistant');
    console.log('21. Exit'); 

    const choice = (await this.prompt('\nSelect option (1-21): ')).trim();  

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
      } else if (choice === '8') {
        await this.fixExistingCORDepartments();
      } else if (choice === '9') {
        await this.viewTeachingFaculty();
      } else if (choice === '10') {
        await this.viewTeachingFacultySchedules();
      } else if (choice === '11') {
        await this.viewNonTeachingFaculty();
      } else if (choice === '12') {
        await this.viewCurricula();
      } else if (choice === '13') {
        await this.debugCurriculumFile();
      } else if (choice === '14') {
        await this.viewNonTeachingSchedules();
      } else if (choice === '15') {
        await this.viewAdministrators();
      } else if (choice === '16') {
        await this.viewGeneralInformation();  
      } 
      else if (choice === '17') {
      await this.viewTeachingFacultyResumes();}
      else if (choice === '18') {
        await this.clearAllData();
      } else if (choice === '19') {
        await this.cleanupOrphanedCollections();
      } else if (choice === '20') {
        await this.runQueryAssistant();
      } else if (choice === '21') {  
        console.log('\n👋 Exiting...');
        break;
      } else {
        console.log('\n❌ Invalid option. Please select 1-20');  
      }

      if (choice !== '19') {
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
    
    // Initialize managers after DB connection
    this.corManager = new CORScheduleManager(this.db);
    this.gradesManager = new StudentGradesManager(this.db);
    this.teachingFacultyManager = new TeachingFacultyManager(this.db);
    this.teachingFacultyScheduleManager = new TeachingFacultyScheduleManager(this.db);
    this.nonTeachingFacultyManager = new NonTeachingFacultyManager(this.db);
    this.nonTeachingScheduleManager = new NonTeachingScheduleManager(this.db);
    this.adminManager = new AdminManager(this.db);
    this.generalInfoManager = new GeneralInfoManager(this.db);
    this.teachingFacultyResumeManager = new TeachingFacultyResumeManager(this.db);
    this.curriculumManager = new CurriculumManager(this.db);  
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