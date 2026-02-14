/**
 * Fixed inspection items — hardcoded, no template system needed.
 */
const INSPECT_ITEMS = [
  { id: 'cleanliness', name: '卫生状况', inputType: 'radio', options: ['干净', '脏污'], required: true },
  { id: 'supplies', name: '纸巾/洗手液', inputType: 'radio', options: ['充足', '缺少'], required: true },
  { id: 'equipment', name: '设备状况', inputType: 'radio', options: ['正常', '损坏'], required: true },
  { id: 'notes', name: '备注', inputType: 'text', options: null, required: false },
];

module.exports = INSPECT_ITEMS;
