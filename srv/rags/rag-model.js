// Load environment variables
require('dotenv').config();

const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');
const cds = require('@sap/cds');
const { QdrantClient } = require('@qdrant/js-client-rest');

class RAGModel {
    constructor() {
        this.mistralApiKey = process.env.MISTRAL_API_KEY;
        this.mistralApiUrl = process.env.MISTRAL_API_URL || 'https://api.mistral.ai/v1';
        this.mistralModel = process.env.MISTRAL_MODEL || 'mistral-large-latest';
        this.mistralEmbedModel = process.env.MISTRAL_EMBED_MODEL || 'mistral-embed';
        this.knowledgeBasePath = path.join(__dirname, 'knowledge-base');
        
        // Initialize Qdrant client
        this.qdrantClient = new QdrantClient({
            url: process.env.QDRANT_URL,
            apiKey: process.env.QDRANT_API_KEY,
        });
        this.collectionName = process.env.QDRANT_COLLECTION || 'burnout_knowledge';
        
        if (!this.mistralApiKey) {
            throw new Error('MISTRAL_API_KEY is required in environment variables');
        }
        if (!process.env.QDRANT_URL) {
            throw new Error('QDRANT_URL is required in environment variables');
        }
    }

    /**
     * Load and process knowledge base files
     */
    async loadKnowledgeBase() {
        try {
            const files = await fs.readdir(this.knowledgeBasePath);
            const knowledgeContent = [];

            for (const file of files) {
                if (file.endsWith('.txt') || file.endsWith('.md')) {
                    const filePath = path.join(this.knowledgeBasePath, file);
                    const content = await fs.readFile(filePath, 'utf-8');
                    knowledgeContent.push({
                        filename: file,
                        content: content.trim()
                    });
                }
            }

            return knowledgeContent;
        } catch (error) {
            console.warn('Warning: Could not load knowledge base files:', error.message);
            return [];
        }
    }

    /**
     * Get employee and work metrics data from database using CAP service
     */
    async getEmployeeData(employeeId = null) {
        try {
            const { Employee } = cds.entities('burner.db');

            if (employeeId) {
                const employee = await SELECT.one.from(Employee, e => {
                    e.ID, e.name, e.department, e.role,
                    e.workMetrics(w => {
                        w.work_hours, w.commute_hours, w.overtime_hours,
                        w.leave_taken, w.vacation_taken, w.shift
                    })
                }).where({ ID: employeeId });

                if (!employee) return null;

                // Flatten the structure for easier processing
                const workMetrics = employee.workMetrics?.[0] || {};
                return [{
                    ID: employee.ID,
                    name: employee.name,
                    department: employee.department,
                    role: employee.role,
                    work_hours: workMetrics.work_hours,
                    commute_hours: workMetrics.commute_hours,
                    overtime_hours: workMetrics.overtime_hours,
                    leave_taken: workMetrics.leave_taken,
                    vacation_taken: workMetrics.vacation_taken,
                    shift: workMetrics.shift
                }];
            } else {
                const employees = await SELECT.from(Employee, e => {
                    e.ID, e.name, e.department, e.role,
                    e.workMetrics(w => {
                        w.work_hours, w.commute_hours, w.overtime_hours,
                        w.leave_taken, w.vacation_taken, w.shift
                    })
                });

                // Flatten the structure for easier processing
                return employees.map(employee => {
                    const workMetrics = employee.workMetrics?.[0] || {};
                    return {
                        ID: employee.ID,
                        name: employee.name,
                        department: employee.department,
                        role: employee.role,
                        work_hours: workMetrics.work_hours,
                        commute_hours: workMetrics.commute_hours,
                        overtime_hours: workMetrics.overtime_hours,
                        leave_taken: workMetrics.leave_taken,
                        vacation_taken: workMetrics.vacation_taken,
                        shift: workMetrics.shift
                    };
                });
            }
        } catch (error) {
            console.error('Error fetching employee data:', error);
            throw error;
        }
    }

    /**
     * Initialize Qdrant collection
     */
    async initializeQdrantCollection() {
        try {
            // Check if collection exists
            const collections = await this.qdrantClient.getCollections();
            const collectionExists = collections.collections.some(
                col => col.name === this.collectionName
            );

            if (!collectionExists) {
                // Create collection with vector configuration
                await this.qdrantClient.createCollection(this.collectionName, {
                    vectors: {
                        size: 1024, // Mistral embedding dimension
                        distance: 'Cosine'
                    }
                });
                console.log(`Created Qdrant collection: ${this.collectionName}`);
            } else {
                console.log(`Qdrant collection already exists: ${this.collectionName}`);
            }
        } catch (error) {
            console.error('Error initializing Qdrant collection:', error);
            throw error;
        }
    }

    /**
     * Generate embeddings using Mistral
     */
    async generateEmbeddings(texts) {
        try {
            const response = await axios.post(
                `${this.mistralApiUrl}/embeddings`,
                {
                    model: this.mistralEmbedModel,
                    input: Array.isArray(texts) ? texts : [texts]
                },
                {
                    headers: {
                        'Authorization': `Bearer ${this.mistralApiKey}`,
                        'Content-Type': 'application/json'
                    }
                }
            );
            
            return response.data.data.map(item => item.embedding);
        } catch (error) {
            console.error('Error generating embeddings:', error);
            throw error;
        }
    }

    /**
     * Store knowledge base in Qdrant
     */
    async storeKnowledgeInQdrant() {
        try {
            await this.initializeQdrantCollection();
            
            const knowledgeContent = await this.loadKnowledgeBase();
            
            if (knowledgeContent.length === 0) {
                console.log('No knowledge base files found');
                return;
            }
            
            // Chunk content for better retrieval
            const points = [];
            let pointId = 1;
            
            for (const kb of knowledgeContent) {
                const chunks = this.chunkText(kb.content, 500);
                
                for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
                    const chunk = chunks[chunkIndex];
                    const embeddings = await this.generateEmbeddings([chunk]);
                    
                    points.push({
                        id: pointId++,
                        vector: embeddings[0],
                        payload: {
                            filename: kb.filename,
                            chunk_index: chunkIndex,
                            content: chunk,
                            source: 'knowledge_base',
                            created_at: new Date().toISOString()
                        }
                    });
                }
                
                // Add delay to avoid rate limiting
                await new Promise(resolve => setTimeout(resolve, 100));
            }
            
            // Batch upload to Qdrant
            if (points.length > 0) {
                await this.qdrantClient.upsert(this.collectionName, {
                    wait: true,
                    points: points
                });
                
                console.log(`Stored ${points.length} knowledge chunks in Qdrant`);
            }
        } catch (error) {
            console.error('Error storing knowledge in Qdrant:', error);
            throw error;
        }
    }

    /**
     * Retrieve relevant knowledge using Qdrant similarity search
     */
    async retrieveRelevantKnowledge(query, topK = 5) {
        try {
            // Generate embedding for query
            const queryEmbeddings = await this.generateEmbeddings([query]);
            
            // Search Qdrant
            const searchResult = await this.qdrantClient.search(this.collectionName, {
                vector: queryEmbeddings[0],
                limit: topK,
                with_payload: true,
                with_vector: false
            });
            
            return searchResult.map(result => ({
                content: result.payload.content,
                filename: result.payload.filename,
                chunk_index: result.payload.chunk_index,
                similarity: result.score,
                metadata: result.payload
            }));
        } catch (error) {
            console.error('Error retrieving relevant knowledge from Qdrant:', error);
            return [];
        }
    }

    /**
     * Analyze burnout risk using Mistral AI
     */
    async analyzeBurnoutRisk(employeeData, knowledgeBase = null) {
        try {
            // Create semantic query from employee data
            const query = `Burnout risk assessment guidelines for ${employeeData.department} department employee 
                          working ${employeeData.work_hours} hours with ${employeeData.overtime_hours} overtime hours 
                          in ${employeeData.role} role with ${employeeData.leave_taken} leave days taken`;
            
            // Retrieve relevant knowledge using vector search
            const relevantKnowledge = await this.retrieveRelevantKnowledge(query, 3);
            
            // Build enhanced knowledge context
            let enhancedKnowledge = '';
            if (relevantKnowledge.length > 0) {
                enhancedKnowledge = '\n\nRelevant Knowledge from Vector Database:\n' +
                    relevantKnowledge.map((item, index) => 
                        `${index + 1}. [Similarity: ${item.similarity.toFixed(3)}] ${item.content}`
                    ).join('\n\n');
            }
            
            // Combine with traditional knowledge base
            const traditionalKnowledge = knowledgeBase || await this.loadKnowledgeBase();
            const combinedKnowledge = traditionalKnowledge.map(kb => 
                `${kb.filename}:\n${kb.content}`
            ).join('\n\n') + enhancedKnowledge;
            
            const systemPrompt = `You are an expert HR analyst specializing in employee burnout assessment. 
            Use the provided knowledge base and employee work metrics to assess burnout risk.
            
            Knowledge Base:
            ${combinedKnowledge}
            
            Analyze the employee data and provide:
            1. Risk level (Low, Medium, High, Critical)
            2. Primary causes of potential burnout
            3. Specific recommendations for improvement
            
            Be concise but thorough in your analysis.`;

            const userPrompt = `Analyze burnout risk for this employee:
            
            Employee: ${employeeData.name} (${employeeData.ID})
            Department: ${employeeData.department}
            Role: ${employeeData.role}
            Work Hours: ${employeeData.work_hours || 'N/A'}
            Commute Hours: ${employeeData.commute_hours || 'N/A'}
            Overtime Hours: ${employeeData.overtime_hours || 'N/A'}
            Leave Taken: ${employeeData.leave_taken || 'N/A'} days
            Vacation Taken: ${employeeData.vacation_taken || 'N/A'} days
            Shift: ${employeeData.shift || 'N/A'}`;

            const response = await axios.post(
                `${this.mistralApiUrl}/chat/completions`,
                {
                    model: this.mistralModel,
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: userPrompt }
                    ],
                    temperature: 0.3,
                    max_tokens: 1000
                },
                {
                    headers: {
                        'Authorization': `Bearer ${this.mistralApiKey}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            return this.parseAnalysisResponse(response.data.choices[0].message.content);
        } catch (error) {
            console.error('Error calling Mistral API:', error.response?.data || error.message);
            throw error;
        }
    }

    /**
     * Parse the AI response into structured data
     */
    parseAnalysisResponse(aiResponse) {
        const lines = aiResponse.split('\n').filter(line => line.trim());
        
        let riskLevel = 'Medium';
        let cause = '';
        let recommendation = '';
        
        let currentSection = '';
        
        for (const line of lines) {
            const lowerLine = line.toLowerCase();
            
            if (lowerLine.includes('risk level') || lowerLine.includes('risk:')) {
                if (lowerLine.includes('low')) riskLevel = 'Low';
                else if (lowerLine.includes('medium')) riskLevel = 'Medium';
                else if (lowerLine.includes('high')) riskLevel = 'High';
                else if (lowerLine.includes('critical')) riskLevel = 'Critical';
                currentSection = 'risk';
            } else if (lowerLine.includes('cause') || lowerLine.includes('primary cause')) {
                currentSection = 'cause';
                cause += line.replace(/^\d+\.\s*|cause[s]?:?\s*/i, '') + ' ';
            } else if (lowerLine.includes('recommendation') || lowerLine.includes('suggest')) {
                currentSection = 'recommendation';
                recommendation += line.replace(/^\d+\.\s*|recommendation[s]?:?\s*/i, '') + ' ';
            } else if (currentSection === 'cause' && line.trim()) {
                cause += line.trim() + ' ';
            } else if (currentSection === 'recommendation' && line.trim()) {
                recommendation += line.trim() + ' ';
            }
        }
        
        return {
            risk_level: riskLevel,
            cause: cause.trim() || 'Analysis based on work metrics and patterns',
            recommendation: recommendation.trim() || 'Monitor work-life balance and consider workload adjustments'
        };
    }

    /**
     * Generate burnout metrics for an employee
     */
    async generateBurnoutMetrics(employeeId) {
        try {
            console.log(`Generating burnout metrics for employee: ${employeeId}`);
            
            // Load knowledge base
            const knowledgeBase = await this.loadKnowledgeBase();
            
            // Get employee data
            const employeeData = await this.getEmployeeData(employeeId);
            
            if (!employeeData || employeeData.length === 0) {
                throw new Error(`Employee ${employeeId} not found`);
            }
            
            // Analyze burnout risk
            const analysis = await this.analyzeBurnoutRisk(employeeData[0], knowledgeBase);
            
            return {
                employeeId,
                ...analysis,
                generatedAt: new Date().toISOString()
            };
            
        } catch (error) {
            console.error('Error generating burnout metrics:', error);
            throw error;
        }
    }

    /**
     * Generate burnout metrics for all employees
     */
    async generateAllBurnoutMetrics() {
        try {
            console.log('Generating burnout metrics for all employees...');
            
            // Load knowledge base once
            const knowledgeBase = await this.loadKnowledgeBase();
            
            // Get all employee data
            const allEmployeeData = await this.getEmployeeData();
            
            const results = [];
            
            for (const employeeData of allEmployeeData) {
                try {
                    const analysis = await this.analyzeBurnoutRisk(employeeData, knowledgeBase);
                    results.push({
                        employeeId: employeeData.ID,
                        ...analysis,
                        generatedAt: new Date().toISOString()
                    });
                    
                    // Add small delay to avoid rate limiting
                    await new Promise(resolve => setTimeout(resolve, 1000));
                } catch (error) {
                    console.error(`Error analyzing employee ${employeeData.ID}:`, error);
                    results.push({
                        employeeId: employeeData.ID,
                        risk_level: 'Medium',
                        cause: 'Analysis failed - using default assessment',
                        recommendation: 'Manual review recommended',
                        generatedAt: new Date().toISOString(),
                        error: error.message
                    });
                }
            }
            
            return results;
        } catch (error) {
            console.error('Error generating all burnout metrics:', error);
            throw error;
        }
    }

    /**
     * Chunk text into smaller pieces for better retrieval
     */
    chunkText(text, chunkSize = 500) {
        const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
        const chunks = [];
        let currentChunk = '';
        
        for (const sentence of sentences) {
            if ((currentChunk + sentence).length > chunkSize && currentChunk.length > 0) {
                chunks.push(currentChunk.trim());
                currentChunk = sentence;
            } else {
                currentChunk += (currentChunk ? '. ' : '') + sentence;
            }
        }
        
        if (currentChunk.trim().length > 0) {
            chunks.push(currentChunk.trim());
        }
        
        return chunks.length > 0 ? chunks : [text];
    }

    /**
     * Get Qdrant collection info
     */
    async getQdrantStatus() {
        try {
            const collectionInfo = await this.qdrantClient.getCollection(this.collectionName);
            return {
                collection: this.collectionName,
                status: 'connected',
                points_count: collectionInfo.points_count,
                vectors_count: collectionInfo.vectors_count,
                url: process.env.QDRANT_URL
            };
        } catch (error) {
            return {
                collection: this.collectionName,
                status: 'error',
                error: error.message,
                url: process.env.QDRANT_URL
            };
        }
    }
}

module.exports = RAGModel;
