sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/m/MessageToast",
    "sap/m/MessageBox",
    "sap/ui/model/json/JSONModel"
], (Controller, MessageToast, MessageBox, JSONModel) => {
    "use strict";

    return Controller.extend("burnerui.controller.Analytics", {
        onInit() {
            this.getRouter().getRoute("RouteAnalytics").attachPatternMatched(this._onRouteMatched, this);
            this._initializeCharts();
        },

        getRouter() {
            return this.getOwnerComponent().getRouter();
        },

        _onRouteMatched() {
            this._loadAnalyticsData();
        },

        _initializeCharts() {
            // Initialize chart models
            const oRiskChartModel = new JSONModel({
                data: []
            });
            this.getView().setModel(oRiskChartModel, "riskChart");

            const oDeptChartModel = new JSONModel({
                data: []
            });
            this.getView().setModel(oDeptChartModel, "deptChart");
        },

        _loadAnalyticsData() {
            const oModel = this.getView().getModel();
            
            // Load burnout metrics with expanded employee and work metrics data
            oModel.read("/BurnoutMetrics", {
                urlParameters: {
                    "$expand": "employee($expand=workMetrics)"
                },
                success: (oData) => {
                    this._processAnalyticsData(oData.value);
                },
                error: (oError) => {
                    MessageBox.error("Failed to load analytics data: " + oError.message);
                }
            });
        },

        _processAnalyticsData(aMetrics) {
            // Process risk distribution
            this._processRiskDistribution(aMetrics);
            
            // Process department insights
            this._processDepartmentInsights(aMetrics);
            
            // Process trends
            this._processTrends(aMetrics);
            
            // Update charts
            this._updateCharts(aMetrics);
        },

        _processRiskDistribution(aMetrics) {
            const oRiskCounts = {
                Low: 0,
                Medium: 0,
                High: 0,
                Critical: 0
            };

            aMetrics.forEach(metric => {
                if (oRiskCounts.hasOwnProperty(metric.risk_level)) {
                    oRiskCounts[metric.risk_level]++;
                }
            });

            this.byId("lowRiskCount").setText(oRiskCounts.Low.toString());
            this.byId("mediumRiskCount").setText(oRiskCounts.Medium.toString());
            this.byId("highRiskCount").setText(oRiskCounts.High.toString());
            this.byId("criticalRiskCount").setText(oRiskCounts.Critical.toString());
        },

        _processDepartmentInsights(aMetrics) {
            const oDeptRisk = {};
            let totalWorkHours = 0;
            let workHoursCount = 0;

            aMetrics.forEach(metric => {
                if (metric.employee && metric.employee.department) {
                    const sDept = metric.employee.department;
                    
                    if (!oDeptRisk[sDept]) {
                        oDeptRisk[sDept] = { high: 0, total: 0 };
                    }
                    
                    oDeptRisk[sDept].total++;
                    if (metric.risk_level === "High" || metric.risk_level === "Critical") {
                        oDeptRisk[sDept].high++;
                    }

                    // Calculate average work hours
                    if (metric.employee.workMetrics && metric.employee.workMetrics.length > 0) {
                        const workHours = metric.employee.workMetrics[0].work_hours;
                        if (workHours) {
                            totalWorkHours += workHours;
                            workHoursCount++;
                        }
                    }
                }
            });

            // Find department with highest risk percentage
            let highestRiskDept = "-";
            let highestRiskPercentage = 0;

            Object.keys(oDeptRisk).forEach(dept => {
                const percentage = (oDeptRisk[dept].high / oDeptRisk[dept].total) * 100;
                if (percentage > highestRiskPercentage) {
                    highestRiskPercentage = percentage;
                    highestRiskDept = dept;
                }
            });

            this.byId("highestRiskDept").setText(highestRiskDept);
            this.byId("avgWorkHours").setText(
                workHoursCount > 0 ? (totalWorkHours / workHoursCount).toFixed(1) + " hrs" : "-"
            );
            this.byId("totalAssessments").setText(aMetrics.length.toString());
        },

        _processTrends(aMetrics) {
            const aCauses = [];
            let totalOvertime = 0;
            let overtimeCount = 0;
            let totalVacation = 0;
            let vacationCount = 0;

            aMetrics.forEach(metric => {
                // Extract common causes (simplified)
                if (metric.cause) {
                    aCauses.push(metric.cause);
                }

                if (metric.employee && metric.employee.workMetrics && metric.employee.workMetrics.length > 0) {
                    const workMetric = metric.employee.workMetrics[0];
                    
                    if (workMetric.overtime_hours) {
                        totalOvertime += workMetric.overtime_hours;
                        overtimeCount++;
                    }
                    
                    if (workMetric.vacation_taken) {
                        totalVacation += workMetric.vacation_taken;
                        vacationCount++;
                    }
                }
            });

            // Find most common cause (simplified - just take first word of first cause)
            const sCommonCause = aCauses.length > 0 ? 
                aCauses[0].split(' ').slice(0, 3).join(' ') + "..." : "-";

            this.byId("commonCause").setText(sCommonCause);
            this.byId("avgOvertime").setText(
                overtimeCount > 0 ? (totalOvertime / overtimeCount).toFixed(1) + " hrs" : "-"
            );
            this.byId("avgVacation").setText(
                vacationCount > 0 ? (totalVacation / vacationCount).toFixed(1) + " days" : "-"
            );
        },

        _updateCharts(aMetrics) {
            // Update risk level chart data
            const aRiskData = [
                { risk: "Low", count: aMetrics.filter(m => m.risk_level === "Low").length },
                { risk: "Medium", count: aMetrics.filter(m => m.risk_level === "Medium").length },
                { risk: "High", count: aMetrics.filter(m => m.risk_level === "High").length },
                { risk: "Critical", count: aMetrics.filter(m => m.risk_level === "Critical").length }
            ];

            this.getView().getModel("riskChart").setData({ data: aRiskData });

            // Update department chart data
            const oDeptData = {};
            aMetrics.forEach(metric => {
                if (metric.employee && metric.employee.department) {
                    const sDept = metric.employee.department;
                    if (!oDeptData[sDept]) {
                        oDeptData[sDept] = 0;
                    }
                    oDeptData[sDept]++;
                }
            });

            const aDeptData = Object.keys(oDeptData).map(dept => ({
                department: dept,
                count: oDeptData[dept]
            }));

            this.getView().getModel("deptChart").setData({ data: aDeptData });

            // Render simple charts (using HTML/CSS since VizFrame requires additional setup)
            this._renderSimpleCharts(aRiskData, aDeptData);
        },

        _renderSimpleCharts(aRiskData, aDeptData) {
            // Create simple HTML charts
            const oRiskContainer = this.byId("riskChartContainer");
            const oDeptContainer = this.byId("deptChartContainer");

            // Clear existing content
            oRiskContainer.removeAllItems();
            oDeptContainer.removeAllItems();

            // Risk level chart (simple bars)
            aRiskData.forEach(item => {
                if (item.count > 0) {
                    const oBar = new sap.m.VBox({
                        items: [
                            new sap.m.Text({ text: item.risk }),
                            new sap.m.ProgressIndicator({
                                percentValue: (item.count / Math.max(...aRiskData.map(d => d.count))) * 100,
                                displayValue: item.count.toString(),
                                state: this._getRiskProgressState(item.risk)
                            })
                        ]
                    });
                    oRiskContainer.addItem(oBar);
                }
            });

            // Department chart (simple bars)
            aDeptData.forEach(item => {
                const oBar = new sap.m.VBox({
                    items: [
                        new sap.m.Text({ text: item.department }),
                        new sap.m.ProgressIndicator({
                            percentValue: (item.count / Math.max(...aDeptData.map(d => d.count))) * 100,
                            displayValue: item.count.toString(),
                            state: "Information"
                        })
                    ]
                });
                oDeptContainer.addItem(oBar);
            });
        },

        _getRiskProgressState(sRisk) {
            switch (sRisk) {
                case "Low": return "Success";
                case "Medium": return "Warning";
                case "High": return "Error";
                case "Critical": return "Error";
                default: return "None";
            }
        },

        formatRiskState(sRiskLevel) {
            switch (sRiskLevel) {
                case "Low": return "Success";
                case "Medium": return "Warning";
                case "High": return "Error";
                case "Critical": return "Error";
                default: return "None";
            }
        },

        formatCauseSummary(sCause) {
            if (!sCause) return "-";
            // Return first 50 characters
            return sCause.length > 50 ? sCause.substring(0, 50) + "..." : sCause;
        },

        onRefreshAnalytics() {
            this._loadAnalyticsData();
            MessageToast.show("Analytics data refreshed");
        },

        onExportData() {
            MessageToast.show("Export functionality would download analytics data as CSV/Excel");
        },

        onViewEmployeeDetails(oEvent) {
            const oBindingContext = oEvent.getSource().getBindingContext();
            const sEmployeeId = oBindingContext.getProperty("employee_ID");
            
            this.getRouter().navTo("RouteEmployeeDetail", {
                employeeId: sEmployeeId
            });
        }
    });
});
