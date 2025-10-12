import pymongo
from pymongo import MongoClient
import pandas as pd
import os
from datetime import datetime, timezone, timezone
import hashlib
from pathlib import Path
import re
from enum import Enum

class FieldStatus(Enum):
    """Status of a field in the student record"""
    COMPLETE = "complete"
    WAITING = "waiting"
    MISSING = "missing"

class StudentDatabase:
    def __init__(self, connection_string=None, database_name="school_system"):
        """
        Initialize MongoDB connection
        
        Args:
            connection_string: MongoDB connection string
                - None: Will try localhost:27017 (default)
                - "mongodb://localhost:27017/": Local MongoDB
                - "mongodb+srv://user:pass@cluster.mongodb.net/": MongoDB Atlas
            database_name: Name of the database to use (default: "school_system")
        """
        if connection_string is None:
            connection_string = "mongodb://localhost:27017/"
        
        try:
            self.client = MongoClient(
                connection_string,
                serverSelectionTimeoutMS=5000  # 5 second timeout
            )
            # Test connection
            self.client.server_info()
            print("✅ Connected to MongoDB successfully")
        except Exception as e:
            print(f"❌ MongoDB Connection Error: {e}")
            print("\n💡 Troubleshooting:")
            print("   1. Make sure MongoDB is running:")
            print("      - Windows: net start MongoDB")
            print("      - Or run: mongod --dbpath C:\\data\\db")
            print("   2. Or use MongoDB Atlas (cloud): https://www.mongodb.com/cloud/atlas")
            raise
        self.db = self.client['school_system']
        self.students = self.db['students']
        self.pending_media = self.db['pending_media']  # Track students waiting for media
        
        # Create indexes for faster searching
        self._create_indexes()
    
    def _create_indexes(self):
        """Create indexes for efficient querying"""
        self.students.create_index([("student_id", pymongo.ASCENDING)], unique=True)
        self.students.create_index([("surname", pymongo.ASCENDING)])
        self.students.create_index([("first_name", pymongo.ASCENDING)])
        self.students.create_index([("course", pymongo.ASCENDING)])
        self.students.create_index([("section", pymongo.ASCENDING)])
        self.students.create_index([("year", pymongo.ASCENDING)])
        self.students.create_index([("department", pymongo.ASCENDING)])
        
        # Index for pending media tracking
        self.pending_media.create_index([("student_id", pymongo.ASCENDING)])
        self.pending_media.create_index([("status", pymongo.ASCENDING)])
    
    def create_student_record(self, data, source="file_extraction"):
        """
        Create a student record with field status tracking
        
        Args:
            data: dict with student information
            source: "file_extraction" or "manual_input"
        
        Returns:
            student_id or None if failed
        """
        try:
            # Base student document structure
            student_doc = {
                "student_id": data.get("student_id", ""),
                "surname": data.get("surname", ""),
                "first_name": data.get("first_name", ""),
                "full_name": data.get("full_name", ""),
                "course": data.get("course", ""),
                "section": data.get("section", ""),
                "year": data.get("year", ""),
                "contact_number": data.get("contact_number", ""),
                "guardian_name": data.get("guardian_name", ""),
                "guardian_contact": data.get("guardian_contact", ""),
                "department": data.get("department", ""),
                
                # Media fields
                "image": {
                    "data": data.get("image_data"),  # GridFS ID or base64
                    "filename": data.get("image_filename"),
                    "status": FieldStatus.WAITING.value if source == "file_extraction" else 
                             (FieldStatus.COMPLETE.value if data.get("image_data") else FieldStatus.WAITING.value)
                },
                "audio": {
                    "data": data.get("audio_data"),  # GridFS ID or base64
                    "filename": data.get("audio_filename"),
                    "status": FieldStatus.WAITING.value if source == "file_extraction" else 
                             (FieldStatus.COMPLETE.value if data.get("audio_data") else FieldStatus.WAITING.value)
                },
                
                # Field status tracking
                "field_status": self._determine_field_status(data, source),
                
                # Metadata
                "source": source,
                "created_at": datetime.now(timezone.utc),
                "updated_at": datetime.now(timezone.utc),
                "completion_percentage": self._calculate_completion(data, source)
            }
            
            # Insert or update
            result = self.students.update_one(
                {"student_id": student_doc["student_id"]},
                {"$set": student_doc},
                upsert=True
            )
            
            # Track in pending_media if media is waiting
            if student_doc["image"]["status"] == FieldStatus.WAITING.value or \
               student_doc["audio"]["status"] == FieldStatus.WAITING.value:
                self._add_to_pending_media(student_doc)
            
            print(f"✅ Student record created/updated: {student_doc['student_id']}")
            return student_doc["student_id"]
            
        except Exception as e:
            print(f"❌ Error creating student record: {e}")
            return None
    
    def _determine_field_status(self, data, source):
        """Determine the status of each field"""
        field_status = {}
        
        # Text fields
        text_fields = ["student_id", "surname", "first_name", "course", "section", "year"]
        
        for field in text_fields:
            value = data.get(field, "")
            if source == "manual_input":
                # Manual input: waiting if empty, complete if filled
                field_status[field] = FieldStatus.WAITING.value if not value else FieldStatus.COMPLETE.value
            else:
                # File extraction: complete if extracted, missing if not
                field_status[field] = FieldStatus.COMPLETE.value if value else FieldStatus.MISSING.value
        
        # Media fields are always waiting initially
        field_status["image"] = FieldStatus.WAITING.value
        field_status["audio"] = FieldStatus.WAITING.value
        
        return field_status
    
    def _calculate_completion(self, data, source):
        """Calculate completion percentage of the record"""
        total_fields = 8  # 6 text fields + 2 media fields
        completed = 0
        
        text_fields = ["student_id", "surname", "first_name", "course", "section", "year"]
        for field in text_fields:
            if data.get(field):
                completed += 1
        
        # Media fields count as incomplete initially
        if data.get("image_data"):
            completed += 1
        if data.get("audio_data"):
            completed += 1
        
        return (completed / total_fields) * 100
    
    def _add_to_pending_media(self, student_doc):
        """Add student to pending media queue"""
        pending_doc = {
            "student_id": student_doc["student_id"],
            "full_name": student_doc["full_name"],
            "course": student_doc["course"],
            "section": student_doc["section"],
            "year": student_doc["year"],
            "waiting_for": {
                "image": student_doc["image"]["status"] == FieldStatus.WAITING.value,
                "audio": student_doc["audio"]["status"] == FieldStatus.WAITING.value
            },
            "added_at": datetime.now(timezone.utc)
        }
        
        self.pending_media.update_one(
            {"student_id": student_doc["student_id"]},
            {"$set": pending_doc},
            upsert=True
        )
    
    def update_media(self, student_id, media_type, media_data, filename):
        """
        Update image or audio for a student
        
        Args:
            student_id: Student ID
            media_type: "image" or "audio"
            media_data: File data (GridFS ID or base64)
            filename: Original filename
        
        Returns:
            True if successful
        """
        try:
            update_data = {
                f"{media_type}.data": media_data,
                f"{media_type}.filename": filename,
                f"{media_type}.status": FieldStatus.COMPLETE.value,
                f"field_status.{media_type}": FieldStatus.COMPLETE.value,
                "updated_at": datetime.now(timezone.utc)
            }
            
            result = self.students.update_one(
                {"student_id": student_id},
                {"$set": update_data}
            )
            
            if result.modified_count > 0:
                # Recalculate completion
                self._update_completion_percentage(student_id)
                
                # Check if all media is complete
                self._check_pending_media_complete(student_id)
                
                print(f"✅ Updated {media_type} for student {student_id}")
                return True
            else:
                print(f"⚠️ Student {student_id} not found")
                return False
                
        except Exception as e:
            print(f"❌ Error updating media: {e}")
            return False
    
    def _update_completion_percentage(self, student_id):
        """Recalculate and update completion percentage"""
        student = self.students.find_one({"student_id": student_id})
        if not student:
            return
        
        total_fields = 8
        completed = 0
        
        # Count completed text fields
        text_fields = ["student_id", "surname", "first_name", "course", "section", "year"]
        for field in text_fields:
            if student.get(field):
                completed += 1
        
        # Count completed media fields
        if student.get("image", {}).get("status") == FieldStatus.COMPLETE.value:
            completed += 1
        if student.get("audio", {}).get("status") == FieldStatus.COMPLETE.value:
            completed += 1
        
        completion = (completed / total_fields) * 100
        
        self.students.update_one(
            {"student_id": student_id},
            {"$set": {"completion_percentage": completion}}
        )
    
    def _check_pending_media_complete(self, student_id):
        """Check if student has completed all pending media"""
        student = self.students.find_one({"student_id": student_id})
        if not student:
            return
        
        image_complete = student.get("image", {}).get("status") == FieldStatus.COMPLETE.value
        audio_complete = student.get("audio", {}).get("status") == FieldStatus.COMPLETE.value
        
        if image_complete and audio_complete:
            # Remove from pending queue
            self.pending_media.delete_one({"student_id": student_id})
            print(f"🎉 Student {student_id} completed all media requirements")
    
    def get_pending_media_students(self):
        """Get all students waiting for media uploads"""
        return list(self.pending_media.find())
    
    def search_students(self, query=None, filters=None):
        """
        Search students with flexible filters
        
        Args:
            query: Text search query (searches name fields)
            filters: Dict of field:value filters
        
        Returns:
            List of matching student documents
        """
        search_filter = {}
        
        # Text search
        if query:
            search_filter["$or"] = [
                {"surname": {"$regex": query, "$options": "i"}},
                {"first_name": {"$regex": query, "$options": "i"}},
                {"full_name": {"$regex": query, "$options": "i"}},
                {"student_id": {"$regex": query, "$options": "i"}}
            ]
        
        # Apply additional filters
        if filters:
            for key, value in filters.items():
                if key == "year":
                    search_filter[key] = str(value)
                else:
                    search_filter[key] = value
        
        return list(self.students.find(search_filter))
    
    def get_student_by_id(self, student_id):
        """Get a specific student by ID"""
        return self.students.find_one({"student_id": student_id})
    
    def get_statistics(self):
        """Get system statistics"""
        total_students = self.students.count_documents({})
        pending_media = self.pending_media.count_documents({})
        
        # Average completion
        pipeline = [
            {"$group": {
                "_id": None,
                "avg_completion": {"$avg": "$completion_percentage"}
            }}
        ]
        avg_result = list(self.students.aggregate(pipeline))
        avg_completion = avg_result[0]["avg_completion"] if avg_result else 0
        
        # By department
        dept_pipeline = [
            {"$group": {
                "_id": "$department",
                "count": {"$sum": 1}
            }}
        ]
        by_dept = list(self.students.aggregate(dept_pipeline))
        
        return {
            "total_students": total_students,
            "pending_media": pending_media,
            "average_completion": round(avg_completion, 2),
            "by_department": {dept["_id"]: dept["count"] for dept in by_dept}
        }
    
    def view_all_students(self, limit=50):
        """View all students with pagination"""
        cursor = self.students.find().limit(limit)
        return list(cursor)
    
    def view_student_details(self, student_id):
        """View detailed information for a specific student"""
        return self.students.find_one({"student_id": student_id})
    
    def export_to_dict(self):
        """Export all data as dictionary for viewing"""
        return {
            "students": list(self.students.find()),
            "pending_media": list(self.pending_media.find())
        }
    
    def clear_all_data(self):
        """Clear all student data"""
        self.students.delete_many({})
        self.pending_media.delete_many({})
        print("🗑️ All data cleared")
    
    def close(self):
        """Close MongoDB connection"""
        self.client.close()


class StudentDataExtractor:
    """Extract student data from Excel files"""
    
    @staticmethod
    def process_excel(file_path, db):
        """Process Excel file and create student records"""
        try:
            df = pd.read_excel(file_path)
            
            # Column mapping (same as before)
            column_mapping = {
                'student id': 'student_id',
                'id no': 'student_id',
                'id': 'student_id',
                'full name': 'full_name',
                'name': 'full_name',
                'surname': 'surname',
                'first name': 'first_name',
                'year': 'year',
                'course': 'course',
                'section': 'section',
                'contact number': 'contact_number',
                'guardian name': 'guardian_name',
                'guardian contact': 'guardian_contact'
            }
            
            # Standardize columns
            df.columns = [str(col).lower().strip() for col in df.columns]
            
            processed_count = 0
            
            for index, row in df.iterrows():
                student_data = {}
                
                # Extract data
                for col_header, data_key in column_mapping.items():
                    if col_header in df.columns and col_header in row.index and pd.notna(row[col_header]):
                        raw_value = str(row[col_header]).strip()
                        if raw_value and raw_value.lower() not in ['nan', '', 'null']:
                            student_data[data_key] = StudentDataExtractor.clean_value(raw_value, data_key)
                
                # Detect department
                if student_data.get('course'):
                    student_data['department'] = StudentDataExtractor.detect_department(student_data['course'])
                
                # Create full name if missing
                if not student_data.get('full_name') and student_data.get('surname') and student_data.get('first_name'):
                    student_data['full_name'] = f"{student_data['surname']}, {student_data['first_name']}"
                
                # Only process if essential data exists
                if student_data.get('student_id') or student_data.get('full_name'):
                    result = db.create_student_record(student_data, source="file_extraction")
                    if result:
                        processed_count += 1
            
            print(f"📊 Processed {processed_count} students from Excel")
            return processed_count > 0
            
        except Exception as e:
            print(f"❌ Error processing Excel: {e}")
            return False
    
    @staticmethod
    def clean_value(value, field_type):
        """Clean extracted values"""
        if not value:
            return None
        
        value = value.strip()
        
        if field_type == 'student_id':
            return re.sub(r'[^A-Z0-9-]', '', value.upper())
        elif field_type in ['contact_number', 'guardian_contact']:
            cleaned = re.sub(r'[^\d\+]', '', value)
            return cleaned if 7 <= len(cleaned) <= 15 else None
        elif field_type in ['full_name', 'guardian_name', 'surname', 'first_name']:
            return re.sub(r'[^A-Za-z\s\.,-]', '', value).title()
        elif field_type == 'year':
            year_match = re.search(r'([1-4])', value)
            return year_match.group(1) if year_match else None
        elif field_type in ['course', 'section']:
            return re.sub(r'[^A-Z0-9]', '', value.upper())
        
        return value
    
    @staticmethod
    def detect_department(course_code):
        """Detect department from course code"""
        if not course_code:
            return 'UNKNOWN'
        
        course_upper = str(course_code).upper().strip()
        
        known_courses = {
            'CCS': ['BSCS', 'BSIT'],
            'CHTM': ['BSHM', 'BSTM'],
            'CBA': ['BSBA', 'BSOA'],
            'CTE': ['BECED', 'BTLE']
        }
        
        for dept, courses in known_courses.items():
            if course_upper in courses:
                return dept
        
        return 'UNKNOWN'


# Example usage
if __name__ == "__main__":
    # Initialize database
    try:
        # Option 1: Local MongoDB (default)
        db = StudentDatabase()
        
        # Option 2: MongoDB Atlas (cloud)
        # db = StudentDatabase("mongodb+srv://username:password@cluster.mongodb.net/school_system")
        
        # Option 3: Custom local connection
        # db = StudentDatabase("mongodb://localhost:27017/")
    except Exception as e:
        print("\n⚠️ Cannot connect to MongoDB. Please start MongoDB first.")
        print("Run: mongod --dbpath C:\\data\\db")
        exit(1)
    
    # Example 1: Process Excel file (file extraction - image/audio waiting)
    print("\n📁 Processing Excel file...")
    excel_path = "students.xlsx"
    if os.path.exists(excel_path):
        StudentDataExtractor.process_excel(excel_path, db)
    else:
        print(f"⚠️ Excel file not found: {excel_path}")
        print("   Place your Excel file in the same directory or update the path")
    
    # Example 2: Manual student input (all fields waiting if empty)
    print("\n✍️ Manual student entry...")
    manual_student = {
        "student_id": "2024-0001",
        "surname": "Dela Cruz",
        "first_name": "Juan",
        "full_name": "Dela Cruz, Juan",  # Added full_name
        "course": "BSCS",
        "section": "A",
        "year": "3",
        "department": "CCS"  # Added department
    }
    db.create_student_record(manual_student, source="manual_input")
    
    # Example 3: Add media later
    print("\n📸 Adding student image...")
    # In real implementation, you'd read actual file
    db.update_media("2024-0001", "image", "base64_or_gridfs_id", "juan_photo.jpg")
    
    # Example 4: Get pending media students
    print("\n⏳ Students waiting for media:")
    pending = db.get_pending_media_students()
    for student in pending:
        print(f"  - {student.get('full_name', 'N/A')} ({student['student_id']})")
        print(f"    Waiting: Image={student['waiting_for']['image']}, Audio={student['waiting_for']['audio']}")
    
    # Example 5: Search
    print("\n🔍 Search results:")
    results = db.search_students(query="Cruz", filters={"course": "BSCS"})
    for student in results:
        print(f"  - {student.get('full_name', 'N/A')} - {student['completion_percentage']:.1f}% complete")
    
    # Statistics
    stats = db.get_statistics()
    print(f"\n📊 System Statistics:")
    print(f"  Total Students: {stats['total_students']}")
    print(f"  Pending Media: {stats['pending_media']}")
    print(f"  Avg Completion: {stats['average_completion']:.1f}%")
    print(f"  By Department: {stats['by_department']}")
    
    db.close()