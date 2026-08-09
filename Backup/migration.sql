-- ChatApp Pro Database Schema
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(20) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    sex VARCHAR(10),
    age_verified BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    session_token VARCHAR(255) UNIQUE,
    last_active TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (CURRENT_TIMESTAMP + INTERVAL '7 days'),
    preferences JSONB DEFAULT '{"dm_acceptance":"requests_only"}',
    blocked_users UUID[] DEFAULT '{}',
    current_room VARCHAR(20)
);

CREATE TABLE IF NOT EXISTS messages (
    id UUID DEFAULT gen_random_uuid(),
    room_name VARCHAR(20) NOT NULL,
    sender_id UUID REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    language VARCHAR(10) DEFAULT 'en',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    is_dm BOOLEAN DEFAULT false,
    recipient_id UUID REFERENCES users(id) ON DELETE CASCADE,
    read_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS dm_requests (
    id UUID DEFAULT gen_random_uuid(),
    sender_id UUID REFERENCES users(id) ON DELETE CASCADE,
    recipient_id UUID REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(sender_id, recipient_id)
);

CREATE INDEX IF NOT EXISTS idx_users_expires_at ON users(expires_at);
CREATE INDEX IF NOT EXISTS idx_users_session ON users(session_token);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_messages_room ON messages(room_name, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_dm ON messages(recipient_id, created_at DESC) WHERE is_dm = true;
CREATE INDEX IF NOT EXISTS idx_dm_requests_status ON dm_requests(status);

INSERT INTO users (id, username, password_hash, sex, age_verified, expires_at)
SELECT 
    gen_random_uuid(),
    'demo_user',
    '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy',
    'male',
    true,
    NOW() + INTERVAL '7 days'
WHERE NOT EXISTS (SELECT 1 FROM users WHERE username = 'demo_user');

INSERT INTO messages (room_name, sender_id, content, created_at)
SELECT 
    room_name,
    (SELECT id FROM users WHERE username = 'demo_user'),
    'Welcome to ChatApp Pro! Start chatting with people from around the world!',
    NOW()
FROM (VALUES ('usa'), ('canada'), ('africa'), ('asia'), ('europe')) AS rooms(room_name)
WHERE EXISTS (SELECT 1 FROM users WHERE username = 'demo_user');

SELECT 'Users:' as label, COUNT(*) as count FROM users;
SELECT 'Messages:' as label, COUNT(*) as count FROM messages;
