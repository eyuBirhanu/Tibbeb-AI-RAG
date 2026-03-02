from flask import Blueprint, jsonify, request, render_template
import os
from werkzeug.utils import secure_filename

from app.services.document_processor import extract_and_chunk_pdf
from app.services.embedding_service import get_embeddings, get_query_embedding
from app.services.vector_store import upsert_to_pinecone, query_pinecone, delete_pinecone_data
from app.services.llm_service import generate_answer
from app.services.memory_manager import create_session, add_message, get_history, clear_session

main = Blueprint('main', __name__)

@main.route('/')
def home():
    return render_template('index.html')

@main.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({"status": "success", "message": "API is up and running!"}), 200

@main.route('/api/session', methods=['POST'])
def new_session():
    try:
        session_id = create_session()
        return jsonify({"status": "success", "session_id": session_id}), 200
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@main.route('/api/upload', methods=['POST'])
def upload_pdf():
    session_id = request.form.get('session_id')
    if not session_id:
        return jsonify({"status": "error", "message": "session_id is required"}), 400

    if 'file' not in request.files:
        return jsonify({"status": "error", "message": "No file part"}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({"status": "error", "message": "No selected file"}), 400
        
    try:
        # 1. Save File
        filename = secure_filename(file.filename)
        filepath = os.path.join('uploads', filename)
        file.save(filepath)
        
        # 2. Process & Embed
        chunks = extract_and_chunk_pdf(filepath)
        texts = [chunk["text"] for chunk in chunks]
        embeddings = get_embeddings(texts)
        
        # 3. Store in Pinecone WITH session_id
        total_upserted = upsert_to_pinecone(chunks, embeddings, session_id)
        
        os.remove(filepath)
        return jsonify({
            "status": "success", 
            "message": f"Successfully processed and secured {total_upserted} chunks for this session.",
            "filename": filename
        }), 200
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@main.route('/api/chat', methods=['POST'])
def chat():
    data = request.json
    session_id = data.get('session_id')
    user_message = data.get('message')
    
    if not session_id or not user_message:
        return jsonify({"status": "error", "message": "session_id and message are required"}), 400
        
    try:
        query_embedding = get_query_embedding(user_message)
        
        # Pass session_id to only search THIS user's document
        contexts = query_pinecone(query_embedding, session_id, top_k=10)
        history = get_history(session_id)
        answer = generate_answer(user_message, contexts, history)
        
        add_message(session_id, "user", user_message)
        add_message(session_id, "assistant", answer)
        
        return jsonify({
            "status": "success",
            "answer": answer,
            "sources": [{"page": c["page"]} for c in contexts]
        }), 200
    except Exception as e:
        print(f"Chat error: {str(e)}")
        return jsonify({"status": "error", "message": str(e)}), 500

@main.route('/api/clear', methods=['POST'])
def clear_data():
    """Deletes document vectors and chat history for a session."""
    data = request.json
    session_id = data.get('session_id')
    
    if not session_id:
        return jsonify({"status": "error", "message": "session_id required"}), 400
        
    try:
        delete_pinecone_data(session_id)
        clear_session(session_id)
        return jsonify({"status": "success", "message": "Session memory and documents cleared."}), 200
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500


@main.route('/api/history/<session_id>', methods=['GET'])
def get_session_history(session_id):
    """Fetches the chat history for a returning user."""
    try:
        history = get_history(session_id)
        return jsonify({"status": "success", "history": history}), 200
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500