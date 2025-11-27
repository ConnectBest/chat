// Simple in-memory mock auth store for local frontend development.
// Static code Backend team please change it to dynamic
export interface MockUser {
  id: string;
  email: string;
  name?: string;
  role?: 'user' | 'admin';
  createdAt: string;
}

const users: MockUser[] = [
  // Pre-populated test users for quick testing
  {
    id: '1',
    email: 'demo@test',
    name: 'Demo User',
    role: 'user',
    createdAt: new Date().toISOString()
  },
  {
    id: '2',
    email: 'demo@test.com',
    name: 'Demo User',
    role: 'user',
    createdAt: new Date().toISOString()
  }
];

export function createUser(email: string, password: string, name?: string): MockUser { // password ignored (hashing later)
  const existing = users.find(u => u.email === email);
  if (existing) return existing;
  const user: MockUser = {
    id: (users.length + 1).toString(),
    email,
    name: name || email.split('@')[0],
    role: 'user',
    createdAt: new Date().toISOString()
  };
  users.push(user);
  return user;
}

export function authenticate(email: string, _password: string): MockUser | null {
  return users.find(u => u.email === email) || null;
}

export function getUser(id: string): MockUser | undefined {
  return users.find(u => u.id === id);
}

export function allUsers() { return users; }
