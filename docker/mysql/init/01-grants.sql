-- Runs only on an empty vitastay_mysql volume.
-- App user can also own isolated vitastay_* hostel databases created at approve-time.

GRANT ALL PRIVILEGES ON `vitastay_%`.* TO 'nivas_user'@'%';
FLUSH PRIVILEGES;
