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
            // Skip initialization if API key is missing or invalid
            if (!process.env.MISTRAL_API_KEY || process.env.MISTRAL_API_KEY.length < 20) {
                console.warn('Skipping Qdrant initialization: Invalid or missing Mistral API key');
                return;
            }

            await this.ragModel.storeKnowledgeInQdrant();
            console.log('Qdrant vector database initialized with knowledge base');
        } catch (error) {
            console.warn('Qdrant initialization failed:', error.message);
            // Don't throw error, just log warning to allow service to continue
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

    async generateForEmployee(employeeId) {
        try {
            // Check if API key is available
            if (!process.env.MISTRAL_API_KEY || process.env.MISTRAL_API_KEY.length < 20) {
                console.warn('Mistral API key not available, generating mock burnout metrics');
                return this._generateMockMetrics(employeeId);
            }

            const result = await this.ragModel.generateBurnoutMetrics(employeeId);
            return {
                action: 'created',
                burnoutData: result
            };
        } catch (error) {
            console.error(`Error generating metrics for employee ${employeeId}:`, error);
            console.warn('Falling back to mock metrics due to API error');
            return this._generateMockMetrics(employeeId);
        }
    }

    _generateMockMetrics(employeeId) {
        // Generate mock burnout metrics for testing
        const riskLevels = ['Low', 'Medium', 'High', 'Critical'];
        const causes = [
            'High workload and overtime',
            'Work-life balance issues',
            'Lack of career development',
            'Workplace stress and pressure',
            'Insufficient vacation time'
        ];
        const recommendations = [
            'Consider workload redistribution and time management training',
            'Implement flexible work arrangements and wellness programs',
            'Provide career development opportunities and mentoring',
            'Offer stress management resources and counseling support',
            'Encourage regular breaks and vacation time usage'
        ];

        const randomRisk = riskLevels[Math.floor(Math.random() * riskLevels.length)];
        const randomCause = causes[Math.floor(Math.random() * causes.length)];
        const randomRecommendation = recommendations[Math.floor(Math.random() * recommendations.length)];

        return {
            action: 'created (mock)',
            burnoutData: {
                employee_ID: employeeId,
                risk_level: randomRisk,
                cause: randomCause,
                recommendation: randomRecommendation,
                confidence_score: Math.random() * 0.3 + 0.7, // 0.7-1.0
                assessment_date: new Date().toISOString(),
                mock: true
            }
        };
    }

    async generateForAllEmployees() {
        try {
            // Check if API key is available
            if (!process.env.MISTRAL_API_KEY || process.env.MISTRAL_API_KEY.length < 20) {
                console.warn('Mistral API key not available, generating mock burnout metrics for all employees');
                return this._generateMockMetricsForAll();
            }

            const results = await this.ragModel.generateAllBurnoutMetrics();
            return {
                summary: {
                    total: results.length,
                    successful: results.filter(r => !r.error).length,
                    failed: results.filter(r => r.error).length
                },
                results: results
            };
        } catch (error) {
            console.error('Error generating metrics for all employees:', error);
            console.warn('Falling back to mock metrics for all employees due to API error');
            return this._generateMockMetricsForAll();
        }
    }

    async _generateMockMetricsForAll() {
        // Get all employees from database
        const db = await cds.connect.to('db');
        const { Employees } = db.entities;
        const employees = await db.run(SELECT.from(Employees));

        const results = employees.map(emp => {
            const mockResult = this._generateMockMetrics(emp.ID);
            return {
                employee_ID: emp.ID,
                success: true,
                data: mockResult.burnoutData
            };
        });

        return {
            summary: {
                total: results.length,
                successful: results.length,
                failed: 0
            },
            results: results
        };
    }
}

module.exports = BurnoutService;
