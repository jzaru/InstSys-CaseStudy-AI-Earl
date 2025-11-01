// export_images.js
// Export student images from MongoDB to local files

const path = require('path');
const fs = require('fs').promises;
const { StudentDatabase } = require('./main');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

class ImageExporter {
  constructor() {
    this.db = new StudentDatabase();
    this.outputFolder = path.join(__dirname, 'exported_images');
  }

  async start() {
    console.log('='.repeat(70));
    console.log('🖼️  STUDENT IMAGE EXPORTER');
    console.log('='.repeat(70));

    try {
      // Connect to database
      console.log('\n📡 Connecting to MongoDB...');
      await this.db.connect();
      console.log('✅ Connected to MongoDB');

      // Create output folder
      await this.createOutputFolder();

      // Show menu
      await this.showMenu();

    } catch (error) {
      console.error(`\n❌ Error: ${error.message}`);
      process.exit(1);
    }
  }

  async createOutputFolder() {
    try {
      await fs.access(this.outputFolder);
      console.log(`\n📁 Output folder exists: ${this.outputFolder}`);
    } catch {
      await fs.mkdir(this.outputFolder, { recursive: true });
      console.log(`\n📁 Created output folder: ${this.outputFolder}`);
    }
  }

  async showMenu() {
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    const question = (query) => new Promise((resolve) => rl.question(query, resolve));

    console.log('\n' + '='.repeat(70));
    console.log('EXPORT OPTIONS:');
    console.log('='.repeat(70));
    console.log('1. Export ALL student images');
    console.log('2. Export by Department (CCS, CHTM, CBA, CTE)');
    console.log('3. Export single student by ID');
    console.log('4. View image statistics');
    console.log('5. Open exported images folder');
    console.log('6. Exit');
    console.log('='.repeat(70));

    const choice = await question('\nEnter your choice (1-6): ');

    switch (choice.trim()) {
      case '1':
        await this.exportAllImages();
        break;
      case '2':
        const dept = await question('Enter department (CCS/CHTM/CBA/CTE): ');
        await this.exportByDepartment(dept.trim().toUpperCase());
        break;
      case '3':
        const studentId = await question('Enter Student ID (e.g., PDM-2023-000001): ');
        await this.exportSingleStudent(studentId.trim().toUpperCase());
        break;
      case '4':
        await this.showStatistics();
        await this.showMenu();
        break;
      case '5':
        await this.openFolder();
        await this.showMenu();
        break;
      case '6':
        console.log('\n👋 Goodbye!');
        await this.db.close();
        rl.close();
        process.exit(0);
        break;
      default:
        console.log('\n❌ Invalid choice');
        await this.showMenu();
    }

    // Ask if want to continue
    const continueChoice = await question('\nExport more images? (yes/no): ');
    if (continueChoice.toLowerCase().startsWith('y')) {
      await this.showMenu();
    } else {
      console.log('\n👋 Goodbye!');
      await this.db.close();
      rl.close();
      process.exit(0);
    }
  }

  async exportAllImages() {
    console.log('\n🔄 Exporting all student images...\n');

    const collections = ['students_ccs', 'students_chtm', 'students_cba', 'students_cte', 'students'];
    let totalExported = 0;
    let totalSkipped = 0;

    for (const collName of collections) {
      try {
        const collection = this.db.db.collection(collName);
        const students = await collection.find({ 'image.data': { $ne: null } }).toArray();

        console.log(`\n📚 Processing ${collName}...`);
        console.log(`   Found ${students.length} students with images`);

        for (const student of students) {
          const result = await this.saveImage(student);
          if (result) {
            totalExported++;
            console.log(`   ✅ ${student.student_id}: ${student.full_name}`);
          } else {
            totalSkipped++;
          }
        }
      } catch (error) {
        console.log(`   ⚠️  Collection ${collName} not found, skipping`);
      }
    }

    console.log('\n' + '='.repeat(70));
    console.log('📊 EXPORT SUMMARY');
    console.log('='.repeat(70));
    console.log(`✅ Exported: ${totalExported} images`);
    console.log(`⚠️  Skipped: ${totalSkipped} students`);
    console.log(`📁 Location: ${this.outputFolder}`);
    console.log('='.repeat(70));

    // Ask to open folder
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    const question = (query) => new Promise((resolve) => rl.question(query, resolve));
    
    const openNow = await question('\nOpen folder now? (yes/no): ');
    if (openNow.toLowerCase().startsWith('y')) {
      await this.openFolder();
    }
    rl.close();
  }

  async exportByDepartment(dept) {
    console.log(`\n🔄 Exporting ${dept} student images...\n`);

    const collName = `students_${dept.toLowerCase()}`;
    
    try {
      const collection = this.db.db.collection(collName);
      const students = await collection.find({ 'image.data': { $ne: null } }).toArray();

      if (students.length === 0) {
        console.log(`⚠️  No students with images found in ${dept}`);
        return;
      }

      console.log(`Found ${students.length} students with images\n`);

      // Create department subfolder
      const deptFolder = path.join(this.outputFolder, dept);
      await fs.mkdir(deptFolder, { recursive: true });

      let exported = 0;
      for (const student of students) {
        const result = await this.saveImage(student, deptFolder);
        if (result) {
          exported++;
          console.log(`   ✅ ${student.student_id}: ${student.full_name}`);
        }
      }

      console.log('\n' + '='.repeat(70));
      console.log(`✅ Exported ${exported} images to: ${deptFolder}`);
      console.log('='.repeat(70));

      // Ask to open folder
      const readline = require('readline');
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });
      const question = (query) => new Promise((resolve) => rl.question(query, resolve));
      
      const openNow = await question('\nOpen folder now? (yes/no): ');
      if (openNow.toLowerCase().startsWith('y')) {
        await this.openFolder(deptFolder);
      }
      rl.close();

    } catch (error) {
      console.log(`❌ Error: ${error.message}`);
    }
  }

  async exportSingleStudent(studentId) {
    console.log(`\n🔍 Searching for student: ${studentId}...\n`);

    const collections = ['students_ccs', 'students_chtm', 'students_cba', 'students_cte', 'students'];
    
    for (const collName of collections) {
      try {
        const collection = this.db.db.collection(collName);
        const student = await collection.findOne({ student_id: studentId });

        if (student) {
          console.log('✅ Student found!');
          console.log(`   Name: ${student.full_name}`);
          console.log(`   Course: ${student.course} ${student.year}${student.section}`);
          console.log(`   Department: ${student.department}\n`);

          if (!student.image || !student.image.data) {
            console.log('❌ This student has no image stored');
            return;
          }

          const imagePath = await this.saveImage(student);
          
          if (imagePath) {
            console.log(`\n✅ Image exported successfully!`);
            console.log(`📁 Location: ${imagePath}`);

            // Ask to open image
            const readline = require('readline');
            const rl = readline.createInterface({
              input: process.stdin,
              output: process.stdout
            });
            const question = (query) => new Promise((resolve) => rl.question(query, resolve));
            
            const openNow = await question('\nOpen image now? (yes/no): ');
            if (openNow.toLowerCase().startsWith('y')) {
              await this.openImage(imagePath);
            }
            rl.close();
          }
          return;
        }
      } catch (error) {
        // Continue searching
      }
    }

    console.log('❌ Student not found');
  }

  async saveImage(student, outputFolder = null) {
    try {
      if (!student.image || !student.image.data) {
        return null;
      }

      const folder = outputFolder || this.outputFolder;
      
      // Generate filename
      const ext = this.getExtension(student.image.filename);
      const filename = `${student.student_id}_${this.sanitizeFilename(student.full_name)}${ext}`;
      const filepath = path.join(folder, filename);

      // Write image to file
      await fs.writeFile(filepath, student.image.data.buffer);

      return filepath;
    } catch (error) {
      console.log(`   ❌ Error saving ${student.student_id}: ${error.message}`);
      return null;
    }
  }

  async showStatistics() {
    console.log('\n' + '='.repeat(70));
    console.log('📊 IMAGE STATISTICS');
    console.log('='.repeat(70));

    const collections = ['students_ccs', 'students_chtm', 'students_cba', 'students_cte'];
    const stats = {
      total: 0,
      withImages: 0,
      withoutImages: 0,
      byDept: {}
    };

    for (const collName of collections) {
      try {
        const collection = this.db.db.collection(collName);
        const total = await collection.countDocuments();
        const withImages = await collection.countDocuments({ 'image.data': { $ne: null } });
        
        const dept = collName.replace('students_', '').toUpperCase();
        stats.byDept[dept] = {
          total: total,
          withImages: withImages,
          withoutImages: total - withImages,
          percentage: total > 0 ? ((withImages / total) * 100).toFixed(1) : 0
        };
        
        stats.total += total;
        stats.withImages += withImages;
      } catch (error) {
        // Collection might not exist
      }
    }

    stats.withoutImages = stats.total - stats.withImages;

    console.log(`\nTotal Students: ${stats.total}`);
    console.log(`✅ With Images: ${stats.withImages} (${((stats.withImages / stats.total) * 100).toFixed(1)}%)`);
    console.log(`❌ Without Images: ${stats.withoutImages}\n`);

    console.log('By Department:');
    Object.entries(stats.byDept).forEach(([dept, data]) => {
      console.log(`\n  ${dept}:`);
      console.log(`    Total: ${data.total}`);
      console.log(`    With Images: ${data.withImages} (${data.percentage}%)`);
      console.log(`    Without Images: ${data.withoutImages}`);
    });

    console.log('\n' + '='.repeat(70));
  }

  async openFolder(folderPath = null) {
    const folder = folderPath || this.outputFolder;
    
    try {
      console.log(`\n📂 Opening folder: ${folder}`);
      
      // Detect OS and open folder
      const platform = process.platform;
      
      if (platform === 'win32') {
        // Windows
        await execAsync(`explorer "${folder}"`);
      } else if (platform === 'darwin') {
        // macOS
        await execAsync(`open "${folder}"`);
      } else {
        // Linux
        await execAsync(`xdg-open "${folder}"`);
      }
      
      console.log('✅ Folder opened!');
    } catch (error) {
      console.log(`⚠️  Could not open folder automatically`);
      console.log(`📁 Please open manually: ${folder}`);
    }
  }

  async openImage(imagePath) {
    try {
      console.log(`\n🖼️  Opening image: ${path.basename(imagePath)}`);
      
      // Detect OS and open image
      const platform = process.platform;
      
      if (platform === 'win32') {
        // Windows
        await execAsync(`"${imagePath}"`);
      } else if (platform === 'darwin') {
        // macOS
        await execAsync(`open "${imagePath}"`);
      } else {
        // Linux
        await execAsync(`xdg-open "${imagePath}"`);
      }
      
      console.log('✅ Image opened!');
    } catch (error) {
      console.log(`⚠️  Could not open image automatically`);
      console.log(`📁 Please open manually: ${imagePath}`);
    }
  }

  getExtension(filename) {
    if (!filename) return '.jpg';
    
    const ext = path.extname(filename);
    return ext || '.jpg';
  }

  sanitizeFilename(name) {
    if (!name) return 'unknown';
    
    return name
      .replace(/[^a-zA-Z0-9\s-]/g, '')
      .replace(/\s+/g, '_')
      .substring(0, 50);
  }
}

// Run
if (require.main === module) {
  const exporter = new ImageExporter();
  exporter.start().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = ImageExporter;