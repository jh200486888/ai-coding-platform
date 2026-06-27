module.exports = {
  apps: [{
    name: "ai-coding-platform",
    script: "node_modules/next/dist/bin/next",
    args: "start -p 5000",
    cwd: "/www/wwwroot/agent.piyiguo.com",
    interpreter: "node",
    env: {
      NODE_ENV: "production",
      PORT: 5000
    },
    max_memory_restart: "1G",
  }]
}
