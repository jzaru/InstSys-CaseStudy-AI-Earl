// cor_excel_extractor.js
const xlsx = require('xlsx');
const path = require('path');
const fs = require('fs').promises;

class CORExcelExtractor {
  constructor() {
    // Department mapping
    this.knownCourses = {
      'CCS': ['BSCS', 'BSIT'],
      'CHTM': ['BSHM', 'BSTM'],
      'CBA': ['BSBA', 'BSOA'],
      'CTE': ['BECED', 'BTLE'],
      'COE': ['BSEE', 'BSCE', 'BSME'],
      'CON': ['BSN'],
      'CAS': ['AB', 'BS']
    };
  }

  /**
   * Main extraction method - Universal COR extraction
   */
  async extractCORExcelInfoSmart(filename) {
    try {
      // Read the entire Excel file without headers
      const workbook = xlsx.readFile(filename);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      
      // Convert to 2D array (no header row)
      const data = xlsx.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
      
      console.log(`📋 COR Excel dimensions: ${data.length} rows x ${data[0]?.length || 0} cols`);
      
      // Universal extraction - scan entire sheet
      const corInfo = this.extractCORUniversalScan(data, filename);
      
      if (corInfo && corInfo.program_info.Program) {
        console.log('✅ Universal COR extraction successful');
        return corInfo;
      }
      
      console.log('❌ Could not extract COR data from any format');
      return null;
      
    } catch (error) {
      console.error(`❌ Error in universal COR extraction: ${error.message}`);
      return null;
    }
  }

  /**
   * Universal scanner that finds COR data regardless of format
   */
  extractCORUniversalScan(data, filename) {
    try {
      let programInfo = { Program: '', 'Year Level': '', Section: '', Adviser: '' };
      let scheduleData = [];
      let totalUnits = null;
      
      // STEP 1: Universal Program Info Extraction
      programInfo = this.scanForProgramInfo(data, filename);
      console.log('📋 Extracted Program Info:', programInfo);
      
      // STEP 2: Universal Schedule Extraction
      scheduleData = this.scanForScheduleData(data);
      console.log(`📋 Found ${scheduleData.length} subjects`);
      
      // STEP 3: Universal Total Units Extraction
      totalUnits = this.scanForTotalUnits(data);
      console.log(`📋 Total Units: ${totalUnits}`);
      
      return {
        program_info: programInfo,
        schedule: scheduleData,
        total_units: totalUnits
      };
      
    } catch (error) {
      console.error(`⚠️ Universal scan failed: ${error.message}`);
      return null;
    }
  }

  /**
   * Scan entire sheet for program information
   */
  scanForProgramInfo(data, filename) {
    const programInfo = { Program: '', 'Year Level': '', Section: '', Term: '', Adviser: '' };
    
    console.log('\n🔍 Scanning COR Excel for program info...');
    
    // Scan every cell in the sheet (first 30 rows, 15 columns)
    const maxRows = Math.min(data.length, 30);
    const maxCols = 15;
    
    for (let i = 0; i < maxRows; i++) {
      const row = data[i] || [];
      for (let j = 0; j < Math.min(row.length, maxCols); j++) {
        const cellValue = String(row[j] || '').trim();
        if (!cellValue) continue;
        
        const cellUpper = cellValue.toUpperCase();
        
        // Check if this cell is a label (contains colon or equals)
        const isLabel = cellUpper.includes(':') || cellUpper.includes('=');
        
        // PROGRAM detection
        if (!programInfo.Program && (cellUpper.includes('PROGRAM') || cellUpper.includes('COURSE'))) {
          console.log(`   Found label at (${i},${j}): "${cellValue}"`);
          
          // Try to get value from same cell (after colon)
          const match = cellValue.match(/(?:PROGRAM|COURSE)\s*[:=]?\s*(.+)/i);
          if (match && match[1].trim()) {
            const value = match[1].trim();
            const cleaned = this.cleanProgramInfoValue(value, 'Program');
            if (cleaned) {
              programInfo.Program = cleaned;
              console.log(`   ✅ Found Program (same cell): ${cleaned}`);
              continue;
            }
          }
          
          // Try next cell (right)
          if (j + 1 < row.length) {
            const nextValue = String(row[j + 1] || '').trim();
            if (nextValue) {
              const cleaned = this.cleanProgramInfoValue(nextValue, 'Program');
              if (cleaned) {
                programInfo.Program = cleaned;
                console.log(`   ✅ Found Program (right cell): ${cleaned} at (${i},${j + 1})`);
                continue;
              }
            }
          }
          
          // Try cell below
          if (i + 1 < data.length && j < data[i + 1].length) {
            const belowValue = String(data[i + 1][j] || '').trim();
            if (belowValue) {
              const cleaned = this.cleanProgramInfoValue(belowValue, 'Program');
              if (cleaned) {
                programInfo.Program = cleaned;
                console.log(`   ✅ Found Program (below): ${cleaned} at (${i + 1},${j})`);
                continue;
              }
            }
          }
        }
        
        // YEAR LEVEL detection
        if (!programInfo['Year Level'] && (cellUpper.includes('YEAR') || cellUpper.includes('LEVEL'))) {
          console.log(`   Found label at (${i},${j}): "${cellValue}"`);
          
          // Try same cell
          const match = cellValue.match(/(?:YEAR|LEVEL)\s*[:=]?\s*(.+)/i);
          if (match && match[1].trim()) {
            const cleaned = this.cleanProgramInfoValue(match[1].trim(), 'Year Level');
            if (cleaned) {
              programInfo['Year Level'] = cleaned;
              console.log(`   ✅ Found Year Level: ${cleaned}`);
              continue;
            }
          }
          
          // Try adjacent cells
          if (j + 1 < row.length) {
            const nextValue = String(row[j + 1] || '').trim();
            const cleaned = this.cleanProgramInfoValue(nextValue, 'Year Level');
            if (cleaned) {
              programInfo['Year Level'] = cleaned;
              console.log(`   ✅ Found Year Level: ${cleaned}`);
              continue;
            }
          }
        }
        
        // SECTION detection
        if (!programInfo.Section && (cellUpper.includes('SECTION') || cellUpper.includes('SEC'))) {
          console.log(`   Found label at (${i},${j}): "${cellValue}"`);
          
          // Try same cell
          const match = cellValue.match(/(?:SECTION|SEC)\s*[:=]?\s*(.+)/i);
          if (match && match[1].trim()) {
            const cleaned = this.cleanProgramInfoValue(match[1].trim(), 'Section');
            if (cleaned) {
              programInfo.Section = cleaned;
              console.log(`   ✅ Found Section: ${cleaned}`);
              continue;
            }
          }
          
          // Try adjacent cells
          if (j + 1 < row.length) {
            const nextValue = String(row[j + 1] || '').trim();
            const cleaned = this.cleanProgramInfoValue(nextValue, 'Section');
            if (cleaned) {
              programInfo.Section = cleaned;
              console.log(`   ✅ Found Section: ${cleaned}`);
              continue;
            }
          }
        }
        
        // TERM detection (after SECTION)
        if (!programInfo.Term && (cellUpper.includes('TERM') || cellUpper.includes('SEMESTER'))) {
          console.log(`   Found label at (${i},${j}): "${cellValue}"`);
          
          // Try same cell
          const match = cellValue.match(/(?:TERM|SEMESTER)\s*[:=]?\s*(.+)/i);
          if (match && match[1].trim()) {
            const cleaned = this.cleanProgramInfoValue(match[1].trim(), 'Term');
            if (cleaned) {
              programInfo.Term = cleaned;
              console.log(`   ✅ Found Term: ${cleaned}`);
              continue;
            }
          }
          
          // Try adjacent cells
          if (j + 1 < row.length) {
            const nextValue = String(row[j + 1] || '').trim();
            const cleaned = this.cleanProgramInfoValue(nextValue, 'Term');
            if (cleaned) {
              programInfo.Term = cleaned;
              console.log(`   ✅ Found Term: ${cleaned}`);
              continue;
            }
          }
        }
        
        // ADVISER detection
        if (!programInfo.Adviser && (cellUpper.includes('ADVISER') || cellUpper.includes('ADVISOR') || cellUpper.includes('INSTRUCTOR'))) {
          console.log(`   Found label at (${i},${j}): "${cellValue}"`);
          
          // Try same cell
          const match = cellValue.match(/(?:ADVISER|ADVISOR|INSTRUCTOR)\s*[:=]?\s*(.+)/i);
          if (match && match[1].trim()) {
            const cleaned = this.cleanProgramInfoValue(match[1].trim(), 'Adviser');
            if (cleaned) {
              programInfo.Adviser = cleaned;
              console.log(`   ✅ Found Adviser: ${cleaned}`);
              continue;
            }
          }
          
          // Try adjacent cells
          if (j + 1 < row.length) {
            const nextValue = String(row[j + 1] || '').trim();
            if (nextValue && nextValue.length > 5) { // Likely a name
              programInfo.Adviser = nextValue;
              console.log(`   ✅ Found Adviser: ${nextValue}`);
              continue;
            }
          }
        }
      }
    }
    
    // Debug: Print first few rows
    console.log('\n📋 First 3 rows (for debugging):');
    for (let i = 0; i < Math.min(3, data.length); i++) {
      console.log(`Row ${i}:`, data[i].slice(0, 8));
    }
    
    // Fallback: Extract from filename if still missing critical info
    if (!programInfo.Program) {
      console.log('\n⚠️  Program not found in Excel, checking filename...');
      const filenameCourse = this.extractCourseFromFilename(filename);
      if (filenameCourse) {
        programInfo.Program = filenameCourse;
        console.log(`   ✅ Found Program from filename: ${filenameCourse}`);
      }
    }
    
    if (!programInfo['Year Level']) {
      const yearFromFilename = this.extractYearFromFilename(filename);
      if (yearFromFilename) {
        programInfo['Year Level'] = yearFromFilename;
        console.log(`   ✅ Found Year from filename: ${yearFromFilename}`);
      }
    }
    
    if (!programInfo.Section) {
      const sectionFromFilename = this.extractSectionFromFilename(filename);
      if (sectionFromFilename) {
        programInfo.Section = sectionFromFilename;
        console.log(`   ✅ Found Section from filename: ${sectionFromFilename}`);
      }
    }
    
    console.log('\n📊 Final Program Info:', programInfo);
    
    return programInfo;
  }

  /**
   * Clean and validate program info values
   */
  cleanProgramInfoValue(value, field) {
  if (!value) return null;
  
  value = value.trim();
  
  // Remove common prefixes/suffixes
  value = value.replace(/^[:=\-–—]\s*/, '').replace(/\s*[:=\-–—]$/, '').trim();
  
  if (!value || value === ':' || value === '=' || value === '-') return null;
  
  if (field === 'Program') {
    // Map full course names to codes (NEW!)
    const courseNameMap = {
      'BACHELOR OF SCIENCE IN COMPUTER SCIENCE': 'BSCS',
      'BS COMPUTER SCIENCE': 'BSCS',
      'COMPUTER SCIENCE': 'BSCS',
      'BACHELOR OF SCIENCE IN INFORMATION TECHNOLOGY': 'BSIT',
      'BS INFORMATION TECHNOLOGY': 'BSIT',
      'INFORMATION TECHNOLOGY': 'BSIT',
      'BACHELOR OF SCIENCE IN HOSPITALITY MANAGEMENT': 'BSHM',
      'BS HOSPITALITY MANAGEMENT': 'BSHM',
      'HOSPITALITY MANAGEMENT': 'BSHM',
      'BACHELOR OF SCIENCE IN TOURISM MANAGEMENT': 'BSTM',
      'BS TOURISM MANAGEMENT': 'BSTM',
      'TOURISM MANAGEMENT': 'BSTM',
      'BACHELOR OF SCIENCE IN BUSINESS ADMINISTRATION': 'BSBA',
      'BS BUSINESS ADMINISTRATION': 'BSBA',
      'BUSINESS ADMINISTRATION': 'BSBA',
      'BACHELOR OF SCIENCE IN OFFICE ADMINISTRATION': 'BSOA',
      'BS OFFICE ADMINISTRATION': 'BSOA',
      'OFFICE ADMINISTRATION': 'BSOA',
      'BACHELOR OF ELEMENTARY EDUCATION': 'BECED',
      'ELEMENTARY EDUCATION': 'BECED',
      'BACHELOR OF TECHNOLOGY AND LIVELIHOOD EDUCATION': 'BTLE',
      'TECHNOLOGY AND LIVELIHOOD EDUCATION': 'BTLE'
    };
    
    const valueUpper = value.toUpperCase();
    
    // Check if it's a full name that can be mapped
    for (const [fullName, code] of Object.entries(courseNameMap)) {
      if (valueUpper.includes(fullName)) {
        console.log(`   🔄 Converted "${value}" to "${code}"`);
        return code;
      }
    }
    
    // Try to extract course code pattern
    const match = value.match(/\b(BS[A-Z]{2,4}|AB[A-Z]{2,4}|B[A-Z]{2,4})\b/i);
    if (match) {
      return match[1].toUpperCase();
    }
    
    // Return as-is if no pattern matched (will be used for department detection)
    return value;
    
  } else if (field === 'Year Level') {
    // Extract year number
    const match = value.match(/([1-4])/);
    return match ? match[1] : null;
  } else if (field === 'Section') {
    // Extract section letter
    const match = value.match(/\b([A-Z])\b/);
    return match ? match[1] : value.substring(0, 1).toUpperCase();
  } else if (field === 'Term') {
    // Clean and standardize term/semester value
    const valueUpper = value.toUpperCase();
    
    if (valueUpper.includes('1ST') || valueUpper.includes('FIRST')) {
      return '1st Semester';
    } else if (valueUpper.includes('2ND') || valueUpper.includes('SECOND')) {
      return '2nd Semester';
    } else if (valueUpper.includes('3RD') || valueUpper.includes('THIRD')) {
      return '3rd Semester';
    } else if (valueUpper.includes('SUMMER')) {
      return 'Summer';
    }
    
    return value;
  } else if (field === 'Adviser') {
    // Clean adviser name
    return value.replace(/[^a-zA-Z\s.,]/g, '').trim();
  }
  
  return value;
}

    /**
     * Convert Excel decimal time to readable format
     */
    convertExcelTimeToReadable(excelTime) {
    if (!excelTime || excelTime === '') return 'N/A';
    
    // If it's already a string time, try to parse it
    if (typeof excelTime === 'string') {
        const trimmed = excelTime.trim();
        
        // If empty or just whitespace, return N/A
        if (!trimmed) return 'N/A';
        
        // Check if it's already formatted correctly
        if (/^\d{1,2}:\d{2}\s*(AM|PM)$/i.test(trimmed)) {
            return trimmed;
        }
        
        // Try to extract time from string - be MORE LENIENT
        if (trimmed.includes(':')) {
            // Try multiple patterns
            let match = trimmed.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
            
            if (match) {
                const hours = parseInt(match[1]);
                const minutes = match[2];
                const period = match[3].toUpperCase();
                
                // Only reject if hours are completely invalid (>12 or 0)
                if (hours >= 1 && hours <= 12 && parseInt(minutes) >= 0 && parseInt(minutes) <= 59) {
                    return `${hours}:${minutes} ${period}`;
                }
                
                // If hours > 12, try to extract just the valid part
                console.log(`   ⚠️ Invalid time hours: ${hours}:${minutes} ${period} - attempting to fix...`);
            }
            
            // Try without AM/PM - might be 24-hour format
            match = trimmed.match(/(\d{1,2}):(\d{2})/);
            if (match) {
                let hours = parseInt(match[1]);
                const minutes = match[2];
                
                // Convert 24-hour to 12-hour
                if (hours >= 0 && hours <= 23 && parseInt(minutes) >= 0 && parseInt(minutes) <= 59) {
                    const period = hours >= 12 ? 'PM' : 'AM';
                    const displayHours = hours === 0 ? 12 : (hours > 12 ? hours - 12 : hours);
                    return `${displayHours}:${minutes} ${period}`;
                }
            }
            
            // Last resort - just return the original if it has time-like structure
            console.log(`   ℹ️ Using time value as-is: "${trimmed}"`);
            return trimmed;
        }
    }
    
    // Convert Excel decimal to time
    const decimal = parseFloat(excelTime);
    if (isNaN(decimal)) return 'N/A';
    
    // Validate decimal is within valid range (0 to 1)
    if (decimal < 0 || decimal > 1) {
        console.log(`   ⚠️ Invalid Excel time decimal: ${decimal}`);
        return 'N/A';
    }
    
    // Excel time is stored as fraction of 24 hours
    const totalMinutes = Math.round(decimal * 24 * 60);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    
    // Validate hours and minutes
    if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
        console.log(`   ⚠️ Invalid time values: ${hours}:${minutes}`);
        return 'N/A';
    }
    
    // Convert to 12-hour format
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours === 0 ? 12 : (hours > 12 ? hours - 12 : hours);
    const displayMinutes = minutes.toString().padStart(2, '0');
    
    return `${displayHours}:${displayMinutes} ${period}`;
    }



  /**
   * Extract course from filename
   */
  extractCourseFromFilename(filename) {
    const basename = path.basename(filename, path.extname(filename)).toUpperCase();
    console.log(`   Analyzing filename: ${basename}`);
    
    // Try multiple patterns
    const patterns = [
      /\b(BS[A-Z]{2,4})\b/,
      /\b(AB[A-Z]{2,4})\b/,
      /\b(B[A-Z]{3,4})\b/
    ];
    
    for (const pattern of patterns) {
      const match = basename.match(pattern);
      if (match) {
        console.log(`   Matched: ${match[1]}`);
        return match[1];
      }
    }
    
    return null;
  }

  /**
   * Extract year from filename
   */
  extractYearFromFilename(filename) {
    const basename = path.basename(filename, path.extname(filename));
    const match = basename.match(/(\d)(?:YR|YEAR|Y)/i);
    return match ? match[1] : null;
  }

  /**
   * Extract section from filename
   */
  extractSectionFromFilename(filename) {
    const basename = path.basename(filename, path.extname(filename));
    const match = basename.match(/SEC([A-Z])|_([A-Z])_/i);
    return match ? (match[1] || match[2]).toUpperCase() : null;
  }

  /**
   * Universal schedule data extraction
   */
  scanForScheduleData(data) {
    const scheduleData = [];
    
    // Find potential schedule headers
    const headerKeywords = ['SUBJECT', 'CODE', 'DESCRIPTION', 'UNITS', 'DAY', 'TIME', 'ROOM'];
    let scheduleStartRow = -1;
    
    // Look for a row with multiple schedule keywords
    for (let i = 0; i < data.length; i++) {
      const row = data[i] || [];
      const rowText = row.slice(0, 10).map(cell => String(cell || '')).join(' ').toUpperCase();
      const keywordCount = headerKeywords.filter(kw => rowText.includes(kw)).length;
      
      if (keywordCount >= 3) {
        scheduleStartRow = i + 1;
        console.log(`   Found schedule header at row ${i}, data starts at ${scheduleStartRow}`);
        break;
      }
    }
    
    // Fallback: look for subject code pattern
    if (scheduleStartRow === -1) {
      for (let i = 0; i < data.length; i++) {
        const firstCell = String(data[i]?.[0] || '').trim();
        if (/^[A-Z]{2,4}\s*\d{3}[A-Z]?$/i.test(firstCell)) {
          scheduleStartRow = i;
          console.log(`   Found schedule data starting at row ${i} (subject code pattern)`);
          break;
        }
      }
    }
    
    if (scheduleStartRow >= 0) {
      return this.extractScheduleFlexible(data, scheduleStartRow);
    }
    
    return scheduleData;
  }

  /**
 * Flexible schedule extraction
 */
extractScheduleFlexible(data, startRow) {
  const schedule = [];
  
  console.log(`\n🔍 [ULTRA-FLEXIBLE] Extracting schedule starting from row ${startRow}`);
  console.log(`   Total rows to scan: ${data.length - startRow}`);
  
  for (let i = startRow; i < data.length; i++) {
    const row = data[i] || [];
    if (row.length === 0) continue;
    
    const firstCell = String(row[0] || '').trim();
    
    // Stop conditions
    if (!firstCell) {
      console.log(`   Stopped at row ${i}: empty cell`);
      break;
    }
    
    if (/TOTAL|SUMMARY|GRADE/i.test(firstCell)) {
      console.log(`   Stopped at row ${i}: found "${firstCell}"`);
      break;
    }
    
    // Debug: Show first 10 rows
    if (i < startRow + 10) {
      console.log(`   Row ${i}: "${firstCell}" | "${String(row[1] || '').trim().substring(0, 30)}..."`);
    }
    
    // ULTRA-FLEXIBLE: Accept ANY row with content in first column
    // AND has at least 2 columns with data
    const hasEnoughData = row.filter(cell => String(cell || '').trim()).length >= 2;
    
    if (!hasEnoughData) {
      if (i < startRow + 10) {
        console.log(`      ⚠️ Skipped - not enough data in row`);
      }
      continue;
    }
    
    const subject = {
      'Subject Code': firstCell,
      'Description': String(row[1] || '').trim(),
      'Type': String(row[2] || '').trim(),
      'Units': String(row[3] || '').trim(),
      'Day': String(row[4] || '').trim(),
      'Time Start': this.convertExcelTimeToReadable(row[5]),  
      'Time End': this.convertExcelTimeToReadable(row[6]),    
      'Room': String(row[7] || '').trim()
    };
    
    // Debug: Show time conversion for first few subjects
    if (i < startRow + 5) {
      console.log(`      Time cells for ${firstCell}: Start=[${typeof row[5]}]"${row[5]}" → "${subject['Time Start']}", End=[${typeof row[6]}]"${row[6]}" → "${subject['Time End']}"`);
    }
    
    schedule.push(subject);
    
    if (i < startRow + 3) {
      console.log(`      ✅ Added subject: ${firstCell}`);
    }
  }
  
  console.log(`   ✅ Extracted ${schedule.length} subjects`);
  return schedule;
}


  /**
   * Find total units anywhere in the sheet
   */
  scanForTotalUnits(data) {
    for (let i = 0; i < data.length; i++) {
      const row = data[i] || [];
      for (let j = 0; j < row.length; j++) {
        const cellValue = String(row[j] || '').toUpperCase();
        
        if (cellValue.includes('TOTAL') && (cellValue.includes('UNIT') || cellValue.includes('CREDIT'))) {
          // Look for number in nearby cells
          for (let di = -1; di <= 1; di++) {
            for (let dj = -1; dj <= 3; dj++) {
              const ni = i + di;
              const nj = j + dj;
              
              if (ni >= 0 && ni < data.length && nj >= 0 && nj < data[ni].length) {
                const potentialUnits = String(data[ni][nj] || '').trim();
                if (/^\d+(\.\d+)?$/.test(potentialUnits)) {
                  return potentialUnits;
                }
              }
            }
          }
        }
      }
    }
    return null;
  }

  /**
   * Format COR info for display/storage
   */
  formatCORInfoEnhanced(corInfo) {
    let text = `COR (Certificate of Registration) - Class Schedule

PROGRAM INFORMATION:
Program: ${corInfo.program_info.Program}
Year Level: ${corInfo.program_info['Year Level']}
Section: ${corInfo.program_info.Section}
Term: ${corInfo.program_info.Term}
Adviser: ${corInfo.program_info.Adviser}
Total Units: ${corInfo.total_units || 'N/A'}

ENROLLED SUBJECTS (${corInfo.schedule.length} subjects):
`;
    
    if (corInfo.schedule.length > 0) {
      corInfo.schedule.forEach((course, i) => {
        text += `
Subject ${i + 1}:
- Subject Code: ${course['Subject Code'] || 'N/A'}
- Description: ${course['Description'] || 'N/A'}
- Type: ${course['Type'] || 'N/A'}
- Units: ${course['Units'] || 'N/A'}
- Schedule: ${course['Day'] || 'N/A'} ${course['Time Start'] || 'N/A'}-${course['Time End'] || 'N/A'}
- Room: ${course['Room'] || 'N/A'}
`;
      });
    } else {
      text += '\nNo subjects found in schedule.';
    }
    
    return text.trim();
  }

  /**
   * Detect department from course code
   */
  detectDepartmentFromCourse(courseCode) {
  if (!courseCode) return 'UNKNOWN';
  
  const courseUpper = String(courseCode).toUpperCase().trim();
  
  // Handle full program names FIRST (NEW!)
  if (courseUpper.includes('COMPUTER SCIENCE')) {
    return 'CCS';
  } else if (courseUpper.includes('INFORMATION TECHNOLOGY')) {
    return 'CCS';
  } else if (courseUpper.includes('HOSPITALITY MANAGEMENT') || courseUpper.includes('HOSPITALITY')) {
    return 'CHTM';
  } else if (courseUpper.includes('TOURISM MANAGEMENT') || courseUpper.includes('TOURISM')) {
    return 'CHTM';
  } else if (courseUpper.includes('BUSINESS ADMINISTRATION') || courseUpper.includes('BUSINESS')) {
    return 'CBA';
  } else if (courseUpper.includes('OFFICE ADMINISTRATION')) {
    return 'CBA';
  } else if (courseUpper.includes('EDUCATION')) {
    return 'CTE';
  } else if (courseUpper.includes('ENGINEERING')) {
    return 'COE';
  } else if (courseUpper.includes('NURSING')) {
    return 'CON';
  } else if (courseUpper.includes('ARTS') && courseUpper.includes('SCIENCES')) {
    return 'CAS';
  }
  
  // Check abbreviated codes
  for (const [dept, courses] of Object.entries(this.knownCourses)) {
    if (courses.includes(courseUpper)) {
      return dept;
    }
  }
  
  // Additional check for BS/AB prefix patterns (NEW!)
  if (courseUpper.startsWith('BS HM') || courseUpper.startsWith('BSHM')) {
    return 'CHTM';
  } else if (courseUpper.startsWith('BS TM') || courseUpper.startsWith('BSTM')) {
    return 'CHTM';
  } else if (courseUpper.startsWith('BS IT') || courseUpper.startsWith('BSIT')) {
    return 'CCS';
  } else if (courseUpper.startsWith('BS CS') || courseUpper.startsWith('BSCS')) {
    return 'CCS';
  } else if (courseUpper.startsWith('BS BA') || courseUpper.startsWith('BSBA')) {
    return 'CBA';
  } else if (courseUpper.startsWith('BS OA') || courseUpper.startsWith('BSOA')) {
    return 'CBA';
  }
  
  return 'UNKNOWN';
}

  /**
   * Process COR Excel file and return structured data
   */
  async processCORExcel(filename) {
  try {
    const corInfo = await this.extractCORExcelInfoSmart(filename);
    
    if (!corInfo || !corInfo.program_info.Program) {
      console.log('❌ Could not extract COR data from Excel');
      return null;
    }
    
    const formattedText = this.formatCORInfoEnhanced(corInfo);
    
    const subjectCodesList = corInfo.schedule
      .map(course => course['Subject Code'])
      .filter(code => code);
    const subjectCodesString = subjectCodesList.join(', ');
    
    const metadata = {
      course: corInfo.program_info.Program,
      section: corInfo.program_info.Section,
      term: corInfo.program_info.Term,
      year: corInfo.program_info['Year Level'],  // ← CHANGED from year_level
      adviser: corInfo.program_info.Adviser,
      data_type: 'cor_schedule',
      subject_codes: subjectCodesString,
      total_units: String(corInfo.total_units || ''),
      subject_count: corInfo.schedule.length,
      department: this.detectDepartmentFromCourse(corInfo.program_info.Program),
      created_at: new Date(),
      source_file: path.basename(filename)
    };
    
    console.log('✅ COR processing complete');
    console.log(`   📚 Subjects: ${metadata.subject_count}, Total Units: ${metadata.total_units}`);
    console.log(`   📋 Subject Codes: ${subjectCodesString}`);
    console.log(`\n   📊 Metadata being saved to database:`);
    console.log(`      Course: ${metadata.course}`);
    console.log(`      Section: ${metadata.section}`);
    console.log(`      Term: ${metadata.term}`);
    console.log(`      Year: ${metadata.year} ${metadata.year === undefined ? '⚠️ UNDEFINED!' : '✅'}`);
    console.log(`      Adviser: ${metadata.adviser}`);
    console.log(`      Department: ${metadata.department}`);
    
    return {
      cor_info: corInfo,
      formatted_text: formattedText,
      metadata: metadata
    };
    
  } catch (error) {
    console.error(`❌ Error processing COR Excel: ${error.message}`);
    return null;
  }
}
}

module.exports = CORExcelExtractor;