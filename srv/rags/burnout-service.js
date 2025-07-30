// Load environment variables
require('dotenv').config();

const cds = require('@sap/cds');
const RAGModel = require('./rag-model');

class BurnoutService {
    constructor() {
        this.ragModel = new RAGModel();
    }

    /**
     * Save burnout metrics to database using CAP service
     */
    async saveBurnoutMetrics(burnoutData) {
        try {
            const { Burnoutmetrics } = cds.entities('burner.db');

            // Generate unique ID for burnout metrics
            const burnoutId = `B${burnoutData.employeeId.substring(1).padStart(3, '0')}`;

            // Check if burnout metrics already exist for this employee
            const existingMetrics = await SELECT.one.from(Burnoutmetrics)
                .where({ employee_ID: burnoutData.employeeId });

            if (existingMetrics) {
                // Update existing metrics
                await UPDATE(Burnoutmetrics)
                    .set({
                        risk_level: burnoutData.risk_level,
                        cause: burnoutData.cause,
                        recommendation: burnoutData.recommendation
                    })
                    .where({ employee_ID: burnoutData.employeeId });

                console.log(`Updated burnout metrics for employee ${burnoutData.employeeId}`);

                return {
                    success: true,
                    employeeId: burnoutData.employeeId,
                    burnoutId: existingMetrics.ID,
                    action: 'updated'
                };
            } else {
                // Insert new metrics
                await INSERT.into(Burnoutmetrics).entries({
                    ID: burnoutId,
                    risk_level: burnoutData.risk_level,
                    cause: burnoutData.cause,
                    recommendation: burnoutData.recommendation,
                    employee_ID: burnoutData.employeeId
                });

                console.log(`Created new burnout metrics for employee ${burnoutData.employeeId}`);

                return {
                    success: true,
                    employeeId: burnoutData.employeeId,
                    burnoutId: burnoutId,
                    action: 'created'
                };
            }

        } catch (error) {
            console.error('Error saving burnout metrics:', error);
            throw error;
        }
    }

    /**
     * Generate and save burnout metrics for a specific employee
     */
    async generateForEmployee(employeeId) {
        try {
            console.log(`Starting burnout analysis for employee: ${employeeId}`);
            
            // Generate burnout metrics using RAG model
            const burnoutData = await this.ragModel.generateBurnoutMetrics(employeeId);
            
            // Save to database
            const result = await this.saveBurnoutMetrics(burnoutData);
            
            return {
                ...result,
                burnoutData: {
                    risk_level: burnoutData.risk_level,
                    cause: burnoutData.cause,
                    recommendation: burnoutData.recommendation,
                    generatedAt: burnoutData.generatedAt
                }
            };
            
        } catch (error) {
            console.error(`Error generating burnout metrics for employee ${employeeId}:`, error);
            throw error;
        }
    }

    /**
     * Generate and save burnout metrics for all employees
     */
    async generateForAllEmployees() {
        try {
            console.log('Starting burnout analysis for all employees...');
            
            // Generate burnout metrics for all employees
            const allBurnoutData = await this.ragModel.generateAllBurnoutMetrics();
            
            const results = [];
            
            for (const burnoutData of allBurnoutData) {
                try {
                    const result = await this.saveBurnoutMetrics(burnoutData);
                    results.push({
                        ...result,
                        burnoutData: {
                            risk_level: burnoutData.risk_level,
                            cause: burnoutData.cause,
                            recommendation: burnoutData.recommendation,
                            generatedAt: burnoutData.generatedAt
                        }
                    });
                } catch (error) {
                    console.error(`Error saving burnout metrics for employee ${burnoutData.employeeId}:`, error);
                    results.push({
                        success: false,
                        employeeId: burnoutData.employeeId,
                        error: error.message
                    });
                }
            }
            
            const successCount = results.filter(r => r.success).length;
            const totalCount = results.length;
            
            console.log(`Burnout analysis completed: ${successCount}/${totalCount} employees processed successfully`);
            
            return {
                summary: {
                    total: totalCount,
                    successful: successCount,
                    failed: totalCount - successCount
                },
                results: results
            };
            
        } catch (error) {
            console.error('Error generating burnout metrics for all employees:', error);
            throw error;
        }
    }

    /**
     * Get burnout metrics for an employee using CAP service
     */
    async getBurnoutMetrics(employeeId) {
        try {
            const { Burnoutmetrics } = cds.entities('burner.db');

            const result = await SELECT.one.from(Burnoutmetrics, bm => {
                bm.ID, bm.risk_level, bm.cause, bm.recommendation,
                bm.employee(e => {
                    e.name, e.department, e.role
                })
            }).where({ employee_ID: employeeId });

            if (!result) return null;

            // Flatten the structure
            return {
                ID: result.ID,
                risk_level: result.risk_level,
                cause: result.cause,
                recommendation: result.recommendation,
                name: result.employee?.name,
                department: result.employee?.department,
                role: result.employee?.role
            };

        } catch (error) {
            console.error('Error fetching burnout metrics:', error);
            throw error;
        }
    }

    /**
     * Get all burnout metrics using CAP service
     */
    async getAllBurnoutMetrics() {
        try {
            const { Burnoutmetrics } = cds.entities('burner.db');

            const results = await SELECT.from(Burnoutmetrics, bm => {
                bm.ID, bm.risk_level, bm.cause, bm.recommendation,
                bm.employee_ID,
                bm.employee(e => {
                    e.name, e.department, e.role
                })
            }).orderBy('employee_ID');

            // Flatten the structure
            return results.map(result => ({
                ID: result.ID,
                risk_level: result.risk_level,
                cause: result.cause,
                recommendation: result.recommendation,
                employee_ID: result.employee_ID,
                name: result.employee?.name,
                department: result.employee?.department,
                role: result.employee?.role
            }));

        } catch (error) {
            console.error('Error fetching all burnout metrics:', error);
            throw error;
        }
    }
}

module.exports = BurnoutService;
