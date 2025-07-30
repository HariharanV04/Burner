sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/m/MessageToast"
], (BaseController, MessageToast) => {
  "use strict";

  return BaseController.extend("burnerui.controller.App", {
      onInit() {
          // Initialize the router
          this.getRouter().initialize();
      },

      getRouter() {
          return this.getOwnerComponent().getRouter();
      },

      onMenuButtonPress() {
          const oSplitApp = this.byId("app");
          const bCurrentlyHidden = oSplitApp.isMasterShown();
          oSplitApp.setMode(bCurrentlyHidden ? "HideMode" : "ShowHideMode");
      },

      onHomePress() {
          this.getRouter().navTo("RouteMain");
      },

      onAvatarPress() {
          MessageToast.show("User profile functionality");
      },

      onNavigationItemPress(oEvent) {
          const oItem = oEvent.getSource();
          const sRoute = oItem.data("route");

          if (sRoute) {
              this.getRouter().navTo(sRoute);

              // Hide master on phone
              const oSplitApp = this.byId("app");
              if (oSplitApp.getMode() === "ShowHideMode") {
                  oSplitApp.hideMaster();
              }
          }
      }
  });
});