const db = require('./db');

const InspectItem = {
  findAll() {
    return db.prepare(
      'SELECT * FROM inspect_items ORDER BY sort_order, id'
    ).all().map(row => ({
      ...row,
      options: row.options ? JSON.parse(row.options) : null,
    }));
  },

  findById(id) {
    const row = db.prepare('SELECT * FROM inspect_items WHERE id = ?').get(id);
    if (row && row.options) row.options = JSON.parse(row.options);
    return row;
  },

  create({ itemKey, itemName, inputType, options, required }) {
    const optionsJson = options ? JSON.stringify(options) : null;
    const maxOrder = db.prepare('SELECT MAX(sort_order) as m FROM inspect_items').get();
    const sortOrder = (maxOrder.m || 0) + 1;
    const result = db.prepare(
      'INSERT INTO inspect_items (item_key, item_name, input_type, options, required, is_default, sort_order) VALUES (?, ?, ?, ?, ?, 0, ?)'
    ).run(itemKey, itemName, inputType, optionsJson, required ? 1 : 0, sortOrder);
    return result.lastInsertRowid;
  },

  update(id, { itemName, inputType, options, required }) {
    const optionsJson = options ? JSON.stringify(options) : null;
    db.prepare(
      'UPDATE inspect_items SET item_name = ?, input_type = ?, options = ?, required = ? WHERE id = ?'
    ).run(itemName, inputType, optionsJson, required ? 1 : 0, id);
  },

  delete(id) {
    db.prepare('DELETE FROM inspect_items WHERE id = ?').run(id);
  },

  // Get enabled items for an area (used by mobile inspect form)
  findByAreaId(areaId) {
    return db.prepare(`
      SELECT i.*, ai.sort_order as area_sort_order
      FROM inspect_items i
      JOIN area_inspect_items ai ON ai.item_id = i.id
      WHERE ai.area_id = ?
      ORDER BY ai.sort_order, i.sort_order, i.id
    `).all(areaId).map(row => ({
      ...row,
      options: row.options ? JSON.parse(row.options) : null,
    }));
  },

  // All items with enabled flag for a given area (used by admin checkbox list)
  findAllWithAreaStatus(areaId) {
    return db.prepare(`
      SELECT i.*,
             CASE WHEN ai.id IS NOT NULL THEN 1 ELSE 0 END as enabled
      FROM inspect_items i
      LEFT JOIN area_inspect_items ai ON ai.item_id = i.id AND ai.area_id = ?
      ORDER BY i.sort_order, i.id
    `).all(areaId).map(row => ({
      ...row,
      options: row.options ? JSON.parse(row.options) : null,
      enabled: !!row.enabled,
    }));
  },

  // Save area checkbox selection (transaction: delete all, re-insert checked)
  setAreaItems: db.transaction((areaId, itemIds) => {
    db.prepare('DELETE FROM area_inspect_items WHERE area_id = ?').run(areaId);
    const stmt = db.prepare(
      'INSERT INTO area_inspect_items (area_id, item_id, sort_order) VALUES (?, ?, ?)'
    );
    itemIds.forEach((itemId, index) => {
      stmt.run(areaId, itemId, index);
    });
  }),

  // Auto-link all default items to a new area
  linkDefaultsToArea(areaId) {
    const defaults = db.prepare(
      'SELECT id, sort_order FROM inspect_items WHERE is_default = 1 ORDER BY sort_order'
    ).all();
    const stmt = db.prepare(
      'INSERT OR IGNORE INTO area_inspect_items (area_id, item_id, sort_order) VALUES (?, ?, ?)'
    );
    db.transaction(() => {
      for (const item of defaults) {
        stmt.run(areaId, item.id, item.sort_order);
      }
    })();
  },
};

module.exports = InspectItem;
