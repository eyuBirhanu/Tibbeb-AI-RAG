# Lucy RAG Assistant

A production-grade **Retrieval-Augmented Generation (RAG)** chatbot that answers questions strictly grounded in uploaded PDF documents. Built with multi-tenant session isolation, smart conversational handling, and a responsive UI.

🔗 **Live Demo:** https://lucy-rag-chatbot.onrender.com  
📁 **Repository:** https://github.com/eyuBirhanu/Tibbeb-AI-RAG

---

## Table of Contents

- [Tech Stack & Design Decisions](#tech-stack--design-decisions)
- [Architecture & Strategy Notes](#architecture--strategy-notes)
- [Key Features](#key-features)
- [Project Structure](#project-structure)
- [Local Setup & Installation](#local-setup--installation)
- [Running the Application](#running-the-application)
- [Ingesting a PDF & Testing the Chatbot](#ingesting-a-pdf--testing-the-chatbot)
- [API Reference](#api-reference)
- [Deployment](#deployment)

---

## Tech Stack & Design Decisions

| Layer | Technology | Why This Choice |
|---|---|---|
| **Backend** | Python 3.9+, Flask, Gunicorn | Lightweight and fast for API-first services; Gunicorn for production-grade WSGI |
| **Frontend** | HTML5, Bootstrap 5, Vanilla JS | Zero build-step complexity; Bootstrap handles responsive layout out of the box |
| **LLM Provider** | [Groq](https://groq.com) — `llama-3.3-70b-versatile` | Near-instant inference (~300ms) on LLaMA 3.3 70B, far faster than OpenAI for interactive chat latency |
| **Embedding Model** | [Cohere](https://cohere.com) — `embed-english-v3.0` | Supports distinct `input_type` flags (`search_document` vs `search_query`), which materially improves retrieval accuracy compared to single-type embedding models |
| **Vector Database** | [Pinecone](https://pinecone.io) Serverless | Low-latency metadata filtering (`$eq` on `session_id`) enables multi-tenant isolation without running a separate index per user |

---

## Architecture & Strategy Notes

### Chunking Strategy

PDF text is extracted page-by-page using **PyMuPDF** (`fitz`) for high-fidelity parsing of complex layouts. The text is then split using a **sliding window** approach:

- **Chunk size:** 800 characters
- **Overlap:** 150 characters

The overlap is critical for research papers, where concepts and sentences frequently span paragraph boundaries. Without it, a chunk split mid-sentence would lose semantic coherence, degrading retrieval quality. Each chunk also retains its source **page number** for downstream citation.

---

### Retrieval Settings

- **Top-K:** 10 chunks retrieved per query.
- **Similarity Threshold:** 0.2 (cosine similarity). Chunks below this score are discarded before being sent to the LLM, preventing weakly-related noise from polluting the context window.
- **Embedding alignment:** Queries are embedded with Cohere's `search_query` input type, while stored document chunks use `search_document`. This asymmetric approach is recommended by Cohere and improves vector space alignment between questions and answers.

---

### Memory Implementation

Conversation history is persisted in lightweight **JSON files** on disk (`sessions/{uuid}.json`), one file per session. On every chat request:

1. The last **4 turns** (8 messages: 4 user + 4 assistant) are loaded from the session file and injected into the LLM's message array before the current query.
2. This allows the model to resolve pronoun references (e.g., *"What is its recommended dose?"* correctly resolving *"its"* from the prior turn) without exceeding the model's context limit.
3. The `/api/clear` endpoint wipes both the Pinecone vectors **and** the session JSON file, ensuring a clean slate and keeping free-tier storage within limits.

---

## Key Features

### 🛡️ Multi-Tenant Session Isolation
Every uploaded document's vector chunks are tagged with a unique `session_id` in Pinecone metadata. All queries filter strictly on `session_id`, ensuring that concurrent users never see each other's documents or answers.

### 🧠 Smart System Prompts
The LLM prompt distinguishes between two modes:
- **Conversational inputs** (greetings, identity questions) — handled naturally without document lookup.
- **Factual queries** — answered strictly from retrieved context, with mandatory `[Page X]` inline citations and a hard refusal to hallucinate.

### 🎨 Responsive, Accessible UI
- **Dark / Light mode** with persisted user preference (`localStorage`).
- **Markdown rendering** in chat (lists, bold, code blocks via `marked.js`).
- **Progress bars** during ingestion and **typing indicators** during LLM generation for perceived-performance masking.

### 🧹 Automated Resource Management
The `/api/clear` endpoint performs a full session teardown: vector deletion from Pinecone + history file wipe.

---

## Project Structure

```
lucy-rag-assessment/
├── app/
│   ├── __init__.py              # Flask app factory
│   ├── routes.py                # All API endpoints
│   ├── services/
│   │   ├── document_processor.py  # PDF extraction & sliding-window chunking
│   │   ├── embedding_service.py   # Cohere embed-english-v3.0 calls
│   │   ├── vector_store.py        # Pinecone upsert, query & delete
│   │   ├── llm_service.py         # Groq / LLaMA 3.3 inference + prompting
│   │   └── memory_manager.py      # JSON-based conversation history
│   ├── static/                  # CSS & JavaScript (app.js)
│   └── templates/
│       └── index.html           # Single-page frontend
├── sessions/                    # Per-session JSON history files (gitignored)
├── uploads/                     # Temporary PDF storage (gitignored)
├── run.py                       # Application entry point
├── requirements.txt             # Python dependencies
└── .env                         # API keys (not committed)
```

---

## Local Setup & Installation

### Prerequisites

- Python 3.9+
- API keys for **Cohere**, **Pinecone**, and **Groq**
- A Pinecone index named `lucy-rag-index` with **1024 dimensions** and **cosine** metric

### 1. Clone the Repository

```bash
git clone https://github.com/eyuBirhanu/Tibbeb-AI-RAG.git
cd lucy-rag-assessment
```

### 2. Create a Virtual Environment

```bash
python -m venv venv

# Windows
venv\Scripts\activate

# macOS / Linux
source venv/bin/activate
```

### 3. Install Dependencies

```bash
pip install -r requirements.txt
```

### 4. Configure Environment Variables

Create a `.env` file in the project root:

```env
# Cohere — for generating embeddings
COHERE_API_KEY=your_cohere_api_key_here

# Pinecone — vector database
PINECONE_API_KEY=your_pinecone_api_key_here
PINECONE_INDEX_NAME=lucy-rag-index

# Groq — LLM inference
GROQ_API_KEY=your_groq_api_key_here

# Flask
FLASK_ENV=development
```

> **Note:** Never commit `.env` to version control. It is already listed in `.gitignore`.

---

## Running the Application

### Backend (Development)

```bash
python run.py
```

The Flask development server starts at `http://127.0.0.1:5000`.

### Backend (Production)

```bash
gunicorn run:app
```

### Frontend

The frontend is served directly by Flask. Open `http://127.0.0.1:5000` in your browser — no separate frontend build step is required.

---

## Ingesting a PDF & Testing the Chatbot

Follow these steps to use the application end-to-end:

**Step 1 — Open the app**  
Navigate to `http://127.0.0.1:5000` (or the live demo URL).

**Step 2 — Upload your PDF**  
Click the **"Upload PDF"** button and select any PDF document. A progress bar will indicate when processing (extraction → embedding → storage) is complete. The app includes a sample `creatine_paper.pdf` for quick testing.

**Step 3 — Start chatting**  
Type a question about the document in the chat box and press **Send**. Lucy will retrieve the most relevant chunks, generate a grounded answer with page citations (e.g., `[Page 3]`), and display it in the chat.

**Step 4 — Test conversation memory**  
Ask a follow-up question using a pronoun, for example:
> *"What were the main findings?"* → *"How significant were they?"*

Lucy will correctly resolve the pronoun using conversation history.

**Step 5 — Clear the session**  
Click the **"Clear"** button to wipe the current session's document vectors and chat history, preparing the app for a new document.

### Testing via cURL

```bash
# 1. Create a session
curl -X POST http://127.0.0.1:5000/api/session

# 2. Upload a PDF (replace <SESSION_ID> and <PATH_TO_PDF>)
curl -X POST http://127.0.0.1:5000/api/upload \
  -F "session_id=<SESSION_ID>" \
  -F "file=@<PATH_TO_PDF>"

# 3. Ask a question
curl -X POST http://127.0.0.1:5000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"session_id": "<SESSION_ID>", "message": "What is this paper about?"}'

# 4. Clear the session
curl -X POST http://127.0.0.1:5000/api/clear \
  -H "Content-Type: application/json" \
  -d '{"session_id": "<SESSION_ID>"}'
```

---

## API Reference

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/health` | Health check |
| `POST` | `/api/session` | Create a new session; returns `session_id` |
| `POST` | `/api/upload` | Upload & ingest a PDF (`multipart/form-data`, requires `session_id`) |
| `POST` | `/api/chat` | Send a message; returns `answer` + `sources` (page numbers) |
| `POST` | `/api/clear` | Delete vectors and chat history for a session |
| `GET` | `/api/history/<session_id>` | Retrieve full chat history for a session |

---

## Deployment

This project is configured for one-click deployment on [Render](https://render.com).

| Setting | Value |
|---|---|
| **Environment** | Python 3 |
| **Build Command** | `pip install -r requirements.txt` |
| **Start Command** | `gunicorn run:app` |
| **Environment Variables** | Add all keys from `.env` in the Render Dashboard |

---

## Author

Built by **Eyu Birhanu** for the Lucy technical assessment.
