/**
 * PM2 process file for the Vita Stay API.
 * Keep instances: 1 while uploads live on local disk — clustering would split files.
 */
module.exports = {
  apps: [
    {
      name: 'vitastay-api',
      cwd: '/var/www/vitastay/vitastay_new_back',
      script: 'server.js',
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      max_memory_restart: '512M',
      env_file: '/etc/vitastay/api.env',
      env: {
        NODE_ENV: 'production',
      },
      error_file: '/var/log/vitastay/api.err.log',
      out_file: '/var/log/vitastay/api.out.log',
      merge_logs: true,
      time: true,
    },
  ],
};
