/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Rayfin API base URL (e.g. http://localhost:5168). */
  readonly VITE_RAYFIN_API_URL?: string;
  /** Rayfin publishable key (pk-...). */
  readonly VITE_RAYFIN_PUBLISHABLE_KEY?: string;
  /** Fabric workspace ID — maps to FabricAuthOptions.workspaceId. */
  readonly VITE_FABRIC_WORKSPACE_ID?: string;
  /** Fabric/Rayfin item ID — maps to FabricAuthOptions.projectId. */
  readonly VITE_FABRIC_ITEM_ID?: string;
  /** Fabric portal base URL (e.g. https://app.fabric.microsoft.com/). */
  readonly VITE_FABRIC_PORTAL_URL?: string;
  /** "voorbeeld" runs on the bundled sample data instead of the semantic model. */
  readonly VITE_DATABRON?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
