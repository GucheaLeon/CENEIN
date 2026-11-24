CREATE TABLE IF NOT EXISTS ROLES (
  id BIGSERIAL PRIMARY KEY,
  name TEXT UNIQUE
);

CREATE TABLE IF NOT EXISTS USERS (
  id BIGSERIAL PRIMARY KEY,
  username TEXT UNIQUE,
  password_hash TEXT,
  is_admin BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS USER_ROLES (
  user_rol_id BIGSERIAL PRIMARY KEY,
  user_id BIGINT REFERENCES USERS(id) ON DELETE CASCADE,
  role_id BIGINT REFERENCES ROLES(id) ON DELETE CASCADE
);

ALTER TABLE ROLES
  ADD COLUMN IF NOT EXISTS is_system BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS ROLE_PERMISSIONS (
  role_id BIGINT NOT NULL REFERENCES ROLES(id) ON DELETE CASCADE,
  module_key TEXT NOT NULL,
  can_use BOOLEAN NOT NULL DEFAULT FALSE,
  PRIMARY KEY (role_id, module_key)
);

INSERT INTO ROLES (name, is_system)
VALUES ('ADMIN', TRUE), ('USER', TRUE)
ON CONFLICT (name) DO UPDATE SET is_system = TRUE;

INSERT INTO ROLE_PERMISSIONS (role_id, module_key, can_use)
SELECT roles.id, module_key, TRUE
FROM ROLES
CROSS JOIN (
  VALUES ('patients'), ('alta'), ('attendances'), ('admission'), ('billing'), ('reports')
) AS modules(module_key)
WHERE upper(roles.name) IN ('ADMIN', 'USER')
ON CONFLICT (role_id, module_key) DO UPDATE SET can_use = TRUE;

INSERT INTO USER_ROLES (user_id, role_id)
SELECT users.id, roles.id
FROM USERS AS users
JOIN ROLES AS roles
  ON upper(roles.name) = CASE WHEN users.is_admin THEN 'ADMIN' ELSE 'USER' END
WHERE NOT EXISTS (
  SELECT 1 FROM USER_ROLES AS assigned WHERE assigned.user_id = users.id
);
