# backend/utils/run_ai_automatic_QA.py
import sys
import json
import time
import inspect
from datetime import datetime, timezone
from pathlib import Path
import os
from typing import List, Dict
import uuid

# --- Exception placeholder you can expand later --------------------------------
class CustomPlaceholderError(Exception):
    """
    Placeholder for future, more specific exceptions you want to raise.
    Replace usages of this with more concrete exception types as needed.
    """
    pass
# -------------------------------------------------------------------------------

# Change the working directory to the project's root
# This ensures that relative paths like "config/config.json" work correctly.
os.chdir(Path(__file__).resolve().parents[1])

# Add the current directory to the system path to allow importing AI.py
sys.path.append(str(Path(__file__).resolve().parent))

from ai_core import AIAnalyst
from read_query import QueryReader


def load_config(config_path: Path) -> dict:
    if not config_path.exists():
        print(f"❌ FATAL: Config file not found at {config_path.resolve()}")
        # Keep a placeholder raise so callers can handle it differently if needed
        raise CustomPlaceholderError("Config file missing. Please create config/config.json.")
    with open(config_path, "r", encoding="utf-8") as f:
        return json.load(f)


def get_mongo_params(config: dict):
    """
    Resolve MongoDB connection params in this priority order:
      1) config["mongo_uri"], config["mongo_db"]
      2) ENV MONGO_URI, MONGO_DB
      3) (optional) very last-resort sensible defaults
    """
    mongo_uri = config.get("mongo_uri") or os.getenv("MONGO_URI")
    mongo_db = config.get("mongo_db") or os.getenv("MONGO_DB")

    if not mongo_uri or not mongo_db:
        # Last-resort defaults (safe to override)
        mongo_uri = mongo_uri or "mongodb://localhost:27017"
        mongo_db = mongo_db or "school_system"

    return mongo_uri, mongo_db


def list_all_collections(config: dict):
    """
    Return all collection names in the configured MongoDB database.
    Honors optional allow/deny lists:
      - config["collections_whitelist"]: list[str]
      - config["collections_blacklist"]: list[str]
    Falls back to a static list if discovery fails.
    """
    try:
        from pymongo import MongoClient  # lazy import to avoid hard dependency during tooling
    except Exception as e:
        print(f"⚠️ pymongo not available ({e}). Falling back to static collections.")
        return ["students_ccs", "schedules_ccs"]

    mongo_uri, mongo_db = get_mongo_params(config)

    try:
        client = MongoClient(mongo_uri, serverSelectionTimeoutMS=4000)
        db = client[mongo_db]

        # Touch server to fail fast if unreachable
        _ = client.admin.command("ping")

        discovered = db.list_collection_names()

        # Filter out system/internal collections just in case
        discovered = [c for c in discovered if not c.startswith("system.")]

        # Apply optional whitelist/blacklist from config
        whitelist = set(config.get("collections_whitelist") or [])
        blacklist = set(config.get("collections_blacklist") or ["query_log", "sessions", "dynamic_examples", "pending_media"])

        if whitelist:
            discovered = [c for c in discovered if c in whitelist]
        if blacklist:
            discovered = [c for c in discovered if c not in blacklist]

        if not discovered:
            print("⚠️ No user collections discovered; falling back to static defaults.")
            return ["students_ccs", "schedules_ccs"]

        return sorted(discovered)

    except Exception as e:
        print(f"⚠️ Could not discover collections from MongoDB: {e}")
        print("   Falling back to static defaults.")
        return ["students_ccs", "schedules_ccs"]


def process_queries_sequentially(ai: AIAnalyst) -> List[Dict]:
    """Process queries one at a time from QA.json"""
    query_reader = QueryReader()
    results = []
    # Create or fetch a full session object using AIAnalyst helper to avoid KeyError
    try:
        session_id = f"auto_{uuid.uuid4()}"
        if hasattr(ai, '_get_or_create_session'):
            session = ai._get_or_create_session(session_id)
        else:
            session = {"session_id": session_id, "mentioned_entities": []}
    except Exception:
        session = {"session_id": f"auto_{int(time.time())}", "mentioned_entities": []}
    
    try:
        queries = query_reader.load_queries()
        total = len(queries)
        
        print(f"\n📝 Will process {total} queries sequentially...")
        
        for idx, query_data in enumerate(queries, 1):
            query_id = query_data['id']
            query_text = query_data['query']
            
            print(f"\n[{idx}/{total}] Processing Query {query_id}: '{query_text}'")
            
            try:
                # Record a start timestamp to identify the log entry for this query
                start_log_time = datetime.now(timezone.utc)

                # Call the exact same query processing method that run_ai.py uses
                response, _, _ = ai.execute_reasoning_plan(query_text, session)

                # Wait until the result is recorded in MongoDB 'query_log' collection
                logged = False
                wait_start = time.time()
                timeout = 60.0  # seconds

                if hasattr(ai, 'training_system') and getattr(ai.training_system, 'log_collection', None) is not None:
                    log_coll = ai.training_system.log_collection
                    # Poll until a matching document appears with timestamp >= start_log_time
                    while time.time() - wait_start < timeout:
                        try:
                            doc = log_coll.find_one({
                                'query': query_text,
                                'timestamp': {'$gte': start_log_time}
                            })
                            if doc:
                                logged = True
                                break
                        except Exception:
                            # If the DB momentarily fails, keep retrying until timeout
                            pass
                        time.sleep(0.5)
                else:
                    # If training_system or log_collection is not available, assume the call completed
                    logged = True

                if logged:
                    print(f"✅ Query {query_id} completed and logged to query_log")
                    results.append({
                        "id": query_id,
                        "query": query_text,
                        "response": response,
                        "status": "success"
                    })
                else:
                    raise Exception("Query did not appear in query_log within timeout period")

            except Exception as e:
                print(f"⚠️ Error processing query {query_id}: {str(e)}")
                results.append({
                    "id": query_id,
                    "query": query_text,
                    "error": str(e),
                    "status": "error"
                })
            
            # Save progress after each query
            output_file = Path(__file__).parent / "query_results.json"
            with open(output_file, "w", encoding="utf-8") as f:
                json.dump({"results": results}, f, indent=2)
                
            print(f"💾 Progress saved to {output_file}")
            time.sleep(2)  # Small delay between queries
            
        print(f"\n🎉 All {total} queries have been processed!")
        
    except FileNotFoundError:
        print("❌ QA.json file not found in utils directory")
    except Exception as e:
        print(f"❌ Error running queries: {str(e)}")
        
    return results


def main():
    """
    Initializes and runs the AI Analyst with automated queries.
    """
    config_path = Path("config/config.json")  # Use a relative path from the new working directory

    # 1) Load configuration
    try:
        config = load_config(config_path)
    except CustomPlaceholderError:
        # Already printed a helpful message in load_config; just stop gracefully.
        return

    # 2) Resolve execution mode
    execution_mode = config.get("execution_mode", "split")

    # 3) Discover all collections dynamically (with fallbacks)
    collections = list_all_collections(config)
    print("\n🗂️  MongoDB collections to be used:", collections)

    print("\n🚀 Starting AI Analyst (now using MongoDB)...")

    # 4) Create the AIAnalyst instance, providing all required arguments
    ai = AIAnalyst(collections=collections, llm_config=config, execution_mode=execution_mode)

    # 5) Process queries sequentially
    process_queries_sequentially(ai)


if __name__ == "__main__":
    main()
