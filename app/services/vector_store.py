from pinecone import Pinecone
import os
import uuid

def upsert_to_pinecone(chunks, embeddings, session_id):
    """Uploads vectors and tags them with the user's session_id."""
    api_key = os.getenv('PINECONE_API_KEY')
    index_name = os.getenv('PINECONE_INDEX_NAME', 'lucy-rag-index')
    pc = Pinecone(api_key=api_key)
    index = pc.Index(index_name)
    
    vectors =[]
    for chunk, emb in zip(chunks, embeddings):
        vector_id = str(uuid.uuid4())
        # We add session_id to the metadata!
        metadata = {
            "text": chunk["text"], 
            "page": chunk["page"],
            "session_id": session_id 
        }
        vectors.append((vector_id, emb, metadata))
        
    batch_size = 100
    for i in range(0, len(vectors), batch_size):
        batch = vectors[i:i + batch_size]
        index.upsert(vectors=batch)
    return len(vectors)

def query_pinecone(query_embedding, session_id, top_k=10):
    """Searches Pinecone ONLY for chunks belonging to this session."""
    api_key = os.getenv('PINECONE_API_KEY')
    index_name = os.getenv('PINECONE_INDEX_NAME', 'lucy-rag-index')
    pc = Pinecone(api_key=api_key)
    index = pc.Index(index_name)
    
    # Filter by session_id so users don't see each other's documents
    result = index.query(
        vector=query_embedding,
        top_k=top_k,
        include_metadata=True,
        filter={"session_id": {"$eq": session_id}}
    )
    
    contexts = []
    for match in result['matches']:
        if match['score'] > 0.2: 
            contexts.append({
                "text": match['metadata']['text'],
                "page": match['metadata']['page'],
                "score": match['score']
            })
    return contexts

def delete_pinecone_data(session_id):
    """Deletes all vectors for a specific session to save space."""
    api_key = os.getenv('PINECONE_API_KEY')
    index_name = os.getenv('PINECONE_INDEX_NAME', 'lucy-rag-index')
    pc = Pinecone(api_key=api_key)
    index = pc.Index(index_name)
    
    try:
        # Delete all vectors that match this session_id
        index.delete(filter={"session_id": {"$eq": session_id}})
        return True
    except Exception as e:
        print(f"Error deleting from Pinecone: {e}")
        return False