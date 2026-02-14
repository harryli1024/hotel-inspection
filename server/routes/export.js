const express = require('express');
const ExcelJS = require('exceljs');
const auth = require('../middleware/auth');
const requireRole = require('../middleware/role');
const Inspection = require('../models/Inspection');

const router = express.Router();
router.use(auth);
router.use(requireRole('admin', 'super_admin'));

// GET /api/export/inspections
router.get('/inspections', async (req, res) => {
  try {
    const { startDate, endDate, inspectorId, checkpointId, areaId } = req.query;

    const data = Inspection.getExportData({
      startDate, endDate,
      inspectorId: inspectorId || undefined,
      checkpointId: checkpointId || undefined,
      areaId: areaId || undefined,
    });

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('巡检记录');

    // Fixed columns
    const columns = [
      { header: '记录ID', key: 'id', width: 10 },
      { header: '区域', key: 'area_name', width: 15 },
      { header: '楼层', key: 'floor', width: 10 },
      { header: '检查点', key: 'checkpoint_name', width: 20 },
      { header: '检查员', key: 'inspector_name', width: 15 },
      { header: '提交时间', key: 'submitted_at', width: 20 },
      { header: '合规状态', key: 'compliance_status', width: 15 },
      { header: '照片数量', key: 'photo_count', width: 10 },
    ];

    // Collect all unique item names for dynamic columns
    const itemNames = new Set();
    data.forEach(record => {
      record.items.forEach(item => itemNames.add(item.item_name));
    });
    const itemNameList = [...itemNames];
    itemNameList.forEach(name => {
      columns.push({ header: name, key: `item_${name}`, width: 15 });
    });

    sheet.columns = columns;

    // Add data rows
    for (const record of data) {
      const row = {
        id: record.id,
        area_name: record.area_name || '',
        floor: record.floor || '',
        checkpoint_name: record.checkpoint_name || '',
        inspector_name: record.inspector_name || '',
        submitted_at: record.submitted_at,
        compliance_status: { on_time: '按时', anomaly: '异常' }[record.compliance_status] || record.compliance_status,
        photo_count: record.photo_count,
      };

      // Add item values
      record.items.forEach(item => {
        row[`item_${item.item_name}`] = item.value || '';
      });

      sheet.addRow(row);
    }

    // Style header row
    const headerRow = sheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4472C4' },
    };
    headerRow.alignment = { horizontal: 'center' };

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=inspection_${Date.now()}.xlsx`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error('Export error:', err);
    res.status(500).json({ error: '导出失败' });
  }
});

module.exports = router;
