sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/m/MessageBox",
    "sap/m/MessageToast"
], (Controller, MessageBox, MessageToast) => {
    "use strict";

    return Controller.extend("burnerui.controller.Main", {
        onInit() {
            console.log("Main controller initialized");
            this.getRouter().getRoute("RouteMain").attachPatternMatched(this._onRouteMatched, this);
        },

        getRouter() {
            return this.getOwnerComponent().getRouter();
        },

        _onRouteMatched() {
            // Load dashboard data when route is matched
            this._loadDashboardData();
        },

        _loadDashboardData() {
            this._loadKPIs();
            this._loadRecentAssessments();
        },

        _loadKPIs() {
            const oModel = this.getView().getModel();

            // Load employees with expanded data for comprehensive analysis
            oModel.read("/Employees", {
                urlParameters: {
                    "$expand": "workMetrics,burnoutMetrics"
                },
                success: (oData) => {
                    const aEmployees = oData.value;
                    this._processEmployeeData(aEmployees);
                },
                error: (oError) => {
                    console.error("Error loading employees:", oError);
                    this._setDefaultKPIs();
                }
            });
        },

        _processEmployeeData(aEmployees) {
            // Basic counts
            this.byId("totalEmployeesText").setText(aEmployees.length.toString());

            // Process work metrics and burnout data
            let totalWorkHours = 0, workHoursCount = 0;
            let totalOvertime = 0, overtimeCount = 0;
            let totalVacation = 0, vacationCount = 0;
            let highRiskCount = 0, criticalRiskCount = 0;
            let aiAssessmentCount = 0;

            const departmentData = {};
            const riskFactors = [];

            aEmployees.forEach(employee => {
                // Process work metrics
                if (employee.workMetrics && employee.workMetrics.length > 0) {
                    const workMetric = employee.workMetrics[0];
                    if (workMetric.work_hours) {
                        totalWorkHours += workMetric.work_hours;
                        workHoursCount++;
                    }
                    if (workMetric.overtime_hours) {
                        totalOvertime += workMetric.overtime_hours;
                        overtimeCount++;
                    }
                    if (workMetric.vacation_taken) {
                        totalVacation += workMetric.vacation_taken;
                        vacationCount++;
                    }
                }

                // Process burnout metrics
                if (employee.burnoutMetrics && employee.burnoutMetrics.length > 0) {
                    const burnoutMetric = employee.burnoutMetrics[0];
                    aiAssessmentCount++;

                    if (burnoutMetric.risk_level === "High") {
                        highRiskCount++;
                    } else if (burnoutMetric.risk_level === "Critical") {
                        criticalRiskCount++;
                        highRiskCount++; // Critical is also high risk
                    }

                    if (burnoutMetric.cause) {
                        riskFactors.push(burnoutMetric.cause);
                    }
                }

                // Process department data
                if (employee.department) {
                    if (!departmentData[employee.department]) {
                        departmentData[employee.department] = {
                            department: employee.department,
                            totalEmployees: 0,
                            highRiskCount: 0,
                            totalWorkHours: 0,
                            totalOvertime: 0,
                            workHoursCount: 0,
                            overtimeCount: 0
                        };
                    }

                    const dept = departmentData[employee.department];
                    dept.totalEmployees++;

                    if (employee.burnoutMetrics && employee.burnoutMetrics.length > 0) {
                        const risk = employee.burnoutMetrics[0].risk_level;
                        if (risk === "High" || risk === "Critical") {
                            dept.highRiskCount++;
                        }
                    }

                    if (employee.workMetrics && employee.workMetrics.length > 0) {
                        const wm = employee.workMetrics[0];
                        if (wm.work_hours) {
                            dept.totalWorkHours += wm.work_hours;
                            dept.workHoursCount++;
                        }
                        if (wm.overtime_hours) {
                            dept.totalOvertime += wm.overtime_hours;
                            dept.overtimeCount++;
                        }
                    }
                }
            });

            // Update primary KPI cards
            this.byId("highRiskText").setText(highRiskCount.toString());
            this.byId("avgWorkHoursText").setText(
                workHoursCount > 0 ? (totalWorkHours / workHoursCount).toFixed(1) : "0"
            );
            this.byId("aiAssessmentsText").setText(aiAssessmentCount.toString());

            // Update secondary KPI cards
            this.byId("criticalRiskText").setText(criticalRiskCount.toString());
            this.byId("avgOvertimeText").setText(
                overtimeCount > 0 ? (totalOvertime / overtimeCount).toFixed(1) : "0"
            );
            this.byId("avgVacationText").setText(
                vacationCount > 0 ? (totalVacation / vacationCount).toFixed(1) : "0"
            );
            this.byId("departmentCountText").setText(Object.keys(departmentData).length.toString());

            // Risk trend (simplified)
            const riskPercentage = aEmployees.length > 0 ? (highRiskCount / aEmployees.length) * 100 : 0;
            let trendText = "Stable";
            if (riskPercentage > 30) trendText = "High";
            else if (riskPercentage > 15) trendText = "Moderate";
            else if (riskPercentage < 5) trendText = "Low";
            this.byId("riskTrendText").setText(trendText);

            // System status
            this.byId("systemStatusText").setText("Online").setState("Success");

            // Process insights
            this._processInsights(departmentData, riskFactors, highRiskCount);

            // Update charts
            this._updateDashboardCharts(aEmployees, departmentData);
        },

        _setDefaultKPIs() {
            // Set default values when data loading fails
            this.byId("totalEmployeesText").setText("0");
            this.byId("highRiskText").setText("0");
            this.byId("avgWorkHoursText").setText("0");
            this.byId("aiAssessmentsText").setText("0");
            this.byId("criticalRiskText").setText("0");
            this.byId("avgOvertimeText").setText("0");
            this.byId("avgVacationText").setText("0");
            this.byId("departmentCountText").setText("0");
            this.byId("riskTrendText").setText("Unknown");
            this.byId("systemStatusText").setText("Offline").setState("Error");
        },

        _processInsights(departmentData, riskFactors, highRiskCount) {
            // Find highest risk department
            let highestRiskDept = "-";
            let highestRiskPercentage = 0;

            Object.values(departmentData).forEach(dept => {
                const riskPercentage = dept.totalEmployees > 0 ?
                    (dept.highRiskCount / dept.totalEmployees) * 100 : 0;
                if (riskPercentage > highestRiskPercentage) {
                    highestRiskPercentage = riskPercentage;
                    highestRiskDept = dept.department;
                }
            });

            this.byId("highestRiskDeptText").setText(highestRiskDept);

            // Most common risk factor (simplified)
            const commonFactor = riskFactors.length > 0 ?
                this._getMostCommonFactor(riskFactors) : "No data";
            this.byId("commonRiskFactor").setText(commonFactor);

            // Employees needing attention
            this.byId("attentionNeeded").setText(highRiskCount.toString());

            // Update AI recommendation message
            this._updateAIRecommendation(highRiskCount);
        },

        _getMostCommonFactor(riskFactors) {
            // Extract common keywords from risk factors
            const keywords = [];
            riskFactors.forEach(factor => {
                if (factor) {
                    const words = factor.toLowerCase().split(' ');
                    words.forEach(word => {
                        if (word.length > 3) { // Only consider meaningful words
                            keywords.push(word);
                        }
                    });
                }
            });

            // Count frequency
            const frequency = {};
            keywords.forEach(word => {
                frequency[word] = (frequency[word] || 0) + 1;
            });

            // Find most common
            let mostCommon = "Work-life balance";
            let maxCount = 0;
            Object.entries(frequency).forEach(([word, count]) => {
                if (count > maxCount) {
                    maxCount = count;
                    mostCommon = word.charAt(0).toUpperCase() + word.slice(1);
                }
            });

            return mostCommon;
        },

        _updateAIRecommendation(highRiskCount) {
            const oMessageStrip = this.byId("aiRecommendationStrip");
            let message = "System ready for analysis. Generate burnout metrics to get AI-powered insights.";
            let type = "Information";

            if (highRiskCount > 5) {
                message = "⚠️ Multiple employees at high risk! Immediate intervention recommended. Consider workload redistribution and wellness programs.";
                type = "Error";
            } else if (highRiskCount > 2) {
                message = "⚡ Several employees showing burnout risk. Monitor closely and consider preventive measures.";
                type = "Warning";
            } else if (highRiskCount === 0) {
                message = "✅ All employees in good standing! Continue current wellness practices and regular monitoring.";
                type = "Success";
            } else if (highRiskCount > 0) {
                message = "📊 Some employees at risk. Review individual cases and provide targeted support.";
                type = "Warning";
            }

            oMessageStrip.setText(message).setType(type);
        },

        _updateDashboardCharts(aEmployees, departmentData) {
            // Update risk distribution chart
            const riskCounts = { Low: 0, Medium: 0, High: 0, Critical: 0 };

            aEmployees.forEach(employee => {
                if (employee.burnoutMetrics && employee.burnoutMetrics.length > 0) {
                    const risk = employee.burnoutMetrics[0].risk_level;
                    if (riskCounts.hasOwnProperty(risk)) {
                        riskCounts[risk]++;
                    }
                }
            });

            this._renderRiskChart(riskCounts);
            this._renderDepartmentChart(departmentData);
        },

        _renderRiskChart(riskCounts) {
            const oContainer = this.byId("riskBarsContainer");
            oContainer.removeAllItems();

            const maxCount = Math.max(...Object.values(riskCounts));

            if (maxCount === 0) {
                oContainer.addItem(new sap.m.Text({
                    text: "No burnout assessments available. Generate metrics to see risk distribution.",
                    class: "sapUiMediumText"
                }));
                return;
            }

            Object.entries(riskCounts).forEach(([risk, count]) => {
                if (count > 0) {
                    const percentage = maxCount > 0 ? (count / maxCount) * 100 : 0;

                    const oBar = new sap.m.VBox({
                        items: [
                            new sap.m.HBox({
                                justifyContent: "SpaceBetween",
                                items: [
                                    new sap.m.Text({ text: risk, class: "sapUiMediumText" }),
                                    new sap.m.Text({ text: count.toString(), class: "sapUiMediumText" })
                                ]
                            }),
                            new sap.m.ProgressIndicator({
                                percentValue: percentage,
                                displayValue: "",
                                state: this._getRiskProgressState(risk),
                                width: "100%"
                            })
                        ],
                        class: "sapUiTinyMarginBottom"
                    });

                    oContainer.addItem(oBar);
                }
            });
        },

        _renderDepartmentChart(departmentData) {
            const oContainer = this.byId("deptBarsContainer");
            oContainer.removeAllItems();

            const departments = Object.values(departmentData);

            if (departments.length === 0) {
                oContainer.addItem(new sap.m.Text({
                    text: "No department data available.",
                    class: "sapUiMediumText"
                }));
                return;
            }

            const maxEmployees = Math.max(...departments.map(d => d.totalEmployees));

            departments.forEach(dept => {
                const percentage = maxEmployees > 0 ? (dept.totalEmployees / maxEmployees) * 100 : 0;
                const riskPercentage = dept.totalEmployees > 0 ?
                    (dept.highRiskCount / dept.totalEmployees) * 100 : 0;

                const oBar = new sap.m.VBox({
                    items: [
                        new sap.m.HBox({
                            justifyContent: "SpaceBetween",
                            items: [
                                new sap.m.Text({ text: dept.department, class: "sapUiMediumText" }),
                                new sap.m.Text({ text: `${dept.totalEmployees} (${riskPercentage.toFixed(0)}% risk)`, class: "sapUiTinyText" })
                            ]
                        }),
                        new sap.m.ProgressIndicator({
                            percentValue: percentage,
                            displayValue: "",
                            state: riskPercentage > 20 ? "Error" : riskPercentage > 10 ? "Warning" : "Success",
                            width: "100%"
                        })
                    ],
                    class: "sapUiTinyMarginBottom"
                });

                oContainer.addItem(oBar);
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

        _loadRecentAssessments() {
            // The table is bound to the model, so it will automatically load
            // when the model is available
        },

        // Navigation methods
        onViewEmployees() {
            this.getRouter().navTo("RouteEmployees");
        },

        onViewAnalytics() {
            this.getRouter().navTo("RouteAnalytics");
        },

        onManageKnowledge() {
            this.getRouter().navTo("RouteKnowledgeBase");
        },

        onRefreshDashboard() {
            this._loadKPIs();
            this._loadRecentAssessments();
            MessageToast.show("Dashboard data refreshed");
        },

        onViewHighRiskEmployees() {
            // Navigate to employees view with high risk filter
            this.getRouter().navTo("RouteEmployees", {}, {
                query: {
                    filter: "high-risk"
                }
            });
        },

        onGenerateAllMetrics() {
            MessageBox.confirm(
                "Generate AI-powered burnout assessments for all employees? This may take a few minutes.",
                {
                    title: "Generate All Burnout Metrics",
                    onClose: (sAction) => {
                        if (sAction === MessageBox.Action.OK) {
                            this._generateAllMetrics();
                        }
                    }
                }
            );
        },

        _generateAllMetrics() {
            const oModel = this.getView().getModel();

            // Show busy indicator
            this.getView().setBusy(true);

            // Call the CAP action to generate metrics for all employees
            oModel.callFunction("/generateAllBurnoutMetrics", {
                method: "POST",
                success: (oData) => {
                    this.getView().setBusy(false);
                    MessageToast.show("Burnout metrics generated for all employees");
                    this._loadKPIs(); // Refresh KPIs
                    this._loadRecentAssessments(); // Refresh recent assessments
                },
                error: (oError) => {
                    this.getView().setBusy(false);
                    MessageBox.error("Failed to generate burnout metrics: " + oError.message);
                }
            });
        },

        onRegenerateAssessment(oEvent) {
            const oBindingContext = oEvent.getSource().getBindingContext();
            const sEmployeeId = oBindingContext.getProperty("employee_ID");
            const sEmployeeName = oBindingContext.getProperty("employee/name");

            MessageBox.confirm(
                `Regenerate AI burnout assessment for ${sEmployeeName}?`,
                {
                    title: "Regenerate Assessment",
                    onClose: (sAction) => {
                        if (sAction === MessageBox.Action.OK) {
                            this._generateMetricsForEmployee(sEmployeeId, sEmployeeName);
                        }
                    }
                }
            );
        },

        _generateMetricsForEmployee(sEmployeeId, sEmployeeName) {
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
                    MessageToast.show(`Burnout metrics regenerated for ${sEmployeeName}`);
                    this._loadDashboardData(); // Refresh data
                },
                error: (oError) => {
                    this.getView().setBusy(false);
                    MessageBox.error(`Failed to regenerate burnout metrics for ${sEmployeeName}: ${oError.message}`);
                }
            });
        },

        onEmployeePress(oEvent) {
            const oBindingContext = oEvent.getSource().getBindingContext();
            const sEmployeeId = oBindingContext.getProperty("employee_ID");
            this.getRouter().navTo("RouteEmployeeDetail", {
                employeeId: sEmployeeId
            });
        },

        onViewEmployeeDetails(oEvent) {
            const oBindingContext = oEvent.getSource().getBindingContext();
            const sEmployeeId = oBindingContext.getProperty("employee_ID");
            this.getRouter().navTo("RouteEmployeeDetail", {
                employeeId: sEmployeeId
            });
        },

        formatRiskState(sRiskLevel) {
            switch (sRiskLevel) {
                case "Low": return "Success";
                case "Medium": return "Warning";
                case "High": return "Error";
                case "Critical": return "Error";
                default: return "None";
            }
        }
    });
});
