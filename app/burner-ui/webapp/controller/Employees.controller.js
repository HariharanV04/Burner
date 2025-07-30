sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/m/MessageToast",
    "sap/m/MessageBox",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/ui/model/json/JSONModel"
], (Controller, MessageToast, MessageBox, Filter, FilterOperator, JSONModel) => {
    "use strict";

    return Controller.extend("burnerui.controller.Employees", {
        onInit() {
            this.getRouter().getRoute("RouteEmployees").attachPatternMatched(this._onRouteMatched, this);
            
            // Initialize local model for UI state
            const oLocalModel = new JSONModel({
                selectedEmployee: null
            });
            this.getView().setModel(oLocalModel, "local");
        },

        getRouter() {
            return this.getOwnerComponent().getRouter();
        },

        _onRouteMatched() {
            this._loadEmployees();
        },

        _loadEmployees() {
            const oModel = this.getView().getModel();
            
            // Load employees with expanded work metrics and burnout metrics
            oModel.read("/Employees", {
                urlParameters: {
                    "$expand": "workMetrics,burnoutMetrics"
                },
                success: (oData) => {
                    // Data is automatically bound to the table
                    console.log("Employees loaded:", oData.value.length);
                },
                error: (oError) => {
                    MessageBox.error("Failed to load employees: " + oError.message);
                }
            });
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

        onSearch(oEvent) {
            const sQuery = oEvent.getParameter("newValue");
            const oTable = this.byId("employeeTable");
            const oBinding = oTable.getBinding("items");
            
            if (sQuery && sQuery.length > 0) {
                const aFilters = [
                    new Filter("name", FilterOperator.Contains, sQuery),
                    new Filter("ID", FilterOperator.Contains, sQuery),
                    new Filter("department", FilterOperator.Contains, sQuery),
                    new Filter("role", FilterOperator.Contains, sQuery)
                ];
                const oFilter = new Filter({
                    filters: aFilters,
                    and: false
                });
                oBinding.filter([oFilter]);
            } else {
                oBinding.filter([]);
            }
        },

        onFilterChange() {
            const sDepartment = this.byId("departmentFilter").getSelectedKey();
            const sRiskLevel = this.byId("riskLevelFilter").getSelectedKey();
            
            const aFilters = [];
            
            if (sDepartment) {
                aFilters.push(new Filter("department", FilterOperator.EQ, sDepartment));
            }
            
            if (sRiskLevel) {
                aFilters.push(new Filter("burnoutMetrics/risk_level", FilterOperator.EQ, sRiskLevel));
            }
            
            const oTable = this.byId("employeeTable");
            const oBinding = oTable.getBinding("items");
            oBinding.filter(aFilters);
        },

        onClearFilters() {
            this.byId("departmentFilter").setSelectedKey("");
            this.byId("riskLevelFilter").setSelectedKey("");
            this.byId("employeeSearchField").setValue("");
            
            const oTable = this.byId("employeeTable");
            const oBinding = oTable.getBinding("items");
            oBinding.filter([]);
        },

        onRefresh() {
            this._loadEmployees();
            MessageToast.show("Employee data refreshed");
        },

        onEmployeeSelect(oEvent) {
            const oBindingContext = oEvent.getSource().getBindingContext();
            const oEmployee = oBindingContext.getObject();
            
            this.getView().getModel("local").setProperty("/selectedEmployee", oEmployee);
        },

        onAddEmployee() {
            MessageBox.information("Add Employee functionality would open a dialog to create new employees.");
        },

        onEditEmployee(oEvent) {
            const oBindingContext = oEvent.getSource().getBindingContext();
            const oEmployee = oBindingContext.getObject();
            
            MessageBox.information(`Edit Employee functionality for ${oEmployee.name} would open an edit dialog.`);
        },

        onViewDetails(oEvent) {
            const oBindingContext = oEvent.getSource().getBindingContext();
            const sEmployeeId = oBindingContext.getProperty("ID");
            
            this.getRouter().navTo("RouteEmployeeDetail", {
                employeeId: sEmployeeId
            });
        },

        onGenerateMetrics(oEvent) {
            const oBindingContext = oEvent.getSource().getBindingContext();
            const sEmployeeId = oBindingContext.getProperty("ID");
            const sEmployeeName = oBindingContext.getProperty("name");
            
            MessageBox.confirm(
                `Generate AI-powered burnout assessment for ${sEmployeeName}?`,
                {
                    title: "Generate Burnout Metrics",
                    onClose: (sAction) => {
                        if (sAction === MessageBox.Action.OK) {
                            this._generateMetricsForEmployee(sEmployeeId, sEmployeeName);
                        }
                    }
                }
            );
        },

        onGenerateSelectedMetrics() {
            const oSelectedEmployee = this.getView().getModel("local").getProperty("/selectedEmployee");
            
            if (oSelectedEmployee) {
                this._generateMetricsForEmployee(oSelectedEmployee.ID, oSelectedEmployee.name);
            }
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
                    MessageToast.show(`Burnout metrics generated for ${sEmployeeName}`);
                    this._loadEmployees(); // Refresh data
                },
                error: (oError) => {
                    this.getView().setBusy(false);
                    MessageBox.error(`Failed to generate burnout metrics for ${sEmployeeName}: ${oError.message}`);
                }
            });
        }
    });
});
