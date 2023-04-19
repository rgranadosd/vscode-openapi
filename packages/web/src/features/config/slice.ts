import { createSlice, PayloadAction, Dispatch, StateFromReducersMapObject } from "@reduxjs/toolkit";
import { useDispatch, useSelector, TypedUseSelectorHook } from "react-redux";

import { Config, ConnectionTestResult } from "@xliic/common/config";

export interface ConfigState {
  ready: boolean;
  data: Config;
  platformConnectionTestResult?: ConnectionTestResult;
  waitingForPlatformConnectionTest: boolean;
  overlordConnectionTestResult?: ConnectionTestResult;
  waitingForOverlordConnectionTest: boolean;
  scandManagerConnectionTestResult?: ConnectionTestResult;
  waitingForScandManagerConnectionTest: boolean;
}

const initialState: ConfigState = {
  ready: false,
  data: {
    insecureSslHostnames: [],
    platformUrl: "https://platform.42crunch.com",
    platformApiToken: "",
    platformServices: {
      source: "auto",
      manual: undefined,
      auto: "services.42crunch.com:8001",
    },
    scandManager: {
      url: "",
      auth: "none",
      header: {
        name: "",
        value: "",
      },
    },
    scanRuntime: "docker",
    scanImage: "",
  },
  platformConnectionTestResult: undefined,
  waitingForPlatformConnectionTest: false,
  overlordConnectionTestResult: undefined,
  waitingForOverlordConnectionTest: false,
  scandManagerConnectionTestResult: undefined,
  waitingForScandManagerConnectionTest: false,
};

export const slice = createSlice({
  name: "config",
  initialState,
  reducers: {
    loadConfig: (state, action: PayloadAction<Config>) => {
      state.data = action.payload;
      state.ready = true;
    },

    saveConfig: (state, action: PayloadAction<Config>) => {
      // this is also a hook for a listener
      state.data = action.payload;
      state.platformConnectionTestResult = undefined;
      state.overlordConnectionTestResult = undefined;
      state.scandManagerConnectionTestResult = undefined;
    },

    testPlatformConnection: (state, action: PayloadAction<undefined>) => {
      state.waitingForPlatformConnectionTest = true;
      // hook for a listener
    },

    showPlatformConnectionTest: (state, action: PayloadAction<ConnectionTestResult>) => {
      state.platformConnectionTestResult = action.payload;
      state.waitingForPlatformConnectionTest = false;
    },

    testOverlordConnection: (state, action: PayloadAction<undefined>) => {
      state.waitingForOverlordConnectionTest = true;
      // hook for a listener
    },

    showOverlordConnectionTest: (state, action: PayloadAction<ConnectionTestResult>) => {
      state.overlordConnectionTestResult = action.payload;
      state.waitingForOverlordConnectionTest = false;
    },

    testScandManagerConnection: (state, action: PayloadAction<undefined>) => {
      state.waitingForScandManagerConnectionTest = true;
      // hook for a listener
    },

    showScandManagerConnectionTest: (state, action: PayloadAction<ConnectionTestResult>) => {
      state.scandManagerConnectionTestResult = action.payload;
      state.waitingForScandManagerConnectionTest = false;
    },

    showConfigWindow: (state, action: PayloadAction<undefined>) => {
      // hook for a listener
    },
  },
});

export const {
  loadConfig,
  saveConfig,
  showConfigWindow,
  testPlatformConnection,
  showPlatformConnectionTest,
  testOverlordConnection,
  showOverlordConnectionTest,
  testScandManagerConnection,
  showScandManagerConnectionTest,
} = slice.actions;

export const useFeatureDispatch: () => Dispatch<
  ReturnType<(typeof slice.actions)[keyof typeof slice.actions]>
> = useDispatch;

export const useFeatureSelector: TypedUseSelectorHook<
  StateFromReducersMapObject<Record<typeof slice.name, typeof slice.reducer>>
> = useSelector;

export default slice.reducer;