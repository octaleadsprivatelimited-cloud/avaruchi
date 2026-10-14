// Bundle the existing API for serverless runtimes without changing its source.
// This also converts Firebase's CommonJS -> ESM dependency boundary at build time.
export { createApp } from "../commerce-api/src/app.js";
