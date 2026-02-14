module.exports = {
  apps: [{
    name: 'hotel-inspection',
    script: './server/server.js',
    instances: 1,
    env_production: {
      NODE_ENV: 'production',
      PORT: 3000,
      JWT_SECRET: 'change-this-to-a-secure-random-string',
    },
  }],
};
