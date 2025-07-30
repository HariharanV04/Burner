using burner.db as db from '../db/schema';

service BurnerService {
    entity Employees       as projection on db.Employee;
    entity WorkMetrics     as projection on db.Workmetrics;
    entity BurnoutMetrics  as projection on db.Burnoutmetrics;

    // RAG System Actions
    action generateBurnoutMetrics(employeeId: String) returns {
        success: Boolean;
        message: String;
        data: {
            employeeId: String;
            action: String;
            burnoutData: {
                risk_level: String;
                cause: String;
                recommendation: String;
                generatedAt: String;
            };
        };
    };

    action generateAllBurnoutMetrics() returns {
        success: Boolean;
        message: String;
        data: {
            summary: {
                total: Integer;
                successful: Integer;
                failed: Integer;
            };
        };
    };

    function getRAGStatus() returns {
        success: Boolean;
        status: String;
        configuration: {
            mistralModel: String;
            mistralApiConfigured: Boolean;
            knowledgeBaseFiles: Integer;
            knowledgeFiles: array of String;
        };
        actions: {
            generateForEmployee: String;
            generateForAll: String;
            getStatus: String;
        };
    };
}