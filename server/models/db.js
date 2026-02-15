const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const config = require('../config');

// Ensure database directory exists
const dbDir = path.dirname(config.dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new Database(config.dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Run schema
const schemaPath = path.join(__dirname, '../../database/schema.sql');
const schema = fs.readFileSync(schemaPath, 'utf8');
db.exec(schema);

// Seed default admin if users table is empty
const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get();
if (userCount.count === 0) {
  const bcrypt = require('bcryptjs');
  const hash = bcrypt.hashSync('admin123', 10);
  db.prepare(
    'INSERT INTO users (username, password_hash, role, real_name, phone) VALUES (?, ?, ?, ?, ?)'
  ).run('admin', hash, 'super_admin', '系统管理员', '13800000000');
  console.log('Default super admin created: admin / admin123');
}

// Seed default inspection items if table is empty
const itemCount = db.prepare('SELECT COUNT(*) as count FROM inspect_items').get();
if (itemCount.count === 0) {
  const defaultItems = [
    { key: 'floor_clean', name: '地面是否干净', type: 'radio', options: '["干净","脏污"]', required: 1, sort: 1 },
    { key: 'tissue_supply', name: '是否缺少纸巾', type: 'radio', options: '["充足","缺少"]', required: 1, sort: 2 },
    { key: 'soap_supply', name: '是否缺少洗手液', type: 'radio', options: '["充足","缺少"]', required: 1, sort: 3 },
    { key: 'equipment_status', name: '设备是否损坏', type: 'radio', options: '["正常","损坏"]', required: 1, sort: 4 },
    { key: 'notes', name: '备注说明', type: 'text', options: null, required: 0, sort: 5 },
  ];
  const insertItem = db.prepare(
    'INSERT INTO inspect_items (item_key, item_name, input_type, options, required, is_default, sort_order) VALUES (?, ?, ?, ?, ?, 1, ?)'
  );
  db.transaction(() => {
    for (const item of defaultItems) {
      insertItem.run(item.key, item.name, item.type, item.options, item.required, item.sort);
    }
  })();

  // Auto-link defaults to all existing areas
  const existingAreas = db.prepare('SELECT id FROM areas').all();
  const allDefaults = db.prepare('SELECT id, sort_order FROM inspect_items WHERE is_default = 1').all();
  if (existingAreas.length > 0 && allDefaults.length > 0) {
    const linkStmt = db.prepare('INSERT OR IGNORE INTO area_inspect_items (area_id, item_id, sort_order) VALUES (?, ?, ?)');
    db.transaction(() => {
      for (const area of existingAreas) {
        for (const item of allDefaults) {
          linkStmt.run(area.id, item.id, item.sort_order);
        }
      }
    })();
  }
  console.log('Default inspection items seeded');
}

module.exports = db;
