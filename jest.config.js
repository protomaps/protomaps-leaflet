module.exports = {
  coverageProvider: "v8",
  testEnvironment: "node",
  transform: {
    "^.+\\.tsx?$": "esbuild-jest"
  }
};