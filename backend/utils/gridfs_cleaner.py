"""
GridFS Storage Manager & Cleaner
Clean up orphaned files and manage GridFS storage
"""

from pymongo import MongoClient
import gridfs
from bson.objectid import ObjectId

class GridFSManager:
    def __init__(self, connection_string=None, database_name="school_system"):
        """Initialize GridFS manager"""
        if connection_string is None:
            connection_string = "mongodb://localhost:27017/"
        
        self.client = MongoClient(connection_string)
        self.db = self.client[database_name]
        self.fs = gridfs.GridFS(self.db)
        self.students = self.db['students']
        
        print("✅ GridFS Manager initialized")
    
    def show_storage_stats(self):
        """Show GridFS storage statistics"""
        print("\n" + "="*70)
        print("💾 GRIDFS STORAGE STATISTICS")
        print("="*70)
        
        # Count files
        total_files = self.db['fs.files'].count_documents({})
        total_chunks = self.db['fs.chunks'].count_documents({})
        
        # Calculate total size
        pipeline = [
            {"$group": {
                "_id": None,
                "total_size": {"$sum": "$length"}
            }}
        ]
        result = list(self.db['fs.files'].aggregate(pipeline))
        total_size = result[0]['total_size'] if result else 0
        
        # Count by student
        students_with_images = self.students.count_documents({
            "image.data": {"$exists": True, "$ne": None}
        })
        
        students_with_audio = self.students.count_documents({
            "audio.data": {"$exists": True, "$ne": None}
        })
        
        print(f"\nFiles:")
        print(f"  Total GridFS Files: {total_files}")
        print(f"  Total Chunks: {total_chunks}")
        print(f"  Total Size: {total_size / 1024 / 1024:.2f} MB")
        
        print(f"\nUsage:")
        print(f"  Students with Images: {students_with_images}")
        print(f"  Students with Audio: {students_with_audio}")
        
        # Show file breakdown
        files = list(self.db['fs.files'].find())
        if files:
            print(f"\nFile Details:")
            for i, file in enumerate(files[:10], 1):  # Show first 10
                size_kb = file.get('length', 0) / 1024
                print(f"  {i}. {file.get('filename', 'unknown')} - {size_kb:.2f} KB")
            
            if len(files) > 10:
                print(f"  ... and {len(files) - 10} more files")
    
    def list_all_gridfs_files(self):
        """List all files in GridFS"""
        files = list(self.db['fs.files'].find())
        
        if not files:
            print("\n✅ GridFS is empty")
            return []
        
        print("\n" + "="*70)
        print(f"📁 ALL GRIDFS FILES ({len(files)})")
        print("="*70)
        
        for i, file in enumerate(files, 1):
            file_id = file['_id']
            filename = file.get('filename', 'unknown')
            student_id = file.get('student_id', 'N/A')
            size_kb = file.get('length', 0) / 1024
            upload_date = file.get('uploadDate', 'unknown')
            
            print(f"\n{i}. {filename}")
            print(f"   ID: {file_id}")
            print(f"   Student: {student_id}")
            print(f"   Size: {size_kb:.2f} KB")
            print(f"   Uploaded: {upload_date}")
        
        return files
    
    def find_orphaned_files(self):
        """Find GridFS files not linked to any student"""
        print("\n" + "="*70)
        print("🔍 SEARCHING FOR ORPHANED FILES")
        print("="*70)
        
        all_gridfs_files = list(self.db['fs.files'].find())
        
        if not all_gridfs_files:
            print("\n✅ No GridFS files found")
            return []
        
        print(f"\nFound {len(all_gridfs_files)} GridFS file(s)")
        print("Checking for orphans...")
        
        orphaned = []
        
        for file in all_gridfs_files:
            file_id = str(file['_id'])
            filename = file.get('filename', 'unknown')
            
            # Check if any student references this file
            image_ref = self.students.find_one({"image.data": file_id})
            audio_ref = self.students.find_one({"audio.data": file_id})
            
            if not image_ref and not audio_ref:
                orphaned.append({
                    'id': file['_id'],
                    'filename': filename,
                    'size': file.get('length', 0),
                    'upload_date': file.get('uploadDate')
                })
        
        if orphaned:
            print(f"\n⚠️  Found {len(orphaned)} orphaned file(s):")
            for i, orphan in enumerate(orphaned, 1):
                size_kb = orphan['size'] / 1024
                print(f"  {i}. {orphan['filename']} ({size_kb:.2f} KB)")
                print(f"     ID: {orphan['id']}")
        else:
            print("\n✅ No orphaned files found - all files are properly linked")
        
        return orphaned
    
    def clean_orphaned_files(self, confirm=True):
        """Delete orphaned GridFS files"""
        orphaned = self.find_orphaned_files()
        
        if not orphaned:
            return
        
        print(f"\n{'='*70}")
        
        if confirm:
            response = input(f"\n⚠️  Delete {len(orphaned)} orphaned file(s)? (yes/no): ").strip().lower()
            if response != 'yes':
                print("❌ Operation cancelled")
                return
        
        print("\n🗑️  Deleting orphaned files...")
        
        deleted_count = 0
        for orphan in orphaned:
            try:
                self.fs.delete(orphan['id'])
                print(f"✅ Deleted: {orphan['filename']}")
                deleted_count += 1
            except Exception as e:
                print(f"❌ Failed to delete {orphan['filename']}: {e}")
        
        print(f"\n{'='*70}")
        print(f"✅ Deleted {deleted_count}/{len(orphaned)} orphaned file(s)")
        print("="*70)
    
    def delete_all_gridfs_files(self, confirm=True):
        """Delete ALL files from GridFS (nuclear option)"""
        total_files = self.db['fs.files'].count_documents({})
        
        if total_files == 0:
            print("\n✅ GridFS is already empty")
            return
        
        print(f"\n{'='*70}")
        print("⚠️  WARNING: NUCLEAR OPTION")
        print("="*70)
        print(f"\nThis will delete ALL {total_files} files from GridFS")
        print("This includes files linked to students!")
        print("\nStudent image/audio references will become invalid.")
        
        if confirm:
            response = input(f"\n⚠️  Are you SURE? Type 'DELETE ALL' to confirm: ").strip()
            if response != 'DELETE ALL':
                print("❌ Operation cancelled")
                return
        
        print("\n🗑️  Deleting all GridFS files...")
        
        # Delete all files
        files = list(self.db['fs.files'].find())
        deleted_count = 0
        
        for file in files:
            try:
                self.fs.delete(file['_id'])
                deleted_count += 1
            except Exception as e:
                print(f"❌ Error deleting {file.get('filename')}: {e}")
        
        print(f"\n✅ Deleted {deleted_count}/{total_files} files")
        
        # Also update student records to reflect missing media
        print("\n🔄 Updating student records...")
        result = self.students.update_many(
            {},
            {
                "$set": {
                    "image.data": None,
                    "image.status": "waiting",
                    "audio.data": None,
                    "audio.status": "waiting"
                }
            }
        )
        print(f"✅ Updated {result.modified_count} student record(s)")
    
    def delete_student_media(self, student_id):
        """Delete media for a specific student"""
        student = self.students.find_one({"student_id": student_id})
        
        if not student:
            print(f"❌ Student {student_id} not found")
            return
        
        print(f"\n🗑️  Deleting media for student: {student_id}")
        
        deleted = []
        
        # Delete image
        image_data = student.get('image', {}).get('data')
        if image_data:
            try:
                self.fs.delete(ObjectId(image_data))
                deleted.append("image")
                print(f"✅ Deleted image")
            except Exception as e:
                print(f"❌ Failed to delete image: {e}")
        
        # Delete audio
        audio_data = student.get('audio', {}).get('data')
        if audio_data:
            try:
                self.fs.delete(ObjectId(audio_data))
                deleted.append("audio")
                print(f"✅ Deleted audio")
            except Exception as e:
                print(f"❌ Failed to delete audio: {e}")
        
        # Update student record
        if deleted:
            update = {}
            if "image" in deleted:
                update["image.data"] = None
                update["image.status"] = "waiting"
            if "audio" in deleted:
                update["audio.data"] = None
                update["audio.status"] = "waiting"
            
            self.students.update_one(
                {"student_id": student_id},
                {"$set": update}
            )
            print(f"✅ Updated student record")
        else:
            print(f"ℹ️  No media found for this student")
    
    def close(self):
        """Close connection"""
        self.client.close()


def interactive_menu():
    """Interactive GridFS management menu"""
    print("="*70)
    print("💾 GRIDFS STORAGE MANAGER")
    print("="*70)
    
    manager = GridFSManager()
    
    while True:
        print(f"\n{'='*70}")
        print("OPTIONS:")
        print("1. Show Storage Statistics")
        print("2. List All GridFS Files")
        print("3. Find Orphaned Files")
        print("4. Clean Orphaned Files")
        print("5. Delete Student's Media")
        print("6. Delete ALL GridFS Files (Nuclear)")
        print("7. Exit")
        print("="*70)
        
        choice = input("\nSelect option (1-7): ").strip()
        
        if choice == "1":
            manager.show_storage_stats()
            
        elif choice == "2":
            manager.list_all_gridfs_files()
            
        elif choice == "3":
            manager.find_orphaned_files()
            
        elif choice == "4":
            manager.clean_orphaned_files()
            
        elif choice == "5":
            student_id = input("\nEnter Student ID: ").strip()
            confirm = input(f"Delete media for {student_id}? (yes/no): ").strip().lower()
            if confirm == 'yes':
                manager.delete_student_media(student_id)
            else:
                print("❌ Operation cancelled")
            
        elif choice == "6":
            manager.delete_all_gridfs_files()
            
        elif choice == "7":
            print("\n👋 Goodbye!")
            break
            
        else:
            print("❌ Invalid option")
        
        input("\nPress Enter to continue...")
    
    manager.close()


if __name__ == "__main__":
    try:
        interactive_menu()
    except KeyboardInterrupt:
        print("\n\n👋 Exiting...")
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()