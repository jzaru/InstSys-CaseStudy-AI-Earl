import json
from pathlib import Path
from typing import Dict, Any, List

class QueryReader:
    def __init__(self, query_file: str = "QA.json"):
        self.query_file = Path(__file__).parent / query_file
        
    def load_queries(self) -> List[Dict[str, Any]]:
        """Load queries from JSON file"""
        if not self.query_file.exists():
            raise FileNotFoundError(f"Query file not found: {self.query_file}")
            
        with open(self.query_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
            return data.get('queries', [])
            
    def get_query_by_id(self, query_id: int) -> Dict[str, Any]:
        """Get a specific query by ID"""
        queries = self.load_queries()
        for query in queries:
            if query['id'] == query_id:
                return query
        return None