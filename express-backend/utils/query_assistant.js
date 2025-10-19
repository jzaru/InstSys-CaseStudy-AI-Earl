// query_assistant.js
class QueryAssistant {
  constructor(db, corManager, gradesManager) {
    this.db = db;
    this.corManager = corManager;
    this.gradesManager = gradesManager;
  }

  /**
   * Main query processor - interprets natural language queries
   */
  async processQuery(query) {
    const queryLower = query.toLowerCase().trim();

    console.log('\n🤖 Processing query:', query);
    console.log('─'.repeat(60));

    try {
      // Student queries
      if (this.isStudentQuery(queryLower)) {
        return await this.handleStudentQuery(queryLower);
      }
      
      // Grades queries
      if (this.isGradesQuery(queryLower)) {
        return await this.handleGradesQuery(queryLower);
      }
      
      // Schedule/COR queries
      if (this.isScheduleQuery(queryLower)) {
        return await this.handleScheduleQuery(queryLower);
      }
      
      // Statistics queries
      if (this.isStatisticsQuery(queryLower)) {
        return await this.handleStatisticsQuery(queryLower);
      }
      
      // Department queries
      if (this.isDepartmentQuery(queryLower)) {
        return await this.handleDepartmentQuery(queryLower);
      }

      // Count queries
      if (this.isCountQuery(queryLower)) {
        return await this.handleCountQuery(queryLower);
      }

      // Search queries
      if (this.isSearchQuery(queryLower)) {
        return await this.handleSearchQuery(queryLower, query);
      }

      // Default: Provide help
      return this.showQueryHelp();

    } catch (error) {
      console.error('❌ Error processing query:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Query type detection
   */
  isStudentQuery(query) {
    const keywords = ['student', 'students', 'enrolled', 'who is', 'find student'];
    return keywords.some(kw => query.includes(kw));
  }

  isGradesQuery(query) {
    const keywords = ['grade', 'grades', 'gwa', 'score', 'marks', 'passed', 'failed'];
    return keywords.some(kw => query.includes(kw));
  }

  isScheduleQuery(query) {
    const keywords = ['schedule', 'cor', 'class', 'subject', 'subjects enrolled'];
    return keywords.some(kw => query.includes(kw));
  }

  isStatisticsQuery(query) {
    const keywords = ['statistics', 'stats', 'summary', 'overview', 'total'];
    return keywords.some(kw => query.includes(kw));
  }

  isDepartmentQuery(query) {
    const keywords = ['department', 'ccs', 'chtm', 'cba', 'cte', 'college'];
    return keywords.some(kw => query.includes(kw));
  }

  isCountQuery(query) {
    const keywords = ['how many', 'count', 'number of'];
    return keywords.some(kw => query.includes(kw));
  }

  isSearchQuery(query) {
    const keywords = ['find', 'search', 'look for', 'show me', 'list'];
    return keywords.some(kw => query.includes(kw));
  }

  /**
   * Query handlers
   */
  async handleStudentQuery(query) {
    // Extract student ID if present
    const idMatch = query.match(/pdm[-\s]?\d{4}[-\s]?\d{6}/i);
    
    if (idMatch) {
      const studentId = idMatch[0].toUpperCase().replace(/\s/g, '');
      const student = await this.db.getStudentById(studentId);
      
      if (student) {
        return this.formatStudentResult(student);
      } else {
        return { success: false, message: `Student ${studentId} not found` };
      }
    }

    // Count students query
    if (query.includes('how many')) {
      const stats = await this.db.getStatistics();
      return {
        success: true,
        message: `Total Students: ${stats.total_students}`,
        data: stats
      };
    }

    return { success: false, message: 'Please provide a student ID or be more specific' };
  }

  async handleGradesQuery(query) {
    // Extract student ID
    const idMatch = query.match(/pdm[-\s]?\d{4}[-\s]?\d{6}/i);
    
    if (idMatch) {
      const studentId = idMatch[0].toUpperCase().replace(/\s/g, '');
      const grades = await this.gradesManager.getStudentGrades(studentId);
      
      if (grades) {
        return this.formatGradesResult(grades);
      } else {
        return { success: false, message: `No grades found for ${studentId}` };
      }
    }

    // How many students have grades
    if (query.includes('how many')) {
      const departments = ['ccs', 'chtm', 'cba', 'cte', 'unknown'];
      let total = 0;

      for (const dept of departments) {
        try {
          const collection = this.db.db.collection(`grades_${dept}`);
          const count = await collection.countDocuments({ data_type: 'student_grades' });
          total += count;
        } catch {
          continue;
        }
      }

      return {
        success: true,
        message: `${total} students have grades in the database`
      };
    }

    return { success: false, message: 'Please provide a student ID for grades query' };
  }

  async handleScheduleQuery(query) {
  // Extract course and section
  const courseMatch = query.match(/\b(bscs|bsit|bshm|bstm|bsba|bsoa)\b/i);
  const sectionMatch = query.match(/section\s*([a-z])/i);
  const yearMatch = query.match(/year\s*([1-4])|([1-4])\s*year/i);

  if (courseMatch) {
    const filters = {
      course: courseMatch[0].toUpperCase()
    };

    if (yearMatch) {
      filters.year = yearMatch[1] || yearMatch[2];  // ← CHANGED from year_level
    }

    if (sectionMatch) {
      filters.section = sectionMatch[1].toUpperCase();
    }

    const schedules = await this.corManager.getCORSchedules(filters);

    if (schedules.length > 0) {
      return this.formatScheduleResult(schedules);
    } else {
      return { success: false, message: 'No schedules found matching criteria' };
    }
  }

    // Total schedules
    if (query.includes('how many')) {
      const stats = await this.corManager.getCORStatistics();
      return {
        success: true,
        message: `Total Schedules: ${stats.total_schedules}`,
        data: stats
      };
    }

    return { success: false, message: 'Please specify course (e.g., BSCS) or section' };
  }

  async handleStatisticsQuery(query) {
    const stats = await this.db.getStatistics();
    const corStats = await this.corManager.getCORStatistics();

    return {
      success: true,
      message: '📊 System Statistics',
      data: {
        students: stats,
        schedules: corStats
      }
    };
  }

  async handleDepartmentQuery(query) {
    // Extract department
    const deptMatch = query.match(/\b(ccs|chtm|cba|cte)\b/i);

    if (deptMatch) {
      const dept = deptMatch[0].toUpperCase();
      const students = await this.db.getStudentsByDepartment(dept);

      return {
        success: true,
        message: `${dept} has ${students.length} students`,
        data: students
      };
    }

    // All departments
    const stats = await this.db.getStatistics();
    return {
      success: true,
      message: 'Department breakdown',
      data: stats.by_department
    };
  }

  async handleCountQuery(query) {
    // Students
    if (query.includes('student')) {
      const stats = await this.db.getStatistics();
      return {
        success: true,
        message: `Total students: ${stats.total_students}`
      };
    }

    // Schedules
    if (query.includes('schedule') || query.includes('cor')) {
      const stats = await this.corManager.getCORStatistics();
      return {
        success: true,
        message: `Total schedules: ${stats.total_schedules}`
      };
    }

    // Grades
    if (query.includes('grade')) {
      const departments = ['ccs', 'chtm', 'cba', 'cte', 'unknown'];
      let total = 0;

      for (const dept of departments) {
        try {
          const collection = this.db.db.collection(`grades_${dept}`);
          total += await collection.countDocuments({ data_type: 'student_grades' });
        } catch {
          continue;
        }
      }

      return {
        success: true,
        message: `${total} students have grades`
      };
    }

    return { success: false, message: 'Please specify what to count' };
  }

  async handleSearchQuery(query, originalQuery) {
    // Extract search term (after find/search/show)
    const searchTerms = originalQuery.replace(/find|search|show me|list|for/gi, '').trim();

    if (!searchTerms) {
      return { success: false, message: 'Please provide a search term' };
    }

    const results = await this.db.searchStudents(searchTerms, null);

    if (results.length > 0) {
      return {
        success: true,
        message: `Found ${results.length} student(s)`,
        data: results.slice(0, 10) // Limit to 10
      };
    } else {
      return { success: false, message: 'No students found' };
    }
  }

  /**
   * Result formatters
   */
  formatStudentResult(student) {
    return {
      success: true,
      message: 'Student found',
      formatted: `
👤 ${student.full_name || 'N/A'}
🆔 ID: ${student.student_id}
🎓 Course: ${student.course} | Year: ${student.year} | Section: ${student.section}
🏛️  Department: ${student.department}
📊 Completion: ${student.completion_percentage.toFixed(1)}%
📸 Image: ${student.image?.status || 'N/A'}
🎤 Audio: ${student.audio?.status || 'N/A'}
      `.trim()
    };
  }

  formatGradesResult(grades) {
    let formatted = `
📊 Grades for ${grades.full_name || grades.student_name}
🆔 ID: ${grades.student_id}
📈 GWA: ${grades.gwa || 'N/A'}
📚 Subjects: ${grades.total_subjects}

Subjects:`;

    grades.grades.slice(0, 5).forEach((grade, i) => {
      formatted += `\n  ${i + 1}. ${grade.subject_code} - ${grade.equivalent} (${grade.remarks})`;
    });

    if (grades.grades.length > 5) {
      formatted += `\n  ... and ${grades.grades.length - 5} more`;
    }

    return {
      success: true,
      message: 'Grades found',
      formatted: formatted.trim()
    };
  }

  formatScheduleResult(schedules) {
  let formatted = `📚 Found ${schedules.length} schedule(s):\n`;

  schedules.forEach((schedule, i) => {
    formatted += `\n${i + 1}. ${schedule.course} Year ${schedule.year} Section ${schedule.section}`;  // ← CHANGED
    formatted += `\n   Adviser: ${schedule.adviser || 'N/A'}`;
    formatted += `\n   Subjects: ${schedule.subject_count} | Units: ${schedule.total_units}`;
  });

  return {
    success: true,
    message: 'Schedules found',
    formatted: formatted.trim()
  };
}

  showQueryHelp() {
    return {
      success: true,
      message: `
🤖 Query Assistant - Example Questions:

📚 Students:
  • "How many students?"
  • "Find student PDM-2023-001"
  • "Search for Juan"
  • "Show me students in CCS"

📊 Grades:
  • "Show grades for PDM-2023-001"
  • "How many students have grades?"
  • "What is the GWA of PDM-2023-001?"

📅 Schedules:
  • "Show schedule for BSCS year 3 section A"
  • "How many COR schedules?"
  • "List BSIT schedules"

📈 Statistics:
  • "Show statistics"
  • "Department breakdown"
  • "System overview"

🔍 General:
  • "Count students in CHTM"
  • "Find all BSHM students"
      `.trim()
    };
  }
}

module.exports = QueryAssistant;