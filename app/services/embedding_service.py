import cohere
import os

def get_embeddings(texts):
    """Embeds documents for storage."""
    api_key = os.getenv('COHERE_API_KEY')
    co = cohere.Client(api_key)
    response = co.embed(
        texts=texts,
        model='embed-english-v3.0',
        input_type='search_document'
    )
    return response.embeddings

def get_query_embedding(text):
    """Embeds a single user query for searching."""
    api_key = os.getenv('COHERE_API_KEY')
    co = cohere.Client(api_key)
    response = co.embed(
        texts=[text],
        model='embed-english-v3.0',
        input_type='search_query'
    )
    return response.embeddings[0]