import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // The backend's default CORS origin is http://localhost:5173, so don't silently move ports.
  server: { port: 5173, strictPort: true },
});
