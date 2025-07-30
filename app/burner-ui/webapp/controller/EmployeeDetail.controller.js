sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/m/MessageToast",
    "sap/m/MessageBox",
    "sap/ui/model/json/JSONModel"
], (Controller, MessageToast, MessageBox, JSONModel) => {
    "use strict";

    return Controller.extend("burnerui.controller.EmployeeDetail", {
        onInit() {
            this.getRouter().getRoute("RouteEmployeeDetail").attachPatternMatched(this._onRouteMatched, this);
            
            // Initialize local model for employee data
            const oLocalModel = new JSONModel({
                employee: {},
                workMetrics: {},
                burnoutMetrics: {},
                recommendationActions: []
            });
            this.getView().setModel(oLocalModel);
        },

        getRouter() {
            return this.getOwnerComponent().getRouter();
        },

        _onRouteMatched(oEvent) {
            const sEmployeeId = oEvent.getParameter("arguments").employeeId;
            this._loadEmployeeDetail(sEmployeeId);
        },

        _loadEmployeeDetail(sEmployeeId) {
            const oModel = this.getView().getModel();
            const oLocalModel = this.getView().getModel();
            
            // Show loading
            this.getView().setBusy(true);
            
            // Load employee with expanded data
            oModel.read(`/Employees('${sEmployeeId}')`, {
                urlParameters: {
                    "$expand": "workMetrics,burnoutMetrics"
                },
                success: (oData) => {
                    this.getView().setBusy(false);
                    
                    // Set employee data
                    oLocalModel.setProperty("/employee", oData);
                    
                    // Set work metrics (take first one)
                    const oWorkMetrics = oData.workMetrics && oData.workMetrics.length > 0 ? 
                        oData.workMetrics[0] : {};
                    oLocalModel.setProperty("/workMetrics", oWorkMetrics);
                    
                    // Set burnout metrics (take first one)
                    const oBurnoutMetrics = oData.burnoutMetrics && oData.burnoutMetrics.length > 0 ? 
                        oData.burnoutMetrics[0] : {};
                    oLocalModel.setProperty("/burnoutMetrics", oBurnoutMetrics);
                    
                    // Generate recommendation actions
                    this._generateRecommendationActions(oBurnoutMetrics);
                },
                error: (oError) => {
                    this.getView().setBusy(false);
                    MessageBox.error("Failed to load employee details: " + oError.message);
                }
            });
        },

        _generateRecommendationActions(oBurnoutMetrics) {
            const aActions = [];
            
            if (oBurnoutMetrics.risk_level) {
                switch (oBurnoutMetrics.risk_level) {
                    case "Critical":
                        aActions.push({
                            title: "Immediate Intervention Required",
                            description: "Schedule urgent meeting with HR and manager",
                            icon: "sap-icon://warning"
                        });
                        aActions.push({
                            title: "Workload Reduction",
                            description: "Redistribute tasks immediately",
                            icon: "sap-icon://task"
                        });
                        break;
                    case "High":
                        aActions.push({
                            title: "Weekly Check-ins",
                            description: "Schedule regular manager meetings",
                            icon: "sap-icon://appointment-2"
                        });
                        aActions.push({
                            title: "Stress Management Resources",
                            description: "Provide access to wellness programs",
                            icon: "sap-icon://learning-assistant"
                        });
                        break;
                    case "Medium":
                        aActions.push({
                            title: "Workload Assessment",
                            description: "Review current task distribution",
                            icon: "sap-icon://task"
                        });
                        aActions.push({
                            title: "Flexible Work Options",
                            description: "Consider remote work or flexible hours",
                            icon: "sap-icon://home"
                        });
                        break;
                    case "Low":
                        aActions.push({
                            title: "Maintain Current Balance",
                            description: "Continue monitoring work-life balance",
                            icon: "sap-icon://status-positive"
                        });
                        break;
                }
            }
            
            // Add general actions
            aActions.push({
                title: "Career Development",
                description: "Discuss growth opportunities",
                icon: "sap-icon://learning-assistant"
            });
            
            this.getView().getModel().setProperty("/recommendationActions", aActions);
        },

        formatRiskState(sRiskLevel) {
            switch (sRiskLevel) {
                case "Low":
                    return "Success";
                case "Medium":
                    return "Warning";
                case "High":
                    return "Error";
                case "Critical":
                    return "Error";
                default:
                    return "None";
            }
        },

        formatDate(sDate) {
            if (!sDate) return "-";
            
            try {
                const oDate = new Date(sDate);
                return oDate.toLocaleDateString();
            } catch (e) {
                return "-";
            }
        },

        formatHtmlText(sText) {
            if (!sText) return "";
            
            // Convert markdown-like formatting to HTML
            let sHtml = sText
                .replace(/### (.*)/g, '<h3>$1</h3>')
                .replace(/## (.*)/g, '<h2>$1</h2>')
                .replace(/# (.*)/g, '<h1>$1</h1>')
                .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                .replace(/\*(.*?)\*/g, '<em>$1</em>')
                .replace(/- (.*)/g, '<li>$1</li>')
                .replace(/\n/g, '<br/>');
            
            // Wrap list items in ul tags
            if (sHtml.includes('<li>')) {
                sHtml = sHtml.replace(/(<li>.*<\/li>)/g, '<ul>$1</ul>');
            }
            
            return sHtml;
        },

        onGenerateAssessment() {
            const sEmployeeId = this.getView().getModel().getProperty("/employee/ID");
            const sEmployeeName = this.getView().getModel().getProperty("/employee/name");
            
            MessageBox.confirm(
                `Generate new AI-powered burnout assessment for ${sEmployeeName}?`,
                {
                    title: "Generate Assessment",
                    onClose: (sAction) => {
                        if (sAction === MessageBox.Action.OK) {
                            this._generateAssessment(sEmployeeId);
                        }
                    }
                }
            );
        },

        _generateAssessment(sEmployeeId) {
            const oModel = this.getView().getModel();
            
            // Show busy indicator
            this.getView().setBusy(true);
            
            // Call the CAP action
            oModel.callFunction("/generateBurnoutMetrics", {
                method: "POST",
                data: {
                    employeeId: sEmployeeId
                },
                success: (oData) => {
                    this.getView().setBusy(false);
                    MessageToast.show("Burnout assessment generated successfully!");
                    // Reload employee data
                    this._loadEmployeeDetail(sEmployeeId);
                },
                error: (oError) => {
                    this.getView().setBusy(false);
                    MessageBox.error("Failed to generate assessment: " + oError.message);
                }
            });
        },

        onRegenerateAssessment() {
            this.onGenerateAssessment();
        },

        onEditEmployee() {
            const sEmployeeName = this.getView().getModel().getProperty("/employee/name");
            MessageBox.information(`Edit functionality for ${sEmployeeName} would open an edit dialog.`);
        },

        onScheduleCheckin() {
            MessageBox.information("Schedule check-in functionality would integrate with calendar system.");
        },

        onViewHistory() {
            MessageBox.information("View history functionality would show assessment timeline.");
        },

        onExportReport() {
            const sEmployeeName = this.getView().getModel().getProperty("/employee/name");
            MessageToast.show(`Exporting burnout report for ${sEmployeeName}...`);
        },

        onActionPress(oEvent) {
            const oBindingContext = oEvent.getSource().getBindingContext();
            const sTitle = oBindingContext.getProperty("title");
            const sDescription = oBindingContext.getProperty("description");
            
            MessageBox.information(`Action: ${sTitle}\n\n${sDescription}`);
        }
    });
});
