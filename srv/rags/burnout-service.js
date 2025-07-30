// Load environment variables
require('dotenv').config();

const cds = require('@sap/cds');
const RAGModel = require('./rag-model');

class BurnoutService {
    constructor() {
        this.ragModel = new RAGModel();
        this._initializeQdrant();
    }

    async _initializeQdrant() {
        try {
            await this.ragModel.storeKnowledgeInQdrant();
            console.log('Qdrant vector database initialized with knowledge base');
        } catch (error) {
            console.warn('Qdrant initialization failed:', error.message);
        }
    }

    async getRAGStatus() {
        const qdrantStatus = await this.ragModel.getQdrantStatus();
        return {
            status: 'active',
            vector_database: qdrantStatus,
            mistral_model: this.ragModel.mistralModel,
            knowledge_base_path: this.ragModel.knowledgeBasePath
        };
    }
}

module.exports = BurnoutService;
