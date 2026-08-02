/// <reference types="vite/client" />

import type { HearthApi } from "../../shared/contracts";

declare global {
  interface Window {
    hearth: HearthApi;
  }
}

export {};

