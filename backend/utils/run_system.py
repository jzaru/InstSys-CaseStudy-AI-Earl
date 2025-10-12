import os
import sys
from pathlib import Path

# Import the MongoDB student database
from main import StudentDatabase, StudentDataExtractor

class SchoolInformationSystem:
    def __init__(self, connection_string=None):
        """Initialize the school system with MongoDB"""
        self.db = StudentDatabase(connection_string)
        
        # Get the backend directory (2 levels up from utils folder)
        current_dir = os.path.dirname(os.path.abspath(__file__))
        backend_dir = os.path.dirname(current_dir)  # Go up to backend folder
        
        # Build relative paths from backend directory
        self.base_path = os.path.join(backend_dir, "utils", "uploaded_files")
        self.excel = os.path.join(self.base_path, "excel")
        self.upload_folder = self.base_path
        self.student_excel_folder = os.path.join(self.upload_folder, "student_list_excel")
        self.processed_folder = os.path.join(self.upload_folder, "processed")
        
        # Create directories if they don't exist
        for folder in [self.base_path, self.excel, self.student_excel_folder, self.processed_folder]:
            os.makedirs(folder, exist_ok=True)
        
        # Create processed folder if it doesn't exist
        os.makedirs(self.processed_folder, exist_ok=True)
        
        print(f"📁 Looking for Excel files in: {self.student_excel_folder}")
    
    def clear_all_data(self):
        """Clear all student data from MongoDB"""
        try:
            confirm = input("⚠️  Clear ALL student data from MongoDB? (yes/no): ").strip().lower()
            if confirm == 'yes':
                self.db.clear_all_data()
                print("✅ All data cleared from MongoDB")
            else:
                print("❌ Operation cancelled")
        except Exception as e:
            print(f"❌ Error clearing data: {e}")
    
    def scan_and_process_files(self):
        """Scan uploaded_files folder and process all Excel files"""
        if not os.path.exists(self.student_excel_folder):
            print(f"📁 Creating folder: {self.student_excel_folder}")
            os.makedirs(self.student_excel_folder, exist_ok=True)
            print(f"ℹ️  Place your Excel files in: {self.student_excel_folder}")
            return False
        
        # Find all Excel files
        excel_files = list(Path(self.student_excel_folder).glob("*.xlsx")) + \
                     list(Path(self.student_excel_folder).glob("*.xls"))
        
        if not excel_files:
            print(f"⚠️  No Excel files found in: {self.student_excel_folder}")
            print(f"ℹ️  Place your Excel files there and run again")
            return False
        
        print(f"\n📊 Found {len(excel_files)} Excel file(s)")
        total_processed = 0
        
        for excel_file in excel_files:
            print(f"\n📄 Processing: {excel_file.name}")
            try:
                success = StudentDataExtractor.process_excel(str(excel_file), self.db)
                if success:
                    print(f"✅ Successfully processed: {excel_file.name}")
                    total_processed += 1
                else:
                    print(f"⚠️  No data extracted from: {excel_file.name}")
            except Exception as e:
                print(f"❌ Error processing {excel_file.name}: {e}")
        
        return total_processed > 0
    
    def show_statistics(self):
        """Display system statistics"""
        stats = self.db.get_statistics()
        
        print("\n" + "="*60)
        print("📊 SYSTEM STATISTICS")
        print("="*60)
        print(f"Total Students: {stats['total_students']}")
        print(f"Pending Media: {stats['pending_media']}")
        print(f"Average Completion: {stats['average_completion']:.1f}%")
        
        if stats['by_department']:
            print(f"\nBy Department:")
            for dept, count in stats['by_department'].items():
                print(f"  • {dept}: {count} students")
    
    def show_pending_media(self):
        """Show students waiting for image/audio"""
        pending = self.db.get_pending_media_students()
        
        if not pending:
            print("\n✅ No students waiting for media!")
            return
        
        print("\n" + "="*60)
        print(f"⏳ STUDENTS WAITING FOR MEDIA ({len(pending)})")
        print("="*60)
        
        for i, student in enumerate(pending, 1):
            print(f"\n{i}. {student.get('full_name', 'N/A')} ({student['student_id']})")
            print(f"   Course: {student['course']} | Year: {student['year']} | Section: {student['section']}")
            
            waiting = []
            if student['waiting_for']['image']:
                waiting.append("📸 Image")
            if student['waiting_for']['audio']:
                waiting.append("🎤 Audio")
            
            print(f"   Waiting for: {', '.join(waiting)}")
    
    def search_students(self):
        """Interactive student search"""
        print("\n" + "="*60)
        print("🔍 STUDENT SEARCH")
        print("="*60)
        
        query = input("\nEnter search query (name or ID): ").strip()
        
        if not query:
            print("❌ Please enter a search query")
            return
        
        # Optional filters
        print("\nOptional filters (press Enter to skip):")
        course = input("Course (e.g., BSCS): ").strip().upper() or None
        year = input("Year (1-4): ").strip() or None
        section = input("Section (A, B, C): ").strip().upper() or None
        
        filters = {}
        if course:
            filters['course'] = course
        if year:
            filters['year'] = year
        if section:
            filters['section'] = section
        
        # Search
        results = self.db.search_students(query=query, filters=filters)
        
        if not results:
            print("\n❌ No students found")
            return
        
        print(f"\n✅ Found {len(results)} student(s):")
        print("="*60)
        
        for i, student in enumerate(results, 1):
            print(f"\n{i}. {student.get('full_name', 'N/A')} (ID: {student['student_id']})")
            print(f"   Course: {student['course']} | Year: {student['year']} | Section: {student['section']}")
            print(f"   Department: {student['department']}")
            print(f"   Completion: {student['completion_percentage']:.1f}%")
            
            # Show media status
            image_status = student.get('image', {}).get('status', 'waiting')
            audio_status = student.get('audio', {}).get('status', 'waiting')
            print(f"   Media: 📸 {image_status} | 🎤 {audio_status}")
    
    def manual_entry(self):
        """Manual student entry"""
        print("\n" + "="*60)
        print("✍️  MANUAL STUDENT ENTRY")
        print("="*60)
        
        print("\nEnter student information:")
        student_data = {
            "student_id": input("Student ID: ").strip(),
            "surname": input("Surname: ").strip().title(),
            "first_name": input("First Name: ").strip().title(),
            "course": input("Course (e.g., BSCS): ").strip().upper(),
            "section": input("Section: ").strip().upper(),
            "year": input("Year (1-4): ").strip(),
            "contact_number": input("Contact Number: ").strip(),
            "guardian_name": input("Guardian Name: ").strip().title(),
            "guardian_contact": input("Guardian Contact: ").strip()
        }
        
        # Create full name
        if student_data['surname'] and student_data['first_name']:
            student_data['full_name'] = f"{student_data['surname']}, {student_data['first_name']}"
        
        # Detect department
        if student_data['course']:
            student_data['department'] = StudentDataExtractor.detect_department(student_data['course'])
        
        # Create record
        result = self.db.create_student_record(student_data, source="manual_input")
        
        if result:
            print(f"\n✅ Student {result} created successfully!")
            print("ℹ️  This student is now waiting for image and audio uploads")
        else:
            print("\n❌ Failed to create student record")
    
    def main_menu(self):
        """Display and handle main menu"""
        while True:
            print("\n" + "="*60)
            print("🎓 SCHOOL INFORMATION SYSTEM - MONGODB")
            print("="*60)
            print("\n1. Process Excel Files")
            print("2. Manual Student Entry")
            print("3. Search Students")
            print("4. Show Pending Media")
            print("5. Show Statistics")
            print("6. Clear All Data")
            print("7. Exit")
            
            choice = input("\nSelect option (1-7): ").strip()
            
            if choice == "1":
                self.scan_and_process_files()
            elif choice == "2":
                self.manual_entry()
            elif choice == "3":
                self.search_students()
            elif choice == "4":
                self.show_pending_media()
            elif choice == "5":
                self.show_statistics()
            elif choice == "6":
                self.clear_all_data()
            elif choice == "7":
                print("\n👋 Goodbye!")
                break
            elif choice =="8":
                import subprocess, sys
                from pathlib import Path

                ai_runner = Path(__file__).resolve().parent / "run_ai.py"
                if not ai_runner.exists():
                    print(f"❌ AI runner not found at {ai_runner}")
                else:
                    print("\n🚀 Launching AI Analyst terminal...\n")
                    subprocess.run([sys.executable, str(ai_runner)])
            else:
                print("\n❌ Invalid option. Please select 1-7")
            
            input("\nPress Enter to continue...")
    
    def run(self):
        """Main execution"""
        print("🎓 Starting School Information System...")
        print("="*60)
        
        try:
            # Show initial stats
            self.show_statistics()
            
            # Start main menu
            self.main_menu()
            
        except KeyboardInterrupt:
            print("\n\n👋 System shutdown requested")
        except Exception as e:
            print(f"\n❌ System error: {e}")
        finally:
            self.db.close()
            print("👋 Disconnected from MongoDB")

def main():
    """Entry point"""
    try:
        # You can change connection string here
        # For local MongoDB:
        system = SchoolInformationSystem()
        
        # For MongoDB Atlas:
        # system = SchoolInformationSystem("mongodb+srv://user:pass@cluster.mongodb.net/school_system")
        
        system.run()
        
    except Exception as e:
        print(f"❌ Failed to start system: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()