# Getting Started

Welcome to your new project.

It contains these folders and files, following our recommended project layout:

File or Folder | Purpose
---------|----------
`app/` | content for UI frontends goes here
`db/` | your domain models and data go here
`srv/` | your service models and code go here
`package.json` | project metadata and configuration
`readme.md` | this getting started guide


## Environment Setup

1. **Configure Environment Variables**:
   ```bash
   cp .env.example .env
   ```
   Then edit `.env` and add your actual API keys and configuration values.

2. **Required Environment Variables**:
   - `MISTRAL_API_KEY`: Your Mistral AI API key
   - `MISTRAL_API_URL`: Mistral AI API endpoint (default: https://api.mistral.ai/v1)
   - `MISTRAL_MODEL`: Model to use (default: mistral-large-latest)

## RAG System

This project includes an integrated RAG (Retrieval-Augmented Generation) system that uses Mistral Large Latest to analyze employee burnout risk.

### Features
- 🤖 AI-powered burnout risk assessment using Mistral Large Latest
- 📊 Seamless integration with CAP service and SQLite database
- 📚 Knowledge base support for domain-specific guidelines
- 🔄 Automatic generation and storage of burnout metrics
- 🎯 Native OData actions and functions

### Architecture
The RAG system is fully integrated into the CAP service layer:
```
srv/
├── burner-service.cds     # Service definition with RAG actions
├── burner-service.js      # Service implementation with RAG integration
└── rags/
    ├── rag-model.js       # Core RAG model with Mistral AI
    ├── burnout-service.js # Business logic for burnout analysis
    └── knowledge-base/    # Knowledge base files (.txt, .md)
```

### RAG Actions (OData)
- `getRAGStatus()` - Get system status and configuration
- `generateBurnoutMetrics(employeeId)` - Generate burnout analysis for specific employee
- `generateAllBurnoutMetrics()` - Generate analysis for all employees
- Standard OData queries on `BurnoutMetrics` entity

### Knowledge Base
Add your domain knowledge files to `srv/rags/knowledge-base/`:
- Supported formats: `.txt`, `.md`
- Include burnout assessment guidelines, department-specific factors, etc.
- Files are automatically loaded and used in AI analysis

## Next Steps

- Copy `.env.example` to `.env` and configure your API keys
- Add your Mistral API key to the `.env` file
- Add knowledge base files to `srv/rags/knowledge-base/`
- Start the integrated service with `npm start` or `cds serve`
- Test RAG actions using the endpoints in `test.http`
- (in VS Code simply choose _**Terminal** > Run Task > cds watch_)
- Start adding content, for example, a [db/schema.cds](db/schema.cds).


## Learn More

Learn more at https://cap.cloud.sap/docs/get-started/.
