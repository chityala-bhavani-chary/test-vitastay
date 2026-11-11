require('dotenv').config();
const { sequelize } = require('../models');

const run = async () => {
  try {
    await sequelize.authenticate();
    console.log('Connected');

    const alterStatements = [
      `ALTER TABLE tenants ADD COLUMN full_name VARCHAR(255) NULL AFTER employee_id`,
      `ALTER TABLE tenants ADD COLUMN date_of_birth DATE NULL AFTER photo`,
      `ALTER TABLE tenants ADD COLUMN gender ENUM('male','female','other') NULL AFTER date_of_birth`,
      `ALTER TABLE tenants ADD COLUMN nationality VARCHAR(100) DEFAULT 'Indian' AFTER blood_group`,
      `ALTER TABLE tenants ADD COLUMN marital_status ENUM('single','married','divorced','widowed','other') NULL AFTER nationality`,
      `ALTER TABLE tenants ADD COLUMN alternate_phone VARCHAR(20) NULL AFTER marital_status`,
      `ALTER TABLE tenants ADD COLUMN permanent_address TEXT NULL AFTER alternate_phone`,
      `ALTER TABLE tenants ADD COLUMN current_address TEXT NULL AFTER permanent_address`,
      `ALTER TABLE tenants ADD COLUMN same_as_permanent TINYINT(1) DEFAULT 1 AFTER current_address`,
      `ALTER TABLE tenants ADD COLUMN voter_id VARCHAR(30) NULL AFTER driving_license`,
      `ALTER TABLE tenants ADD COLUMN emergency_contact_alternate VARCHAR(20) NULL AFTER emergency_contact_relation`,
      `ALTER TABLE tenants ADD COLUMN emergency_contact_address TEXT NULL AFTER emergency_contact_alternate`,
      `ALTER TABLE tenants ADD COLUMN guardian_email VARCHAR(255) NULL AFTER guardian_phone`,
      `ALTER TABLE tenants ADD COLUMN guardian_occupation VARCHAR(100) NULL AFTER guardian_email`,
      `ALTER TABLE tenants ADD COLUMN is_student TINYINT(1) DEFAULT 0 AFTER guardian_address`,
      `ALTER TABLE tenant_documents ADD COLUMN id_number VARCHAR(100) NULL AFTER title`,
      `ALTER TABLE tenant_documents ADD COLUMN back_file_path VARCHAR(500) NULL AFTER file_path`,
      `ALTER TABLE tenant_documents ADD COLUMN expiry_date DATE NULL AFTER back_file_path`,
      `ALTER TABLE tenant_documents MODIFY COLUMN document_type ENUM('aadhar','pan','passport','driving_license','voter_id','rent_agreement','other') NOT NULL`,
    ];

    for (const sql of alterStatements) {
      try {
        await sequelize.query(sql);
        console.log('OK:', sql.slice(0, 80));
      } catch (err) {
        if (String(err.message).includes('Duplicate column') || String(err.message).includes('already exists')) {
          console.log('Skip (exists):', sql.slice(0, 60));
        } else {
          console.log('Warn:', err.message);
        }
      }
    }

    console.log('Tenant form fields migration done');
    process.exit(0);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
};

run();
