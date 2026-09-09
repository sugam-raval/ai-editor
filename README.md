# AI Template Editor Backend

A FastAPI backend server implementing the AI-driven Template Editor described in `AI_TEMPLATE_EDITOR_IMPLEMENTATION.md`.

Instead of asking Large Language Models (LLMs) to rewrite raw JSON (which risks corrupting deep-nested canvas structures and breaking frontend rendering), this system utilizes an **Agentic Tool-Calling Architecture** powered by **LangGraph** and **LangChain**.

---

## 🚀 Key Architectural Features

1. **Zero JSON Corruption**: The LLM never outputs raw JSON; it only calls typed mutation tools (`update_text_content`, `update_text_color`, `update_image_url`).
2. **Token Optimization (Prune & Map)**: The backend strips heavy canvas metadata (matrix transforms, font URLs, SVGs) into an ultra-compact `ai_context` before passing it to the LLM.
3. **Deep Copy Safety**: Template JSON is deep-copied before mutation, preventing accidental mutations by reference.
4. **Color Normalization**: Automatically converts human-friendly color names (e.g. `"blue"`, `"emerald green"`) into standard hex or RGB formats.
5. **Agentic Looping**: Handles multi-step instructions (e.g., *"Change the headline text to 'Winter Sale' AND make the badge blue AND replace the food image"*) seamlessly within the LangGraph state machine.

---

## 📂 Project Structure

```
.
├── AI_TEMPLATE_EDITOR_IMPLEMENTATION.md  # Architectural specification
├── README.md                            # Documentation and quickstart
├── requirements.txt                     # Dependencies
├── .env.example                         # Example environment variables
├── Doc/
│   └── 2026-09-08.md                    # Date-wise development activity log
├── app/
│   ├── config.py                        # Pydantic BaseSettings
│   ├── main.py                          # FastAPI app entrypoint & CORS
│   ├── api/
│   │   └── routes.py                    # REST endpoints (/health, /api/ai/...)
│   ├── models/
│   │   └── schemas.py                   # Pydantic request/response schemas
│   └── services/
│       ├── color_utils.py               # Color normalization engine
│       ├── graph.py                     # LangGraph workflow & tools
│       ├── mutator.py                   # Safe deep JSON mutation
│       └── pruner.py                    # Lightweight token pruner
└── tests/
    ├── sample_template.json             # Realistic canvas template JSON
    ├── test_api.py                      # FastAPI integration tests
    ├── test_mutator.py                  # Mutation engine unit tests
    └── test_pruner.py                   # Pruner unit tests
```

---

## 🛠️ Quickstart

### 1. Configure Environment

Copy `.env.example` to `.env` and configure your `OPENAI_API_KEY`:

```bash
cp .env.example .env
```

Edit `.env`:
```env
OPENAI_API_KEY=sk-...
OPENAI_MODEL_NAME=gpt-4o
PORT=8000
HOST=0.0.0.0
```

### 2. Start the Server

```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

Interactive Swagger documentation is available at:
`http://localhost:8000/docs`

---

## 📡 API Endpoints

### 1. Health Check
`GET /health`

Response:
```json
{
  "status": "ok",
  "version": "1.0.0",
  "openai_configured": true,
  "model_name": "gpt-4o",
  "environment": "development"
}
```

### 2. Prune Template (Token Optimization Preview)
`POST /api/ai/prune-template`

Payload:
```json
{
  "template_json": { ... }
}
```

Response:
```json
{
  "pruned_context": {
    "layers": {
      "layer-headline-001": {
        "id": "layer-headline-001",
        "type": "TextLayer",
        "ai_label": "Main Headline",
        "editable": {
          "text": "Summer Super Sale",
          "color": "#1F2937",
          "fontSize": 36
        }
      }
    }
  },
  "layer_count": 1
}
```

### 3. Edit Template (Agentic Mutation)
`POST /api/ai/edit-template`

Payload:
```json
{
  "user_prompt": "Change the headline to 'Winter Megasale' and make the discount badge blue",
  "template_json": { ... }
}
```

Response:
```json
{
  "updated_json": { ... },
  "ai_message": "I updated the main headline to 'Winter Megasale' and changed the discount badge color to blue (#0000FF).",
  "success": true,
  "mutations_applied": [
    "update_text_content: {'layer_id': 'layer-headline-001', 'new_text': 'Winter Megasale'}",
    "update_text_color: {'layer_id': 'layer-discount-002', 'new_color': 'blue'}"
  ]
}
```

---

## 🧪 Running Tests

Execute the comprehensive test suite:

```bash
pytest -v tests/
```

