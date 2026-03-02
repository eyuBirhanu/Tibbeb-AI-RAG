import json
import os
import uuid

SESSION_DIR = 'sessions'

os.makedirs(SESSION_DIR, exist_ok=True)

def create_session():
    """Creates a new session ID and an empty history file."""
    session_id = str(uuid.uuid4())
    filepath = os.path.join(SESSION_DIR, f"{session_id}.json")
    with open(filepath, 'w') as f:
        json.dump([], f)
    return session_id

def add_message(session_id, role, content):
    """Adds a message to history. Recreates file if cloud server wiped it."""
    filepath = os.path.join(SESSION_DIR, f"{session_id}.json")
    
    if not os.path.exists(filepath):
        with open(filepath, 'w') as f:
            json.dump([], f)
        
    with open(filepath, 'r') as f:
        try:
            history = json.load(f)
        except json.JSONDecodeError:
            history = []
        
    history.append({"role": role, "content": content})
    
    with open(filepath, 'w') as f:
        json.dump(history, f)

def get_history(session_id):
    """Retrieves history. Returns empty list if file was wiped."""
    filepath = os.path.join(SESSION_DIR, f"{session_id}.json")
    
    if not os.path.exists(filepath):
        return []
        
    with open(filepath, 'r') as f:
        try:
            return json.load(f)
        except json.JSONDecodeError:
            return []

def clear_session(session_id):
    """Wipes the chat history."""
    filepath = os.path.join(SESSION_DIR, f"{session_id}.json")
    with open(filepath, 'w') as f:
        json.dump([], f)