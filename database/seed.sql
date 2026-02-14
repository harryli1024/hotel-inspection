-- 默认超级管理员账号: admin / admin123
-- password_hash 是 bcryptjs 对 'admin123' 的哈希值
INSERT INTO users (username, password_hash, role, real_name, phone)
VALUES ('admin', '$2a$10$qKBHNxq3rkj7gFCDCYzVOOCRqLbGGPwFCAQz9j3GBXe6MJdFh5yIe', 'super_admin', '系统管理员', '13800000000');
