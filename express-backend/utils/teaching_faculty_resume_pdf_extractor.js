// teaching_faculty_resume_extractor.js
const fs = require('fs').promises;
const path = require('path');
const pdf = require('pdf-parse');

class TeachingFacultyResumeExtractor {
  constructor() {
    this.requiredFields = ['surname', 'first_name'];
  }

  /**
   * Main function to process Teaching Faculty Resume PDF
   */
  async processTeachingFacultyResumePDF(filePath) {
    try {
      console.log(`\n📄 Processing teaching faculty resume PDF: ${filePath}`);
      
      // Extract text from PDF
      const text = await this.extractTextFromPDF(filePath);
      
      if (!text || text.trim().length === 0) {
        console.log('❌ Could not extract text from PDF');
        return null;
      }
      
      console.log(`   Extracted ${text.length} characters of text`);
      
      // Debug: Save extracted text for troubleshooting
      if (process.env.DEBUG_RESUME === 'true') {
        const debugPath = filePath.replace('.pdf', '_extracted.txt');
        await fs.writeFile(debugPath, text);
        console.log(`   📝 Debug: Saved extracted text to ${path.basename(debugPath)}`);
      }
      
      // Extract faculty information
      const facultyInfo = this.extractFacultyInfo(text);
      
      // If no name found in labeled fields, try to extract from document structure
      if (!facultyInfo.surname && !facultyInfo.first_name) {
        console.log('⚠️  Name not found in labeled fields, trying alternate extraction...');
        const alternateName = this.extractNameFromStructure(text);
        if (alternateName) {
          Object.assign(facultyInfo, alternateName);
          console.log(`   Found name: ${alternateName.first_name || ''} ${alternateName.surname || ''}`);
        }
      }
      
      // Still no name? Use filename as fallback
      if (!facultyInfo.surname && !facultyInfo.first_name) {
        console.log('⚠️  Could not extract faculty name, using filename as fallback');
        const fileNameParts = path.basename(filePath, '.pdf').split(/[\s_-]+/);
        if (fileNameParts.length >= 2) {
          facultyInfo.first_name = fileNameParts[0];
          facultyInfo.surname = fileNameParts[fileNameParts.length - 1];
        } else {
          facultyInfo.first_name = fileNameParts[0] || 'Unknown';
          facultyInfo.surname = 'Faculty';
        }
      }
      
      // Extract image/photo if available
      let photoData = null;
      try {
        photoData = await this.extractPhotoFromPDF(filePath);
        if (photoData) {
          console.log(`   ✅ Extracted photo (${photoData.size} bytes)`);
        }
      } catch (photoError) {
        console.log(`   ℹ️  No photo found or could not extract`);
      }
      
      // Build full name
      const fullName = this.buildFullName(facultyInfo);
      
      // Determine department
      const department = this.inferDepartment(facultyInfo);
      
      // Format the output
      const result = {
        metadata: {
          full_name: fullName,
          surname: facultyInfo.surname || '',
          first_name: facultyInfo.first_name || '',
          middle_name: facultyInfo.middle_name || '',
          department: department,
          position: facultyInfo.position || '',
          email: facultyInfo.email || '',
          phone: facultyInfo.phone || '',
          data_type: 'teaching_faculty_resume_pdf',
          source_file: path.basename(filePath),
          has_photo: photoData !== null,
          extracted_at: new Date()
        },
        faculty_data: facultyInfo,
        photo_data: photoData,
        raw_text: text,
        formatted_text: this.formatFacultyInfo(facultyInfo)
      };
      
      console.log(`✅ Extracted faculty: ${fullName}`);
      if (department) console.log(`   Department: ${department}`);
      
      return result;
      
    } catch (error) {
      console.error(`❌ Error processing PDF: ${error.message}`);
      return null;
    }
  }

  /**
   * Extract text from PDF
   */
  async extractTextFromPDF(filePath) {
    try {
      const pdfData = await fs.readFile(filePath);
      const data = await pdf(pdfData);
      return data.text;
    } catch (error) {
      if (error.code === 'MODULE_NOT_FOUND') {
        console.error('❌ pdf-parse module not found. Please install it:');
        console.error('   npm install pdf-parse@1.1.1');
      }
      throw error;
    }
  }

  /**
   * Extract photo/image from PDF
   */
  async extractPhotoFromPDF(filePath) {
    try {
      // Use pdf-image or pdf-lib to extract images
      const { exec } = require('child_process');
      const util = require('util');
      const execPromise = util.promisify(exec);
      
      const outputDir = path.join(path.dirname(filePath), '.temp_images');
      const baseFileName = path.basename(filePath, '.pdf').replace(/\s+/g, '_');
      
      // Create temp directory
      await fs.mkdir(outputDir, { recursive: true });
      
      // Try pdfimages (from poppler-utils) if available
      try {
        console.log(`   Attempting to extract images using pdfimages...`);
        
        // Use -all flag to extract all image formats
        const outputPath = path.join(outputDir, baseFileName);
        await execPromise(`pdfimages -all "${filePath}" "${outputPath}"`);
        
        // Check for extracted images
        const files = await fs.readdir(outputDir);
        const imageFiles = files.filter(f => 
          f.startsWith(baseFileName) && 
          (f.endsWith('.jpg') || f.endsWith('.png') || 
           f.endsWith('.ppm') || f.endsWith('.pbm') || f.endsWith('.jpeg'))
        );
        
        console.log(`   Found ${imageFiles.length} image(s)`);
        
        if (imageFiles.length > 0) {
          // Get the first (likely profile) image
          const imagePath = path.join(outputDir, imageFiles[0]);
          const imageBuffer = await fs.readFile(imagePath);
          
          const photoData = {
            buffer: imageBuffer,
            extension: path.extname(imageFiles[0]),
            size: imageBuffer.length,
            filename: imageFiles[0]
          };
          
          // Clean up temp files
          for (const file of imageFiles) {
            await fs.unlink(path.join(outputDir, file)).catch(() => {});
          }
          await fs.rmdir(outputDir).catch(() => {});
          
          return photoData;
        }
      } catch (cmdError) {
        console.log(`   pdfimages not available: ${cmdError.message}`);
        console.log(`   Install poppler-utils for image extraction support`);
      }
      
      // Clean up temp directory
      await fs.rmdir(outputDir).catch(() => {});
      
      return null;
      
    } catch (error) {
      return null;
    }
  }

  /**
   * Extract name from document structure (for non-standard formats)
   */
  extractNameFromStructure(text) {
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    
    // Common job titles to skip
    const jobTitles = [
      'FLIGHT ATTENDANT', 'FLIGHT TRAINING', 'TEACHER', 'PROFESSOR', 'INSTRUCTOR', 'ENGINEER',
      'ACCOUNTANT', 'MANAGER', 'DIRECTOR', 'COORDINATOR', 'SPECIALIST',
      'ANALYST', 'DEVELOPER', 'DESIGNER', 'CONSULTANT', 'ADMINISTRATOR',
      'ASSISTANT', 'ASSOCIATE', 'SENIOR', 'JUNIOR', 'HEAD', 'CHIEF', 'TRAINING'
    ];
    
    // Strategy 1: Look for name-like patterns in first 10 lines
    for (let i = 0; i < Math.min(10, lines.length); i++) {
      const line = lines[i];
      const upper = line.toUpperCase();
      
      // Skip job titles
      let isJobTitle = false;
      for (const title of jobTitles) {
        if (upper.includes(title)) {
          isJobTitle = true;
          break;
        }
      }
      if (isJobTitle) continue;
      
      // Skip obvious non-name lines
      if (line.length > 50) continue;
      if (/^\d+$/.test(line)) continue;
      if (upper.includes('CURRICULUM') || 
          upper.includes('VITAE') ||
          upper.includes('RESUME') ||
          upper.includes('CV') ||
          upper.includes('CONTACT') ||
          upper.includes('EDUCATION') ||
          upper.includes('EXPERIENCE')) continue;
      
      // Check if line looks like a name (2-4 words, mostly letters)
      const words = line.split(/\s+/).filter(w => w.length > 1);
      if (words.length >= 2 && words.length <= 4) {
        const isAllWords = words.every(w => /^[A-Za-z'-]+$/.test(w));
        if (isAllWords) {
          // Check if it's not all caps (likely a header, not a name)
          const hasLowerCase = /[a-z]/.test(line);
          const isProperCase = /^[A-Z][a-z]/.test(line);
          
          if (hasLowerCase || isProperCase) {
            // Likely a name!
            return this.parseFullName(line);
          }
        }
      }
    }
    
    // Strategy 2: Look for lines with capital letters that might be names
    for (let i = 0; i < Math.min(15, lines.length); i++) {
      const line = lines[i];
      const upper = line.toUpperCase();
      
      // Skip job titles again
      let isJobTitle = false;
      for (const title of jobTitles) {
        if (upper.includes(title)) {
          isJobTitle = true;
          break;
        }
      }
      if (isJobTitle) continue;
      
      // Check for "FirstName LastName" pattern (title case)
      if (/^[A-Z][a-z]+\s+[A-Z][a-z]+/.test(line) && line.length < 40) {
        const words = line.split(/\s+/);
        if (words.length >= 2 && words.length <= 4) {
          return this.parseFullName(line);
        }
      }
    }
    
    return null;
  }

  /**
   * Extract faculty information from text
   */
  extractFacultyInfo(text) {
    const facultyInfo = {};
    
    // Split into lines
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    
    // Search for field labels and values
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const upper = line.toUpperCase();
      
      // Personal Information
      if (this.matchesLabel(upper, ['FULL NAME', 'NAME'])) {
        const fullName = this.extractValueFromLine(line, lines, i);
        if (fullName) {
          const parsed = this.parseFullName(fullName);
          Object.assign(facultyInfo, parsed);
        }
      }
      else if (this.matchesLabel(upper, ['SURNAME', 'LAST NAME', 'FAMILY NAME'])) {
        facultyInfo.surname = this.extractValueFromLine(line, lines, i);
      }
      else if (this.matchesLabel(upper, ['FIRST NAME', 'GIVEN NAME', 'FIRSTNAME'])) {
        facultyInfo.first_name = this.extractValueFromLine(line, lines, i);
      }
      else if (this.matchesLabel(upper, ['MIDDLE NAME', 'MIDDLENAME'])) {
        facultyInfo.middle_name = this.extractValueFromLine(line, lines, i);
      }
      else if (this.matchesLabel(upper, ['DATE OF BIRTH', 'BIRTHDATE', 'DOB', 'BIRTH DATE'])) {
        facultyInfo.date_of_birth = this.extractValueFromLine(line, lines, i);
      }
      else if (this.matchesLabel(upper, ['PLACE OF BIRTH', 'BIRTHPLACE'])) {
        facultyInfo.place_of_birth = this.extractValueFromLine(line, lines, i);
      }
      else if (this.matchesLabel(upper, ['SEX', 'GENDER'])) {
        facultyInfo.sex = this.extractValueFromLine(line, lines, i);
      }
      else if (this.matchesLabel(upper, ['CITIZENSHIP', 'NATIONALITY'])) {
        facultyInfo.citizenship = this.extractValueFromLine(line, lines, i);
      }
      else if (this.matchesLabel(upper, ['CIVIL STATUS', 'MARITAL STATUS'])) {
        facultyInfo.civil_status = this.extractValueFromLine(line, lines, i);
      }
      else if (this.matchesLabel(upper, ['RELIGION'])) {
        facultyInfo.religion = this.extractValueFromLine(line, lines, i);
      }
      
      // Contact Information
      else if (this.matchesLabel(upper, ['ADDRESS', 'RESIDENTIAL ADDRESS', 'HOME ADDRESS'])) {
        facultyInfo.address = this.extractValueFromLine(line, lines, i);
      }
      else if (this.matchesLabel(upper, ['ZIP CODE', 'ZIPCODE', 'POSTAL CODE'])) {
        facultyInfo.zip_code = this.extractValueFromLine(line, lines, i);
      }
      else if (this.matchesLabel(upper, ['PHONE', 'TELEPHONE', 'CONTACT NUMBER', 'MOBILE', 'CELL'])) {
        if (!facultyInfo.phone) { // Get first phone only
          facultyInfo.phone = this.extractValueFromLine(line, lines, i);
        }
      }
      else if (this.matchesLabel(upper, ['EMAIL', 'E-MAIL', 'EMAIL ADDRESS'])) {
        if (!facultyInfo.email) { // Get first email only
          facultyInfo.email = this.extractValueFromLine(line, lines, i);
        }
      }
      
      // Professional Information
      else if (this.matchesLabel(upper, ['POSITION', 'JOB TITLE', 'DESIGNATION', 'RANK'])) {
        facultyInfo.position = this.extractValueFromLine(line, lines, i);
      }
      else if (this.matchesLabel(upper, ['DEPARTMENT', 'COLLEGE', 'SCHOOL', 'DEPT'])) {
        if (!facultyInfo.department) {
          facultyInfo.department = this.extractValueFromLine(line, lines, i);
        }
      }
      else if (this.matchesLabel(upper, ['EMPLOYMENT STATUS', 'STATUS'])) {
        facultyInfo.employment_status = this.extractValueFromLine(line, lines, i);
      }
      else if (this.matchesLabel(upper, ['SPECIALIZATION', 'FIELD OF STUDY', 'EXPERTISE'])) {
        facultyInfo.specialization = this.extractValueFromLine(line, lines, i);
      }
      
      // Education - Look for degree patterns
      else if (this.matchesLabel(upper, ['EDUCATION', 'EDUCATIONAL BACKGROUND', 'EDUCATIONAL ATTAINMENT'])) {
        facultyInfo.education = this.extractEducation(lines, i);
      }
      
      // Check for email pattern (common in resumes)
      if (!facultyInfo.email && line.includes('@')) {
        const emailMatch = line.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
        if (emailMatch) {
          facultyInfo.email = emailMatch[0];
        }
      }
      
      // Check for phone pattern
      if (!facultyInfo.phone && /\d{10,}/.test(line)) {
        const phoneMatch = line.match(/[\d\-\+\(\)\s]{10,}/);
        if (phoneMatch) {
          facultyInfo.phone = phoneMatch[0].trim();
        }
      }
    }
    
    return facultyInfo;
  }

  /**
   * Check if label matches any pattern
   */
  matchesLabel(upper, patterns) {
    for (const pattern of patterns) {
      const patternUpper = pattern.toUpperCase();
      // Check for exact match or followed by colon/space
      if (upper === patternUpper || 
          upper.startsWith(patternUpper + ':') ||
          upper.startsWith(patternUpper + ' ')) {
        return true;
      }
    }
    return false;
  }

  /**
   * Extract value from line or next line
   */
  extractValueFromLine(line, lines, index) {
    // Try to extract from same line (after colon or label)
    const colonIndex = line.indexOf(':');
    if (colonIndex > -1 && colonIndex < line.length - 1) {
      const value = line.substring(colonIndex + 1).trim();
      if (value && value.length > 0) {
        return value;
      }
    }
    
    // Try next line
    if (index + 1 < lines.length) {
      const nextLine = lines[index + 1];
      // Make sure next line is not a label
      if (!this.looksLikeLabel(nextLine)) {
        return nextLine;
      }
    }
    
    return '';
  }

  /**
   * Check if line looks like a label
   */
  looksLikeLabel(line) {
    const upper = line.toUpperCase();
    const commonLabels = [
      'NAME', 'ADDRESS', 'PHONE', 'EMAIL', 'POSITION', 'DEPARTMENT',
      'EDUCATION', 'EXPERIENCE', 'SKILLS', 'DATE', 'PLACE', 'SEX',
      'CITIZENSHIP', 'STATUS', 'RELIGION'
    ];
    
    for (const label of commonLabels) {
      if (upper.includes(label)) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * Parse full name into components
   */
  parseFullName(fullName) {
    const result = {};
    
    // Check for "Surname, First Name" format
    if (fullName.includes(',')) {
      const parts = fullName.split(',').map(p => p.trim());
      result.surname = parts[0];
      result.first_name = parts[1] || '';
      
      // Check for middle name in first name part
      const nameParts = result.first_name.split(' ');
      if (nameParts.length > 1) {
        result.first_name = nameParts[0];
        result.middle_name = nameParts.slice(1).join(' ');
      }
    } else {
      // Assume "First Middle Last" format
      const parts = fullName.trim().split(/\s+/);
      if (parts.length >= 3) {
        result.first_name = parts[0];
        result.middle_name = parts.slice(1, -1).join(' ');
        result.surname = parts[parts.length - 1];
      } else if (parts.length === 2) {
        result.first_name = parts[0];
        result.surname = parts[1];
      } else {
        result.first_name = fullName;
      }
    }
    
    return result;
  }

  /**
   * Extract education information
   */
  extractEducation(lines, startIndex) {
    const education = [];
    
    // Look ahead for degree information
    for (let i = startIndex + 1; i < Math.min(startIndex + 20, lines.length); i++) {
      const line = lines[i];
      const upper = line.toUpperCase();
      
      // Stop if we hit another section
      if (this.looksLikeLabel(line) && 
          !upper.includes('DEGREE') && 
          !upper.includes('UNIVERSITY') &&
          !upper.includes('COLLEGE')) {
        break;
      }
      
      // Look for degree patterns
      if (upper.includes('MASTER') || upper.includes('DOCTOR') || 
          upper.includes('BACHELOR') || upper.includes('PHD') ||
          upper.includes('MA ') || upper.includes('MS ') || 
          upper.includes('BS ') || upper.includes('BA ')) {
        education.push(line);
      }
    }
    
    return education.join('; ');
  }

  /**
   * Infer department from position or specialization
   */
  inferDepartment(facultyInfo) {
    const position = (facultyInfo.position || '').toUpperCase();
    const specialization = (facultyInfo.specialization || '').toUpperCase();
    const department = (facultyInfo.department || '').toUpperCase();
    const combinedText = `${position} ${specialization} ${department}`;
    
    // Department mappings
    const deptMappings = {
      'CCS': ['COMPUTER', 'CS', 'IT', 'INFORMATION TECHNOLOGY', 'SOFTWARE'],
      'CHTM': ['TOURISM', 'HOSPITALITY', 'HOTEL', 'HM', 'TM'],
      'CBA': ['BUSINESS', 'ACCOUNTANCY', 'ACCOUNTING', 'MANAGEMENT'],
      'CET': ['ENGINEERING', 'CIVIL', 'ELECTRICAL', 'MECHANICAL'],
      'COED': ['EDUCATION', 'TEACHER', 'TEACHING'],
      'CAS': ['ARTS', 'SCIENCES', 'MATH', 'ENGLISH', 'SOCIAL']
    };
    
    for (const [dept, keywords] of Object.entries(deptMappings)) {
      for (const keyword of keywords) {
        if (combinedText.includes(keyword)) {
          return dept;
        }
      }
    }
    
    return facultyInfo.department || '';
  }

  /**
   * Build full name
   */
  buildFullName(facultyInfo) {
    if (facultyInfo.surname && facultyInfo.first_name) {
      return `${facultyInfo.surname}, ${facultyInfo.first_name}`;
    } else if (facultyInfo.surname) {
      return facultyInfo.surname;
    } else if (facultyInfo.first_name) {
      return facultyInfo.first_name;
    }
    return 'Unknown Faculty';
  }

  /**
   * Format faculty information as readable text
   */
  formatFacultyInfo(facultyInfo) {
    let text = '='.repeat(60) + '\n';
    text += 'TEACHING FACULTY RESUME\n';
    text += '='.repeat(60) + '\n\n';
    
    text += 'PERSONAL INFORMATION:\n';
    if (facultyInfo.surname) text += `  Surname: ${facultyInfo.surname}\n`;
    if (facultyInfo.first_name) text += `  First Name: ${facultyInfo.first_name}\n`;
    if (facultyInfo.middle_name) text += `  Middle Name: ${facultyInfo.middle_name}\n`;
    if (facultyInfo.date_of_birth) text += `  Date of Birth: ${facultyInfo.date_of_birth}\n`;
    if (facultyInfo.place_of_birth) text += `  Place of Birth: ${facultyInfo.place_of_birth}\n`;
    if (facultyInfo.sex) text += `  Sex: ${facultyInfo.sex}\n`;
    if (facultyInfo.citizenship) text += `  Citizenship: ${facultyInfo.citizenship}\n`;
    if (facultyInfo.civil_status) text += `  Civil Status: ${facultyInfo.civil_status}\n`;
    if (facultyInfo.religion) text += `  Religion: ${facultyInfo.religion}\n`;
    text += '\n';
    
    text += 'CONTACT INFORMATION:\n';
    if (facultyInfo.address) text += `  Address: ${facultyInfo.address}\n`;
    if (facultyInfo.zip_code) text += `  Zip Code: ${facultyInfo.zip_code}\n`;
    if (facultyInfo.phone) text += `  Phone: ${facultyInfo.phone}\n`;
    if (facultyInfo.email) text += `  Email: ${facultyInfo.email}\n`;
    text += '\n';
    
    text += 'PROFESSIONAL INFORMATION:\n';
    if (facultyInfo.position) text += `  Position: ${facultyInfo.position}\n`;
    if (facultyInfo.department) text += `  Department: ${facultyInfo.department}\n`;
    if (facultyInfo.employment_status) text += `  Employment Status: ${facultyInfo.employment_status}\n`;
    if (facultyInfo.specialization) text += `  Specialization: ${facultyInfo.specialization}\n`;
    if (facultyInfo.education) text += `  Education: ${facultyInfo.education}\n`;
    
    return text;
  }
}

module.exports = TeachingFacultyResumeExtractor;