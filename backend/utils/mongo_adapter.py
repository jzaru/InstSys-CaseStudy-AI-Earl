from pymongo import MongoClient

class MongoCollectionAdapter:
    def __init__(self, db, collection_name):
        self.collection = db[collection_name]

    def get(self, where=None, include=None):
        query = {}
        if where:
            # Convert your `$or`, `$in`, `$eq` logic to MongoDB syntax
            query = self._translate_filters(where)
        docs = list(self.collection.find(query, limit=1000))
        return {
            "ids": [str(d["_id"]) for d in docs],
            "metadatas": docs,
            "documents": [d.get("content", "") for d in docs]
        }

    def peek(self, limit=3):
        docs = list(self.collection.find({}, limit=limit))
        return {"metadatas": docs}

    def count(self):
        return self.collection.count_documents({})
    
    def _translate_filters(self, filters):
        # You can map the pseudo-operators used in your code ($or, $in, etc.)
        # into MongoDB equivalents. This can start simple:
        return filters
