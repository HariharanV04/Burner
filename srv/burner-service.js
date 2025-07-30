// Load environment variables
require('dotenv').config();

const cds = require('@sap/cds');
const BurnoutService = require('./rags/burnout-service');

// Initialize RAG service
const burnoutService = new BurnoutService();

module.exports = cds.service.impl(async function() {

    // Custom action to generate burnout metrics for a specific employee
    this.on('generateBurnoutMetrics', async (req) => {
        const { employeeId } = req.data;

        if (!employeeId) {
            req.error(400, 'Employee ID is required');
            return;
        }

        try {
            console.log(`Generating burnout metrics for employee: ${employeeId}`);
            const result = await burnoutService.generateForEmployee(employeeId);

            return {
                success: true,
                message: `Burnout metrics ${result.action} for employee ${employeeId}`,
                data: result
            };
        } catch (error) {
            console.error('Error generating burnout metrics:', error);
            req.error(500, `Failed to generate burnout metrics: ${error.message}`);
        }
    });

    // Custom action to generate burnout metrics for all employees
    this.on('generateAllBurnoutMetrics', async (req) => {
        try {
            console.log('Generating burnout metrics for all employees...');
            const result = await burnoutService.generateForAllEmployees();

            return {
                success: true,
                message: `Burnout analysis completed for ${result.summary.successful}/${result.summary.total} employees`,
                data: result
            };
        } catch (error) {
            console.error('Error generating all burnout metrics:', error);
            req.error(500, `Failed to generate burnout metrics: ${error.message}`);
        }
    });

    // Custom function to get RAG system status
    this.on('getRAGStatus', async (req) => {
        try {
            const fs = require('fs-extra');
            const path = require('path');

            const knowledgeBasePath = path.join(__dirname, 'rags/knowledge-base');
            const files = await fs.readdir(knowledgeBasePath);
            const knowledgeFiles = files.filter(file =>
                file.endsWith('.txt') || file.endsWith('.md')
            );

            return {
                success: true,
                status: 'operational',
                configuration: {
                    mistralModel: process.env.MISTRAL_MODEL || 'mistral-large-latest',
                    mistralApiConfigured: !!process.env.MISTRAL_API_KEY,
                    knowledgeBaseFiles: knowledgeFiles.length,
                    knowledgeFiles: knowledgeFiles
                },
                actions: {
                    generateForEmployee: 'generateBurnoutMetrics',
                    generateForAll: 'generateAllBurnoutMetrics',
                    getStatus: 'getRAGStatus'
                }
            };
        } catch (error) {
            console.error('Error getting RAG status:', error);
            req.error(500, `Failed to get RAG status: ${error.message}`);
        }
    });

    // Enhanced BurnoutMetrics entity with additional functionality
    this.after('READ', 'BurnoutMetrics', async (results, req) => {
        // Add computed fields or additional processing if needed
        if (Array.isArray(results)) {
            results.forEach(result => {
                result.generatedBy = 'RAG System';
            });
        } else if (results) {
            results.generatedBy = 'RAG System';
        }
    });

    console.log('RAG System integrated into CAP service');
    console.log('Available actions:');
    console.log('- generateBurnoutMetrics(employeeId)');
    console.log('- generateAllBurnoutMetrics()');
    console.log('- getRAGStatus()');
});