/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  readonly VITE_FIRES_API_URL?: string
  readonly VITE_FIRES_API_AUTH?: string
  readonly VITE_MAP_TILE_URL?: string
  readonly VITE_MAP_TILE_ATTRIBUTION?: string
  readonly VITE_REFRESH_MINUTES?: string
  readonly VITE_RECENT_HOURS?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
