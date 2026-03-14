import os
from groq import Groq

def generate_answer(query, contexts, history):
    """
    Generates an answer using LLaMA 3.3, strictly grounded in the provided context,
    but handles conversational greetings gracefully.
    """
    api_key = os.getenv('GROQ_API_KEY')
    if not api_key:
        raise ValueError("GROQ_API_KEY missing from environment variables")
        
    client = Groq(api_key=api_key)
    
    # 1. Format the retrieved context
    # If no context was found (empty list), we handle that in the prompt logic
    context_str = "\n\n".join([f"[Page {c['page']}] {c['text']}" for c in contexts])
    
    # 2. Build the Smarter System Prompt
    system_prompt = f"""You are 'Tibbeb', an advanced AI research assistant. Your goal is to help users understand the provided research paper.

    Context from the document:
    {context_str}

    Instructions:
    1. **Greetings & Casual Chat:** If the user says "Hello", "Hi", "Who are you?", or similar conversational inputs, reply politely and ask them what they would like to know about the document. Do NOT try to use the context for these.
    
    2. **Factual Questions:** For all other questions, answer using ONLY the provided context above.
    
    3. **Citations:** When answering from the context, you MUST cite your sources by appending [Page X] at the end of the sentence.
    
    4. **Unknown Information:** If the answer to a factual question is not in the context, say exactly: "I don't see evidence for that in the provided paper. Here is what the paper does cover..." and briefly summarize the available topics. Do NOT make up information.
    
    5. **Tone:** Be professional, concise, and academic.
    """
    
    messages = [{"role": "system", "content": system_prompt}]
    
    # 3. Add conversation memory (Limit to last 4 turns to keep focus)
    for msg in history[-4:]:
        messages.append({"role": msg["role"], "content": msg["content"]})
        
    # 4. Add the current user query
    messages.append({"role": "user", "content": query})
    
    # 5. Call the Groq LLaMA 3.3 model
    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=messages,
        temperature=0.2, # Low temperature for precision
        max_tokens=1024
    )
    
    return response.choices[0].message.content
