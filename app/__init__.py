from flask import Flask
from flask_cors import CORS
import os

def create_app():
    app = Flask(__name__, template_folder='templates', static_folder='static')
    CORS(app)
    
    os.makedirs('uploads', exist_ok=True)
    os.makedirs('sessions', exist_ok=True)

    from app.routes import main
    app.register_blueprint(main)

    return app