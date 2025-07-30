sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/m/MessageToast",
    "sap/m/MessageBox",
    "sap/ui/model/json/JSONModel"
], (Controller, MessageToast, MessageBox, JSONModel) => {
    "use strict";

    return Controller.extend("burnerui.controller.KnowledgeBase", {
        onInit() {
            this.getRouter().getRoute("RouteKnowledgeBase").attachPatternMatched(this._onRouteMatched, this);
            
            // Initialize local model for knowledge base data
            const oLocalModel = new JSONModel({
                knowledgeFiles: []
            });
            this.getView().setModel(oLocalModel);
        },

        getRouter() {
            return this.getOwnerComponent().getRouter();
        },

        _onRouteMatched() {
            this._loadKnowledgeBaseStatus();
        },

        _loadKnowledgeBaseStatus() {
            const oModel = this.getView().getModel();
            
            // Call the RAG status function to get knowledge base information
            oModel.callFunction("/getRAGStatus", {
                method: "GET",
                success: (oData) => {
                    this._processKnowledgeBaseData(oData);
                },
                error: (oError) => {
                    MessageBox.error("Failed to load knowledge base status: " + oError.message);
                    this._setDefaultData();
                }
            });
        },

        _processKnowledgeBaseData(oData) {
            const oLocalModel = this.getView().getModel();
            
            // Update file count
            this.byId("totalFilesText").setText(oData.configuration.knowledgeBaseFiles.toString());
            
            // Set AI status
            if (oData.configuration.mistralApiConfigured) {
                this.byId("aiStatusText").setText("Ready").setState("Success");
                this.byId("apiStatusText").setText("Connected").setState("Success");
            } else {
                this.byId("aiStatusText").setText("Not Configured").setState("Error");
                this.byId("apiStatusText").setText("Disconnected").setState("Error");
            }
            
            // Set knowledge base status
            if (oData.configuration.knowledgeBaseFiles > 0) {
                this.byId("kbStatusText").setText("Loaded").setState("Success");
            } else {
                this.byId("kbStatusText").setText("Empty").setState("Warning");
            }
            
            // Create knowledge files data
            const aKnowledgeFiles = oData.configuration.knowledgeFiles.map(filename => ({
                filename: filename,
                content: this._getFileContent(filename)
            }));
            
            oLocalModel.setProperty("/knowledgeFiles", aKnowledgeFiles);
            
            // Set last updated (mock data)
            this.byId("lastUpdatedText").setText(new Date().toLocaleDateString());
            
            // Set AI model
            this.byId("aiModelText").setText(oData.configuration.mistralModel);
        },

        _setDefaultData() {
            // Set default values when API call fails
            this.byId("totalFilesText").setText("1");
            this.byId("lastUpdatedText").setText(new Date().toLocaleDateString());
            this.byId("aiStatusText").setText("Unknown").setState("Warning");
            this.byId("apiStatusText").setText("Unknown").setState("Warning");
            this.byId("kbStatusText").setText("Unknown").setState("Warning");
            this.byId("aiModelText").setText("Mistral Large Latest");
            
            // Set default knowledge files
            const oLocalModel = this.getView().getModel();
            oLocalModel.setProperty("/knowledgeFiles", [{
                filename: "burnout-guidelines.md",
                content: "# Employee Burnout Assessment Guidelines\n\n## Risk Level Definitions..."
            }]);
        },

        _getFileContent(filename) {
            // Mock content based on filename
            switch (filename) {
                case "burnout-guidelines.md":
                    return "# Employee Burnout Assessment Guidelines\n\n## Risk Level Definitions\n\n### Low Risk\n- Work hours: 35-40 hours per week\n- Overtime: Less than 5 hours per week\n- Vacation taken: 15+ days per year\n\n### Medium Risk\n- Work hours: 40-45 hours per week\n- Overtime: 5-10 hours per week\n- Vacation taken: 10-15 days per year\n\n## Department-Specific Considerations\n\n### Engineering\n- High-pressure deadlines and technical challenges\n- On-call responsibilities may increase stress\n- Continuous learning requirements\n\n### Marketing\n- Campaign deadlines and creative pressure\n- Client-facing stress\n- Seasonal workload variations";
                default:
                    return "Knowledge base content for " + filename;
            }
        },

        getFileType(filename) {
            if (!filename) return "Unknown";
            
            const extension = filename.split('.').pop().toLowerCase();
            switch (extension) {
                case "md":
                    return "Markdown";
                case "txt":
                    return "Text";
                default:
                    return "Document";
            }
        },

        getFileSize(content) {
            if (!content) return "0 KB";
            
            const sizeInBytes = new Blob([content]).size;
            const sizeInKB = (sizeInBytes / 1024).toFixed(1);
            return sizeInKB + " KB";
        },

        getContentPreview(content) {
            if (!content) return "No content";
            
            // Return first 100 characters
            return content.length > 100 ? content.substring(0, 100) + "..." : content;
        },

        onAddFile() {
            MessageBox.information(
                "Add File functionality would allow uploading new knowledge base files (.txt or .md format). " +
                "These files would be processed and made available to the AI system for burnout assessments."
            );
        },

        onRefresh() {
            this._loadKnowledgeBaseStatus();
            MessageToast.show("Knowledge base status refreshed");
        },

        onTestAI() {
            MessageBox.confirm(
                "Test the AI system by generating a sample burnout assessment?",
                {
                    title: "Test AI System",
                    onClose: (sAction) => {
                        if (sAction === MessageBox.Action.OK) {
                            this._testAISystem();
                        }
                    }
                }
            );
        },

        _testAISystem() {
            const oModel = this.getView().getModel();
            
            // Show busy indicator
            this.getView().setBusy(true);
            
            // Call the RAG status function as a test
            oModel.callFunction("/getRAGStatus", {
                method: "GET",
                success: (oData) => {
                    this.getView().setBusy(false);
                    
                    let sMessage = "AI System Test Results:\n\n";
                    sMessage += `✓ API Connection: ${oData.configuration.mistralApiConfigured ? 'Success' : 'Failed'}\n`;
                    sMessage += `✓ Knowledge Base: ${oData.configuration.knowledgeBaseFiles} files loaded\n`;
                    sMessage += `✓ AI Model: ${oData.configuration.mistralModel}\n`;
                    sMessage += `✓ System Status: ${oData.status}`;
                    
                    MessageBox.success(sMessage, {
                        title: "AI System Test Complete"
                    });
                },
                error: (oError) => {
                    this.getView().setBusy(false);
                    MessageBox.error("AI System Test Failed: " + oError.message);
                }
            });
        },

        onViewFile(oEvent) {
            const oBindingContext = oEvent.getSource().getBindingContext();
            const oFile = oBindingContext.getObject();
            
            MessageBox.information(
                `File: ${oFile.filename}\n\nContent Preview:\n${oFile.content.substring(0, 300)}...`,
                {
                    title: "View Knowledge Base File",
                    styleClass: "sapUiSizeCompact"
                }
            );
        },

        onEditFile(oEvent) {
            const oBindingContext = oEvent.getSource().getBindingContext();
            const oFile = oBindingContext.getObject();
            
            MessageBox.information(
                `Edit functionality for ${oFile.filename} would open a text editor dialog where you can modify the knowledge base content.`
            );
        },

        onDeleteFile(oEvent) {
            const oBindingContext = oEvent.getSource().getBindingContext();
            const oFile = oBindingContext.getObject();
            
            MessageBox.confirm(
                `Are you sure you want to delete ${oFile.filename}? This will affect AI assessments.`,
                {
                    title: "Delete Knowledge Base File",
                    onClose: (sAction) => {
                        if (sAction === MessageBox.Action.OK) {
                            MessageToast.show(`${oFile.filename} would be deleted from the knowledge base`);
                        }
                    }
                }
            );
        }
    });
});
